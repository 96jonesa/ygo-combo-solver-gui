import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <div className="app">
      <h1>ygo-combo-solver GUI</h1>
      <p>Skeleton build — run and settings views land with the IPC layer.</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
