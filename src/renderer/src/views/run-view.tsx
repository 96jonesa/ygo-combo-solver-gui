import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RunSpec } from '../../../shared/types';
import { ResultsPanel } from './results-panel';
import { useAppStore } from '../store';

type WorkflowKind = RunSpec['kind'];

const WORKFLOWS: { kind: WorkflowKind; label: string; hint: string }[] = [
  {
    kind: 'verify',
    label: 'Verify a replay',
    hint: 'Replays the duel and checks it reproduces under your card scripts (MSG_RETRY must be 0). Do this once for every new replay — under mismatched scripts the solver silently runs a different duel.',
  },
  {
    kind: 'optimize',
    label: 'Find a cheaper line',
    hint: 'Searches for lines reaching the same end board while burning fewer cards (--solve --optimize). Verify the replay first if you have not already.',
  },
];

export function RunView() {
  const settings = useAppStore((s) => s.settings)!;
  const run = useAppStore((s) => s.run);
  const draft = useAppStore((s) => s.draft);
  const setDraft = useAppStore((s) => s.setDraft);
  const startRun = useAppStore((s) => s.startRun);

  const [kind, setKind] = useState<WorkflowKind>('verify');
  const [replay, setReplay] = useState('');
  const [solveMs, setSolveMs] = useState(settings.defaults.solveMs);
  const [threads, setThreads] = useState<string>(settings.defaults.threads?.toString() ?? '');
  const [seed, setSeed] = useState('');
  const [extraArgs, setExtraArgs] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  // Consume a spec loaded from history ("duplicate run" / "use as input").
  useEffect(() => {
    if (draft === null) return;
    setKind(draft.kind);
    setReplay(draft.replay);
    if (draft.common.solveMs !== undefined) setSolveMs(draft.common.solveMs);
    setThreads(draft.common.threads?.toString() ?? '');
    setSeed(draft.common.seed?.toString() ?? '');
    setExtraArgs(draft.common.extraArgs ?? '');
    setDraft(null);
  }, [draft, setDraft]);

  const spec = useMemo<RunSpec>(
    () => ({
      kind,
      replay,
      common: {
        solveMs,
        ...(threads !== '' && { threads: Number(threads) }),
        ...(seed !== '' && { seed: Number(seed) }),
        ...(extraArgs.trim() !== '' && { extraArgs }),
      },
    }),
    [kind, replay, solveMs, threads, seed, extraArgs],
  );

  // Debounced command preview from the same serializer that spawns.
  useEffect(() => {
    const timer = setTimeout(() => {
      window.api
        .previewRun(spec)
        .then((p) => {
          setPreview(p.display);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 150);
    return () => clearTimeout(timer);
  }, [spec]);

  const running = run?.status === 'running';
  const workflow = WORKFLOWS.find((w) => w.kind === kind)!;

  const onStart = async () => {
    setError(null);
    try {
      const started = await window.api.startRun(spec);
      startRun({
        runId: started.runId,
        display: started.display,
        logPath: started.logPath,
        outdir: started.outdir,
        budgetMs: solveMs,
      });
      setConfirmStop(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onStop = () => {
    if (!run) return;
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    void window.api.stopRun(run.runId);
    setConfirmStop(false);
  };

  return (
    <div className="run-view">
      <section className="form">
        <div className="row">
          <label>Workflow</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as WorkflowKind)}>
            {WORKFLOWS.map((w) => (
              <option key={w.kind} value={w.kind}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">{workflow.hint}</p>
        <div className="row">
          <label>Replay</label>
          <input value={replay} readOnly placeholder="pick a .yrpX / .yrp file" />
          <button
            onClick={() => {
              void window.api.pickFile('replay').then((f) => f !== null && setReplay(f));
            }}
          >
            Browse…
          </button>
        </div>
        <div className="row">
          <label>Budget</label>
          <select value={solveMs} onChange={(e) => setSolveMs(Number(e.target.value))}>
            <option value={120000}>2 minutes (default)</option>
            <option value={600000}>10 minutes</option>
            <option value={3600000}>1 hour</option>
          </select>
          <label>Threads</label>
          <input
            className="narrow"
            value={threads}
            onChange={(e) => setThreads(e.target.value.replaceAll(/\D/g, ''))}
            placeholder="all cores"
          />
          <label>Seed</label>
          <input
            className="narrow"
            value={seed}
            onChange={(e) => setSeed(e.target.value.replaceAll(/\D/g, ''))}
            placeholder="random"
          />
        </div>
        <div className="row">
          <label>Extra arguments</label>
          <input
            value={extraArgs}
            onChange={(e) => setExtraArgs(e.target.value)}
            placeholder="appended verbatim — reaches every solver flag"
          />
        </div>
        <div className="row preview-row">
          <label>Command</label>
          <code className="preview">{preview}</code>
          <button onClick={() => void navigator.clipboard.writeText(preview)}>Copy</button>
        </div>
        {error !== null && <div className="error">{error}</div>}
        <div className="row actions">
          {!running ? (
            <button className="primary" disabled={replay === ''} onClick={() => void onStart()}>
              Run
            </button>
          ) : (
            <button className="danger" onClick={onStop}>
              {confirmStop ? 'Really stop? In-progress results will be lost' : 'Stop'}
            </button>
          )}
          {run && <StatusBadge />}
          {run && <LiveStatus />}
        </div>
        <HealthBanner />
        {run !== null && run.status !== 'running' && (
          <ResultsPanel runId={run.runId} outcome={run.status} />
        )}
      </section>
      <LogPane />
    </div>
  );
}

function StatusBadge() {
  const run = useAppStore((s) => s.run)!;
  const label =
    run.status === 'running'
      ? 'running'
      : run.status === 'finished'
        ? 'finished'
        : run.status === 'stopped'
          ? 'stopped'
          : `failed${run.message !== undefined ? ` — ${run.message}` : ''}`;
  return <span className={`status status-${run.status}`}>{label}</span>;
}

const PHASE_LABELS = {
  loading: 'loading assets',
  replay: 'replaying reference',
  search: 'searching',
  output: 'writing results',
} as const;

function LiveStatus() {
  const run = useAppStore((s) => s.run)!;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (run.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.status]);

  if (run.status !== 'running') return null;
  const elapsedS = Math.floor((now - run.startedAt) / 1000);
  const budgetS = Math.floor(run.budgetMs / 1000);
  const parts = [`${elapsedS}s / ~${budgetS}s budget`];
  const parsed = run.parsed;
  if (parsed?.phase !== undefined) parts.push(PHASE_LABELS[parsed.phase]);
  if (parsed?.ladder !== undefined)
    parts.push(
      `rung ${parsed.ladder.discrepancies}, ${parsed.ladder.solutions} solution(s) so far`,
    );
  return <span className="live-status">{parts.join(' · ')}</span>;
}

function HealthBanner() {
  const run = useAppStore((s) => s.run);
  const parsed = run?.parsed;
  if (!parsed) return null;

  const banners: React.ReactNode[] = [];
  if (parsed.msgRetry !== undefined) {
    const healthy = parsed.msgRetry === 0;
    banners.push(
      <div key="retry" className={`banner ${healthy ? 'banner-ok' : 'banner-bad'}`}>
        {healthy
          ? '✓ faithful replay — MSG_RETRY 0'
          : `✗ MSG_RETRY ${parsed.msgRetry} — the replay does NOT reproduce under these card scripts; results would describe a different duel`}
      </div>,
    );
  }
  if (parsed.selfChecks !== undefined && !parsed.selfChecks.pass) {
    banners.push(
      <div key="checks" className="banner banner-bad">
        ✗ solver self-checks failed{parsed.selfChecks.detail && ` — ${parsed.selfChecks.detail}`}
      </div>,
    );
  }
  if (parsed.inertFlags.length > 0) {
    banners.push(
      <div key="inert" className="banner banner-warn">
        ⚠ ignored flags (INERT): {parsed.inertFlags.join(', ')}
      </div>,
    );
  }
  for (const error of parsed.errors) {
    banners.push(
      <div key={error} className="banner banner-bad">
        !! {error}
      </div>,
    );
  }
  return banners.length > 0 ? <div className="banners">{banners}</div> : null;
}

function LogPane() {
  const run = useAppStore((s) => s.run);
  const paneRef = useRef<HTMLPreElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (follow && paneRef.current !== null)
      paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [run?.lines, follow]);

  if (run === null) return <section className="log-pane empty">Solver output appears here.</section>;

  return (
    <section className="log-pane">
      <div className="log-header">
        <span className="log-path">{run.logPath}</span>
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow
        </label>
      </div>
      <pre ref={paneRef}>{run.lines.join('\n')}</pre>
    </section>
  );
}
