import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CardIndex, collectCdbPaths } from '../../../src/main/edopro/carddb';

type Row = { id: number; alias?: number; type?: number; name: string };

async function writeCdb(file: string, rows: Row[]): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE datas (id INTEGER PRIMARY KEY, alias INTEGER, type INTEGER)');
  db.run('CREATE TABLE texts (id INTEGER PRIMARY KEY, name TEXT)');
  for (const row of rows) {
    db.run('INSERT INTO datas VALUES (?, ?, ?)', [row.id, row.alias ?? 0, row.type ?? 0x1]);
    db.run('INSERT INTO texts VALUES (?, ?)', [row.id, row.name]);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(db.export()));
  db.close();
}

describe('CardIndex', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(path.join(os.tmpdir(), 'cdb-'));
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('indexes cards from cards.cdb and searches by substring', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [
      { id: 14558127, name: 'Ash Blossom & Joyous Spring' },
      { id: 23434538, name: 'Maxx "C"' },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.cards).toBe(2);
    expect(index.databases).toBe(1);
    expect(index.search('blossom')).toEqual([
      {
        passcode: 14558127,
        name: 'Ash Blossom & Joyous Spring',
        typeline: 'Monster',
        isExtraDeck: false,
      },
    ]);
  });

  it('ranks prefix matches above substring matches', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [
      { id: 2, name: 'Crystal Wing Synchro Dragon', type: 0x1 | 0x2000 },
      { id: 1, name: 'Wing Requital' },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.search('wing').map((h) => h.passcode)).toEqual([1, 2]);
  });

  it('collapses artwork variants onto the canonical code', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [
      { id: 54701958, name: 'Lunalight Liger Dancer' },
      { id: 101301030, alias: 54701958, name: 'Lunalight Liger Dancer' },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.cards).toBe(1);
    expect(index.search('liger')[0]?.passcode).toBe(54701958);
  });

  it('keeps an aliased variant whose canonical row is unknown', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [
      { id: 101301030, alias: 54701958, name: 'Lunalight Liger Dancer' },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.search('liger')[0]?.passcode).toBe(101301030);
  });

  it('merges expansions and repositories databases recursively', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [{ id: 1, name: 'Alpha' }]);
    await writeCdb(path.join(workdir, 'expansions', 'pack', 'more.cdb'), [
      { id: 2, name: 'Beta' },
    ]);
    await writeCdb(path.join(workdir, 'repositories', 'delta', 'deep', 'third.cdb'), [
      { id: 3, name: 'Gamma' },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.cards).toBe(3);
    expect(index.databases).toBe(3);
  });

  it('marks extra-deck monsters and labels typelines', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [
      { id: 1, name: 'Some Link', type: 0x1 | 0x4000000 },
      { id: 2, name: 'Some Spell', type: 0x2 },
    ]);
    const index = await CardIndex.load(workdir);
    expect(index.search('some link')[0]).toMatchObject({ typeline: 'Link Monster', isExtraDeck: true });
    expect(index.search('some spell')[0]).toMatchObject({ typeline: 'Spell', isExtraDeck: false });
  });

  it('is diacritic- and case-insensitive', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [{ id: 1, name: 'Doré the Émissary' }]);
    const index = await CardIndex.load(workdir);
    expect(index.search('dore the em')).toHaveLength(1);
  });

  it('skips malformed databases without failing the load', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [{ id: 1, name: 'Alpha' }]);
    writeFileSync(path.join(workdir, 'expansions.cdb'), 'not sqlite'); // ignored: not under a scanned dir
    mkdirSync(path.join(workdir, 'expansions'), { recursive: true });
    writeFileSync(path.join(workdir, 'expansions', 'broken.cdb'), 'not sqlite');
    const index = await CardIndex.load(workdir);
    expect(index.cards).toBe(1);
  });

  it('returns nothing for a blank query', async () => {
    await writeCdb(path.join(workdir, 'cards.cdb'), [{ id: 1, name: 'Alpha' }]);
    const index = await CardIndex.load(workdir);
    expect(index.search('  ')).toEqual([]);
  });
});

describe('collectCdbPaths', () => {
  it('ignores an empty cards.cdb, matching the solver', () => {
    const workdir = mkdtempSync(path.join(os.tmpdir(), 'cdb-'));
    writeFileSync(path.join(workdir, 'cards.cdb'), '');
    expect(collectCdbPaths(workdir)).toEqual([]);
    rmSync(workdir, { recursive: true, force: true });
  });
});
