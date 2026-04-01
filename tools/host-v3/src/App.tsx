export function App() {
  return (
    <>
      <header className="site-security-header">
        <div className="site-security-header__brand">
          <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '0.02em' }}>
            PSA Toolbox · Host V3
          </span>
        </div>
        <nav className="site-security-header__nav" aria-label="Toolbox links">
          <a href="http://127.0.0.1:3000/">Toolbox home</a>
          <a href="http://127.0.0.1:3001/">This app</a>
        </nav>
      </header>
      <main className="cisa-doc">
        <h1 className="cisa-h1">Host V3</h1>
        <p className="cisa-lede">
          Branding and house styles come from the PSA Toolbox repo: <code>shared/psa-tokens.css</code> and{' '}
          <code>shared/cisa_styles.css</code> (imported in <code>src/main.tsx</code>).
        </p>
        <div className="cisa-card">
          <p style={{ margin: 0 }}>
            This shell runs on <strong>127.0.0.1:3001</strong>. Dependency analysis runs on <strong>:3000</strong>.
            Replace this content with your Host V3 product UI.
          </p>
        </div>
      </main>
    </>
  );
}
