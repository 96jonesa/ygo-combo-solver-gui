import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import type { CardHit } from '../../shared/types';

/**
 * In-memory card index over EDOPro's .cdb SQLite databases (TDD §9.2),
 * powering the picker's autocomplete. Reads the same files in the same
 * order the solver reads them; ~14k cards is a few MB, rebuilt in well
 * under a second, so no persistence.
 *
 * Engine note: sql.js (wasm) instead of the TDD's primary better-sqlite3
 * pick — a native module would need different ABIs under Electron and
 * vitest; the TDD §2 held sql.js in reserve for exactly this friction.
 */

// EDOPro `type` bitmask, from the ocgcore constants the solver reads.
const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;
const TYPE_FUSION = 0x40;
const TYPE_SYNCHRO = 0x2000;
const TYPE_XYZ = 0x800000;
const TYPE_LINK = 0x4000000;
const EXTRA_DECK_MASK = TYPE_FUSION | TYPE_SYNCHRO | TYPE_XYZ | TYPE_LINK;

interface IndexEntry {
  code: number;
  name: string;
  normalized: string;
  typeline: string;
  isExtraDeck: boolean;
}

/** Same collection order as the solver: cards.cdb (non-empty), then recursive expansions/, repositories/. */
export function collectCdbPaths(workdir: string): string[] {
  const paths: string[] = [];
  const rootCdb = path.join(workdir, 'cards.cdb');
  if (existsSync(rootCdb) && statSync(rootCdb).size > 0) paths.push(rootCdb);
  for (const sub of ['expansions', 'repositories'])
    paths.push(...findCdbsRecursive(path.join(workdir, sub)));
  return paths;
}

function findCdbsRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findCdbsRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.cdb') && statSync(full).size > 0)
      found.push(full);
  }
  return found.sort();
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function typeline(type: number): string {
  if (type & TYPE_MONSTER) {
    if (type & TYPE_FUSION) return 'Fusion Monster';
    if (type & TYPE_SYNCHRO) return 'Synchro Monster';
    if (type & TYPE_XYZ) return 'Xyz Monster';
    if (type & TYPE_LINK) return 'Link Monster';
    return 'Monster';
  }
  if (type & TYPE_SPELL) return 'Spell';
  if (type & TYPE_TRAP) return 'Trap';
  return 'Card';
}

export class CardIndex {
  private constructor(
    private readonly entries: IndexEntry[],
    readonly databases: number,
  ) {}

  static empty(): CardIndex {
    return new CardIndex([], 0);
  }

  /**
   * Load and merge all databases under a workdir. Later databases
   * override earlier rows for the same code, matching load order;
   * artwork variants (alias != 0) collapse onto their canonical code
   * so the picker never shows the same card twice.
   */
  static async load(workdir: string): Promise<CardIndex> {
    const SQL = await initSqlJs();
    const cdbPaths = collectCdbPaths(workdir);
    const rows = new Map<number, { name: string; type: number; alias: number }>();

    for (const cdbPath of cdbPaths) {
      let db: InstanceType<typeof SQL.Database> | null = null;
      try {
        db = new SQL.Database(readFileSync(cdbPath));
        const result = db.exec(
          'SELECT datas.id, datas.alias, datas.type, texts.name FROM datas JOIN texts ON datas.id = texts.id',
        );
        for (const [id, alias, type, name] of result[0]?.values ?? []) {
          rows.set(Number(id), {
            name: String(name),
            type: Number(type),
            alias: Number(alias),
          });
        }
      } catch {
        // A malformed .cdb is skipped, mirroring "load what parses".
      } finally {
        db?.close();
      }
    }

    // Collapse artwork variants: an alias pointing at a known canonical
    // row drops the variant; an alias without a canonical row keeps the
    // variant under its own code (so the card stays findable).
    const entries: IndexEntry[] = [];
    for (const [code, row] of rows) {
      if (row.alias !== 0 && rows.has(row.alias)) continue;
      entries.push({
        code,
        name: row.name,
        normalized: normalize(row.name),
        typeline: typeline(row.type),
        isExtraDeck: (row.type & TYPE_MONSTER) !== 0 && (row.type & EXTRA_DECK_MASK) !== 0,
      });
    }
    entries.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
    return new CardIndex(entries, cdbPaths.length);
  }

  get cards(): number {
    return this.entries.length;
  }

  /** Prefix matches rank above substring matches; ties by name length. */
  search(query: string, limit = 20): CardHit[] {
    const needle = normalize(query.trim());
    if (needle === '') return [];
    const prefix: CardHit[] = [];
    const substring: CardHit[] = [];
    for (const entry of this.entries) {
      const at = entry.normalized.indexOf(needle);
      if (at < 0) continue;
      const hit: CardHit = {
        passcode: entry.code,
        name: entry.name,
        typeline: entry.typeline,
        isExtraDeck: entry.isExtraDeck,
      };
      (at === 0 ? prefix : substring).push(hit);
      if (prefix.length >= limit) break;
    }
    return [...prefix, ...substring].slice(0, limit);
  }
}
