import React, { useState } from 'react';
import { useAppStore } from '../store';

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
          </div>
        )}
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
