import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RunSpec } from '../../../shared/types';
import { useAppStore } from '../store';

/**
 * M0 run view: the verify workflow (replay + common options + extra
 * args), live log streaming, and the always-visible command preview.
 * M1 adds the remaining workflow forms and the results pane.
 */
export function RunView() {
  const settings = useAppStore((s) => s.settings)!;
  const run = useAppStore((s) => s.run);
  const startRun = useAppStore((s) => s.startRun);

  const [replay, setReplay] = useState('');
  const [solveMs, setSolveMs] = useState(settings.defaults.solveMs);
  const [threads, setThreads] = useState<string>(settings.defaults.threads?.toString() ?? '');
  const [seed, setSeed] = useState('');
  const [extraArgs, setExtraArgs] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const spec = useMemo<RunSpec>(
    () => ({
      kind: 'verify',
      replay,
      common: {
        solveMs,
        ...(threads !== '' && { threads: Number(threads) }),
        ...(seed !== '' && { seed: Number(seed) }),
        ...(extraArgs.trim() !== '' && { extraArgs }),
      },
    }),
    [replay, solveMs, threads, seed, extraArgs],
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

  const onStart = async () => {
    setError(null);
    try {
      const started = await window.api.startRun(spec);
      startRun({
        runId: started.runId,
        display: started.display,
        logPath: started.logPath,
        outdir: started.outdir,
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
        <h2>Verify a replay</h2>
        <p className="hint">
          Replays the duel and checks it reproduces under your card scripts (MSG_RETRY must be 0)
          before you spend a solve budget on it. Other workflows arrive in M1/M2 — the extra
          arguments field reaches every solver flag meanwhile.
        </p>
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
            placeholder='e.g. --solve --optimize --verbose (appended verbatim)'
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
        </div>
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
