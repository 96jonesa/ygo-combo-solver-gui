import { create } from 'zustand';
import type { ParsedStatus, RunSpec, RunStatus, Settings, WorkdirHealth } from '../../shared/types';

/** Renderer keeps a capped buffer; the full log is always on disk (TDD §4). */
const MAX_LOG_LINES = 50_000;

export type Tab = 'run' | 'history' | 'settings';

export interface RunState {
  runId: string;
  status: RunStatus;
  display: string;
  logPath: string;
  outdir: string;
  startedAt: number;
  budgetMs: number;
  lines: string[];
  parsed: ParsedStatus | null;
  exitCode: number | null;
  message?: string;
}

interface AppState {
  tab: Tab;
  settings: Settings | null;
  health: WorkdirHealth | null;
  run: RunState | null;
  /** Spec loaded from history via "duplicate run", consumed by the run form. */
  draft: RunSpec | null;
  setTab(tab: Tab): void;
  setSettings(settings: Settings): void;
  setHealth(health: WorkdirHealth | null): void;
  setDraft(draft: RunSpec | null): void;
  startRun(run: Omit<RunState, 'lines' | 'exitCode' | 'status' | 'parsed' | 'startedAt'>): void;
  appendLines(runId: string, lines: string[]): void;
  setParsed(runId: string, parsed: ParsedStatus): void;
  updateStatus(runId: string, status: RunStatus, exitCode: number | null, message?: string): void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: 'run',
  settings: null,
  health: null,
  run: null,
  draft: null,
  setTab: (tab) => set({ tab }),
  setSettings: (settings) => set({ settings }),
  setHealth: (health) => set({ health }),
  setDraft: (draft) => set({ draft }),
  startRun: (run) =>
    set({
      run: {
        ...run,
        status: 'running',
        lines: [],
        parsed: null,
        exitCode: null,
        startedAt: Date.now(),
      },
    }),
  appendLines: (runId, lines) =>
    set((state) => {
      if (state.run?.runId !== runId) return state;
      const merged = [...state.run.lines, ...lines];
      return {
        run: {
          ...state.run,
          lines: merged.length > MAX_LOG_LINES ? merged.slice(-MAX_LOG_LINES) : merged,
        },
      };
    }),
  setParsed: (runId, parsed) =>
    set((state) => (state.run?.runId === runId ? { run: { ...state.run, parsed } } : state)),
  updateStatus: (runId, status, exitCode, message) =>
    set((state) =>
      state.run?.runId === runId ? { run: { ...state.run, status, exitCode, message } } : state,
    ),
}));
