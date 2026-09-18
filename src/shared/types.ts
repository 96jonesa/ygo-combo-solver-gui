/** Shared types crossing the IPC boundary. Everything here must be structured-cloneable. */

export interface Settings {
  version: 1;
  /** EDOPro install directory; null until first-run setup completes. */
  workdir: string | null;
  /** Per-user --scriptdir overrides, highest priority first. */
  scriptdirs: string[];
  solver: {
    /** Override path to a solver binary/script; null = bundled default. */
    nativePath: string | null;
    forceWasm: boolean;
  };
  defaults: {
    solveMs: number;
    /** null = solver default (all cores). */
    threads: number | null;
  };
}

export interface WorkdirHealth {
  ok: boolean;
  workdir: string;
  cardDbs: string[];
  scriptRoots: string[];
  edoproExe: string | null;
  problems: string[];
}

/** Common run options shared by every workflow (TDD §6). */
export interface CommonRunOptions {
  /** Resolved from settings by main when absent. */
  workdir?: string;
  scriptdirs?: string[];
  /** Resolved to the per-run folder by main when absent. */
  outdir?: string;
  solveMs?: number;
  threads?: number;
  seed?: number;
  /** Solution write ceiling (--max-written); solver default 16. */
  maxWritten?: number;
  /** Appended verbatim after generated flags. */
  extraArgs?: string;
}

/**
 * A card selected via the picker. Always serialized to the solver as
 * the exact passcode, never the name — the picker resolves names, so
 * the solver's ambiguous-fragment errors are unreachable from forms
 * (PRD §5.2.3).
 */
export interface CardRef {
  passcode: number;
  /** Display only; never sent to the solver. */
  name: string;
}

/** A card-picker search hit. */
export interface CardHit {
  passcode: number;
  name: string;
  typeline: string;
  isExtraDeck: boolean;
}

export interface CardIndexStatus {
  state: 'empty' | 'loading' | 'ready' | 'error';
  cards: number;
  databases: number;
  error?: string;
}

/**
 * Target zones for --target (the solver refuses @field as ambiguous
 * and @extra as not a target zone). Face-down applies to mzone/szone.
 */
export type TargetZone = 'mzone' | 'szone' | 'hand' | 'grave' | 'banished';

export interface TargetSpec {
  card: CardRef;
  zone: TargetZone;
  facedown: boolean;
}

/**
 * The five MVP workflows (TDD §6): verify (bare invocation, the health
 * gate), optimize (--solve --optimize), deckhand (--deck/--hand),
 * board (--no-ref --target ...), fire (--fire/--opp-hand/--guard).
 */
export type RunSpec =
  | { kind: 'verify'; replay: string; common: CommonRunOptions }
  | { kind: 'optimize'; replay: string; common: CommonRunOptions }
  | { kind: 'deckhand'; replay: string; deck: string; hand: CardRef[]; common: CommonRunOptions }
  | {
      kind: 'board';
      replay: string;
      deck: string;
      hand: CardRef[];
      targets: TargetSpec[];
      common: CommonRunOptions;
    }
  | {
      kind: 'fire';
      replay: string;
      fire: CardRef[];
      fireSpare: CardRef[];
      oppHand: CardRef[];
      /** Raw --guard clauses (advanced grammar; not form-built in M2). */
      guards: string[];
      common: CommonRunOptions;
    };

export type RunStatus = 'running' | 'finished' | 'failed' | 'stopped';

export interface RunStatusUpdate {
  status: RunStatus;
  exitCode: number | null;
  /** Human-readable failure hint (usage error vs load/health failure). */
  message?: string;
}

export interface RunEvent {
  runId: string;
  logBatch?: string[];
  statusUpdate?: RunStatusUpdate;
  /** Latest parser snapshot, included when a batch changed it. */
  parsed?: ParsedStatus;
}

export interface RunPreview {
  argv: string[];
  /** Shell-style display string for the command preview pane. */
  display: string;
}

export interface StartResult {
  runId: string;
  argv: string[];
  display: string;
  logPath: string;
  outdir: string;
}

/** A file the solver wrote to the outdir, classified by name (TDD §10.3). */
export type RunArtifact =
  | { file: string; kind: 'solution'; rank: number; burned: number; actions: number; alt: boolean }
  | { file: string; kind: 'approach'; reached: number; of: number }
  | { file: string; kind: 'joint'; rips: number; reached: number; of: number }
  | { file: string; kind: 'rejected'; index: number; reason: 'retry' | 'constraint' | 'board' }
  | { file: string; kind: 'other' };

/** Best-effort live status distilled from the solver's stdout (TDD §7). */
export interface ParsedStatus {
  /** Coarse phase from section markers; undefined until recognized. */
  phase?: 'loading' | 'replay' | 'search' | 'output';
  msgRetry?: number;
  selfChecks?: { pass: boolean; detail: string };
  seed?: number;
  /** Last discrepancy-ladder row seen: rung and solutions so far. */
  ladder?: { discrepancies: number; solutions: number };
  /** Distinct flags the solver marked "!! INERT". */
  inertFlags: string[];
  /** Fatal "!! ..." diagnostics, for the failure explanation. */
  errors: string[];
  solutionsWritten?: { written: number; candidates?: number };
  /** --fire runs: "=== --fire verdict: N window(s) out of M converted ===". */
  fireVerdict?: { converted: number; windows: number };
  /** Enumerator coverage gap: the search space is incomplete (covered < total). */
  coverageGap?: { covered: number; total: number };
}

export interface RunSummary {
  runId: string;
  kind: RunSpec['kind'];
  replay: string;
  startedAt: string;
  endedAt?: string;
  outcome?: RunStatus;
  solutions?: number;
}

/** The persisted per-run record, runs/<runId>/run.json (TDD §10.2). */
export interface RunRecord {
  version: 1;
  runId: string;
  spec: RunSpec;
  argv: string[];
  display: string;
  solver: { kind: 'native' | 'wasm'; path: string; solverCommit?: string };
  startedAt: string;
  endedAt?: string;
  outcome?: RunStatus;
  exitCode?: number | null;
  logPath: string;
  outdir: string;
  status?: ParsedStatus;
  artifacts?: RunArtifact[];
}
