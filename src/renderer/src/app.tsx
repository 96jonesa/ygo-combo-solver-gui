import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HistoryView } from './views/history-view';
import { RunView } from './views/run-view';
import { SettingsView } from './views/settings-view';
import { useAppStore } from './store';
import type { Tab } from './store';
import './styles.css';

const TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

function App() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setHealth = useAppStore((s) => s.setHealth);
  const appendLines = useAppStore((s) => s.appendLines);
  const setParsed = useAppStore((s) => s.setParsed);
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
      if (event.parsed) setParsed(event.runId, event.parsed);
      if (event.statusUpdate)
        updateStatus(
          event.runId,
          event.statusUpdate.status,
          event.statusUpdate.exitCode,
          event.statusUpdate.message,
        );
    });
  }, [setSettings, setHealth, setTab, appendLines, setParsed, updateStatus]);

  if (settings === null) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'run' ? <RunView /> : tab === 'history' ? <HistoryView /> : <SettingsView />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
