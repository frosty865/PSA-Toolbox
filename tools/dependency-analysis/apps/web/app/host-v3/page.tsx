import Link from 'next/link';

export default function HostV3Page() {
  return (
    <>
      <header className="site-security-header">
        <div className="site-security-header__brand">
          <span style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '0.02em' }}>
            PSA Toolbox · Host V3
          </span>
        </div>
        <nav className="site-security-header__nav" aria-label="Toolbox">
          <Link href="/">Toolbox home</Link>
          <Link href="/host-v3/">Host V3</Link>
          <Link href="/assessment/categories/">Dependency analysis</Link>
        </nav>
      </header>
      <main className="cisa-doc">
        <h1 className="cisa-h1">Host V3</h1>
        <p className="cisa-lede">
          This route is part of the <strong>unified Next.js app</strong> (single origin, single <code>pnpm dev</code> in{' '}
          <code>tools/dependency-analysis</code>). Branding comes from the repo{' '}
          <code>shared/psa-tokens.css</code> and <code>shared/cisa_styles.css</code> via the root layout.
        </p>
        <div className="cisa-card">
          <p style={{ margin: 0 }}>
            Standalone <strong>product</strong> files (assets, docs, future packages) can live under{' '}
            <code>tools/host-v3/</code> and be imported here as the Host V3 surface grows.
          </p>
        </div>
      </main>
    </>
  );
}
