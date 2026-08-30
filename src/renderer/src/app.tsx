import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RunView } from './views/run-view';
import { SettingsView } from './views/settings-view';
import { useAppStore } from './store';
import './styles.css';

type Tab = 'run' | 'settings';

function App() {
  const [tab, setTab] = useState<Tab>('run');
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setHealth = useAppStore((s) => s.setHealth);
  const appendLines = useAppStore((s) => s.appendLines);
  const updateStatus = useAppStore((s) => s.updateStatus);

  useEffect(() => {
    void window.api.getSettings().then(async (loaded) => {
      setSettings(loaded);
      if (loaded.workdir !== null) setHealth(await window.api.probeWorkdir(loaded.workdir));
      // Until EDOPro is located, the run form can't produce a valid command.
      if (loaded.workdir === null) setTab('settings');
    });
    return window.api.onRunEvent((event) => {
      if (event.logBatch) appendLines(event.runId, event.logBatch);
      if (event.statusUpdate)
        updateStatus(
          event.runId,
          event.statusUpdate.status,
          event.statusUpdate.exitCode,
          event.statusUpdate.message,
        );
    });
  }, [setSettings, setHealth, appendLines, updateStatus]);

  if (settings === null) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === 'run' ? 'active' : ''} onClick={() => setTab('run')}>
          Run
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Settings
        </button>
      </nav>
      <main>{tab === 'run' ? <RunView /> : <SettingsView />}</main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
