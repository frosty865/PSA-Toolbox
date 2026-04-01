export function App() {
  return (
    <main className="host-shell">
      <h1>Host V3</h1>
      <p className="host-lede">
        This app runs in <strong>tools/host-v3</strong> on{' '}
        <a href="http://127.0.0.1:3001/">http://127.0.0.1:3001/</a> (Vite + React). Dependency analysis stays on port 3000.
      </p>
      <p className="host-meta">
        Replace this scaffold with your Host V3 product code, or keep it as a thin shell and link APIs from{' '}
        <code>tools-manifest.json</code>.
      </p>
    </main>
  );
}
