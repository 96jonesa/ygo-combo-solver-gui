import React, { useEffect, useState } from 'react';
import type { CardIndexStatus } from '../../../shared/types';
import { useAppStore } from '../store';

/** Card-index status inside the probe panel; polls briefly while loading. */
function CardIndexLine() {
  const [status, setStatus] = useState<CardIndexStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const current = await window.api.cardStatus();
        if (cancelled) return;
        setStatus(current);
        if (current.state !== 'loading') return;
        await new Promise((r) => setTimeout(r, 500));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === null) return null;
  const text =
    status.state === 'ready'
      ? `card index: ${status.cards.toLocaleString()} cards from ${status.databases} database(s)`
      : status.state === 'loading'
        ? 'card index: loading…'
        : status.state === 'error'
          ? `card index failed: ${status.error ?? 'unknown error'}`
          : 'card index: empty';
  return <div>{text}</div>;
}

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)!;
  const health = useAppStore((s) => s.health);
  const setSettings = useAppStore((s) => s.setSettings);
  const setHealth = useAppStore((s) => s.setHealth);
  const [saved, setSaved] = useState(false);

  const save = async (next: typeof settings) => {
    setSettings(await window.api.setSettings(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const setWorkdir = async (dir: string | null) => {
    await save({ ...settings, workdir: dir });
    setHealth(dir !== null ? await window.api.probeWorkdir(dir) : null);
  };

  return (
    <div className="settings-view">
      <h2>Settings</h2>

      <section>
        <h3>EDOPro installation</h3>
        <p className="hint">
          The solver reads card databases and scripts from your EDOPro (Project Ignis) install, and
          results open in it.
        </p>
        <div className="row">
          <label>Directory</label>
          <input value={settings.workdir ?? ''} readOnly placeholder="not set" />
          <button
            onClick={() => {
              void window.api.pickDirectory().then((d) => {
                if (d !== null) void setWorkdir(d);
              });
            }}
          >
            Browse…
          </button>
        </div>
        {health !== null && (
          <div className={`probe ${health.ok ? 'probe-ok' : 'probe-bad'}`}>
            <div>{health.ok ? '✓ usable EDOPro installation' : '✗ not usable'}</div>
            <div>
              {health.cardDbs.length} card database(s), {health.scriptRoots.length} script
              director(ies), EDOPro executable {health.edoproExe !== null ? 'found' : 'not found'}
            </div>
            {health.problems.map((p) => (
              <div key={p} className="problem">
                • {p}
              </div>
            ))}
            <CardIndexLine />
          </div>
        )}
      </section>

      <section>
        <h3>Card script override</h3>
        <p className="hint">
          A replay only reproduces under card scripts contemporary with its recording. Add script
          directories here (highest priority first) to replay older recordings; they are passed as
          --scriptdir and replace the workdir's own repositories scan.
        </p>
        {settings.scriptdirs.map((dir, index) => (
          <div className="row" key={`${dir}-${index}`}>
            <label>{index === 0 ? 'Directories' : ''}</label>
            <input value={dir} readOnly />
            <button
              onClick={() =>
                void save({
                  ...settings,
                  scriptdirs: settings.scriptdirs.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <div className="row">
          <label>{settings.scriptdirs.length === 0 ? 'Directories' : ''}</label>
          <button
            onClick={() => {
              void window.api.pickDirectory().then((d) => {
                if (d !== null) void save({ ...settings, scriptdirs: [...settings.scriptdirs, d] });
              });
            }}
          >
            Add script directory…
          </button>
        </div>
      </section>

      <section>
        <h3>Solver</h3>
        <p className="hint">
          Leave unset to use the bundled solver. Point at your own <code>combosolver.exe</code> (or
          a .mjs script for development) to override.
        </p>
        <div className="row">
          <label>Solver path</label>
          <input value={settings.solver.nativePath ?? ''} readOnly placeholder="bundled" />
          <button
            onClick={() => {
              void window.api.pickFile('solver').then((f) => {
                if (f !== null)
                  void save({ ...settings, solver: { ...settings.solver, nativePath: f } });
              });
            }}
          >
            Browse…
          </button>
          <button
            onClick={() => void save({ ...settings, solver: { ...settings.solver, nativePath: null } })}
          >
            Reset
          </button>
        </div>
      </section>

      {saved && <div className="saved">Saved</div>}
    </div>
  );
}
