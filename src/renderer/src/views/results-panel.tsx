import React, { useEffect, useState } from 'react';
import type { RunArtifact, RunRecord, RunStatus } from '../../../shared/types';
import { useAppStore } from '../store';

function artifactLabel(artifact: RunArtifact): string {
  switch (artifact.kind) {
    case 'solution':
      return `#${artifact.rank} — ${artifact.burned} burned, ${artifact.actions} actions${artifact.alt ? ' (alt goal)' : ''}`;
    case 'approach':
      return `best approach — ${artifact.reached}/${artifact.of} board cards (NOT a solution; reusable via --approach)`;
    case 'joint':
      return `best joint — ${artifact.rips} rip(s), ${artifact.reached}/${artifact.of} board cards`;
    case 'rejected':
      return `rejected witness (${artifact.reason})`;
    case 'other':
      return 'unclassified file';
  }
}

/**
 * Post-run artifact list (PRD §5.2.5): ranked solutions with
 * open-in-EDOPro / reveal / use-as-input, partials and rejected
 * witnesses labeled with what they mean.
 */
export function ResultsPanel({ runId, outcome }: { runId: string; outcome: RunStatus }) {
  const health = useAppStore((s) => s.health);
  const setDraft = useAppStore((s) => s.setDraft);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void window.api.getRun(runId).then(setRecord);
  }, [runId, outcome]);

  if (record?.artifacts === undefined) return null;
  const artifacts = record.artifacts;

  const open = async (file: string, action: 'edopro' | 'reveal') => {
    const result = await window.api.openResult({ runId, file, action });
    setNotice(
      result.ok
        ? action === 'edopro'
          ? 'Copied into EDOPro’s replay folder and launched EDOPro — pick it from the replay list.'
          : null
        : (result.error ?? 'failed'),
    );
  };

  const useAsInput = (file: string) => {
    setDraft({
      kind: 'verify',
      replay: `${record.outdir}/${file}`,
      common: { ...record.spec.common, seed: undefined },
    });
  };

  return (
    <div className="results">
      <h3>Results</h3>
      {artifacts.length === 0 && (
        <p className="hint">
          No files were written to the output folder
          {outcome === 'stopped' ? ' (the run was stopped before a phase completed)' : ''}.
        </p>
      )}
      {artifacts.map((artifact) => (
        <div key={artifact.file} className={`artifact artifact-${artifact.kind}`}>
          <span className="artifact-label">{artifactLabel(artifact)}</span>
          <span className="artifact-file">{artifact.file}</span>
          <span className="artifact-actions">
            {artifact.file.endsWith('.yrp') && (
              <>
                <button
                  disabled={health?.edoproExe == null}
                  title={health?.edoproExe == null ? 'EDOPro executable not found in Settings' : ''}
                  onClick={() => void open(artifact.file, 'edopro')}
                >
                  Open in EDOPro
                </button>
                <button onClick={() => useAsInput(artifact.file)}>Use as input</button>
              </>
            )}
            <button onClick={() => void open(artifact.file, 'reveal')}>Reveal</button>
          </span>
        </div>
      ))}
      {notice !== null && <p className="hint">{notice}</p>}
    </div>
  );
}
