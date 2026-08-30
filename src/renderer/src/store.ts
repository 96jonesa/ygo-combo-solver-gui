import { create } from 'zustand';
import type { RunStatus, Settings, WorkdirHealth } from '../../shared/types';

/** Renderer keeps a capped buffer; the full log is always on disk (TDD §4). */
const MAX_LOG_LINES = 50_000;

export interface RunState {
  runId: string;
  status: RunStatus;
  display: string;
  logPath: string;
  outdir: string;
  lines: string[];
  exitCode: number | null;
  message?: string;
}

interface AppState {
  settings: Settings | null;
  health: WorkdirHealth | null;
  run: RunState | null;
  setSettings(settings: Settings): void;
  setHealth(health: WorkdirHealth | null): void;
  startRun(run: Omit<RunState, 'lines' | 'exitCode' | 'status'>): void;
  appendLines(runId: string, lines: string[]): void;
  updateStatus(runId: string, status: RunStatus, exitCode: number | null, message?: string): void;
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  health: null,
  run: null,
  setSettings: (settings) => set({ settings }),
  setHealth: (health) => set({ health }),
  startRun: (run) => set({ run: { ...run, status: 'running', lines: [], exitCode: null } }),
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
  updateStatus: (runId, status, exitCode, message) =>
    set((state) =>
      state.run?.runId === runId ? { run: { ...state.run, status, exitCode, message } } : state,
    ),
}));
