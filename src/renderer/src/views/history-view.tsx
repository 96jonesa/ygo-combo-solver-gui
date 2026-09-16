import React, { useEffect, useState } from 'react';
import type { RunRecord, RunSummary } from '../../../shared/types';
import { ResultsPanel } from './results-panel';
import { useAppStore } from '../store';

export function HistoryView() {
  const setDraft = useAppStore((s) => s.setDraft);
  const setTab = useAppStore((s) => s.setTab);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<RunRecord | null>(null);

  useEffect(() => {
    void window.api.listHistory().then(setRuns);
  }, []);

  const select = async (runId: string) => {
    setSelected(await window.api.getRun(runId));
  };

  const duplicate = (record: RunRecord) => {
    // Reload the exact spec into the run form; drop the resolved outdir
    // so the new run gets its own folder (TDD §10.2 "duplicate run").
    setDraft({ ...record.spec, common: { ...record.spec.common, outdir: undefined } });
    setTab('run');
  };

  if (runs.length === 0)
    return <div className="history-view empty-note">No runs yet — start one from the Run tab.</div>;

  return (
    <div className="history-view">
      <ul className="run-list">
        {runs.map((run) => (
          <li key={run.runId}>
            <button
              className={selected?.runId === run.runId ? 'selected' : ''}
              onClick={() => void select(run.runId)}
            >
              <span className={`status status-${run.outcome ?? 'running'}`}>
                {run.outcome ?? 'unknown'}
              </span>
              <span className="run-kind">{run.kind}</span>
              <span className="run-replay">{run.replay.split(/[\\/]/).at(-1)}</span>
              <span className="run-when">{new Date(run.startedAt).toLocaleString()}</span>
              {run.solutions !== undefined && (
                <span className="run-solutions">{run.solutions} solution(s)</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {selected !== null && (
        <section className="run-detail">
          <h3>
            {selected.spec.kind} · {new Date(selected.startedAt).toLocaleString()}
          </h3>
          <div className="row preview-row">
            <code className="preview">{selected.display}</code>
            <button onClick={() => void navigator.clipboard.writeText(selected.display)}>
              Copy
            </button>
          </div>
          <p className="hint">
            outcome: {selected.outcome ?? 'unknown'}
            {selected.status?.seed !== undefined &&
              ` · seed ${selected.status.seed} (reusable for a reproducible re-run)`}
            {selected.status?.msgRetry !== undefined && ` · MSG_RETRY ${selected.status.msgRetry}`}
            {selected.solver.solverCommit !== undefined &&
              ` · solver ${selected.solver.solverCommit.slice(0, 12)}`}
          </p>
          <div className="row">
            <button onClick={() => duplicate(selected)}>Duplicate run</button>
            <button
              onClick={() =>
                void window.api.openResult({ runId: selected.runId, file: 'log', action: 'reveal' })
              }
            >
              Reveal log
            </button>
          </div>
          <ResultsPanel runId={selected.runId} outcome={selected.outcome ?? 'finished'} />
        </section>
      )}
    </div>
  );
}
