import Link from 'next/link';
import type { Metadata } from 'next';
import { loadToolboxManifest } from '@/lib/toolboxManifest';
import type { ToolboxManifestTool } from '@/lib/toolboxManifest';

export const metadata: Metadata = {
  title: 'PSA Toolbox',
  description: 'Launch PSA tools from a single place. Tools are listed from tools-manifest.json at the repository root.',
  applicationName: 'PSA Toolbox',
};

function ToolCard({ tool }: { tool: ToolboxManifestTool }) {
  const body = (
    <>
      <h2 className="cisa-h2" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        {tool.displayName}
      </h2>
      <p style={{ margin: '0.5rem 0 0', maxWidth: 'none' }}>{tool.description}</p>
      {tool.externalUrl || tool.entryPath ? (
        <p className="cisa-meta" style={{ marginTop: '0.75rem' }}>
          {tool.externalUrl ?? tool.entryPath}
        </p>
      ) : null}
    </>
  );

  if (tool.externalUrl) {
    return (
      <a
        href={tool.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cisa-card"
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </a>
    );
  }

  if (tool.entryPath) {
    return (
      <Link
        href={tool.entryPath}
        className="cisa-card"
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="cisa-card" style={{ opacity: 0.92 }}>
      {body}
      <p className="cisa-meta" style={{ marginTop: '0.75rem' }}>
        No web entry yet — add <code>entryPath</code> or <code>externalUrl</code> for this tool in{' '}
        <code>tools-manifest.json</code>.
      </p>
    </div>
  );
}

export default async function ToolboxLandingPage() {
  const manifest = await loadToolboxManifest();

  return (
    <main className="cisa-doc" style={{ maxWidth: 960, paddingTop: '2rem', paddingBottom: '3rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="cisa-h1" style={{ marginBottom: '0.5rem' }}>
          PSA Toolbox
        </h1>
        <p className="cisa-lede" style={{ margin: 0 }}>
          Select a tool to open. New imports appear here automatically when added to{' '}
          <code style={{ fontSize: '0.95em' }}>tools-manifest.json</code> at the repository root.
        </p>
      </header>

      {!manifest ? (
        <div className="cisa-callout cisa-callout--warning" role="alert">
          <strong>Could not load tools-manifest.json.</strong> Run the app from the PSA Toolbox clone (or set{' '}
          <code>PSA_TOOLBOX_ROOT</code> to the repo root) so the manifest can be found.
        </div>
      ) : manifest.tools.length === 0 ? (
        <p className="cisa-meta">No tools are defined in the manifest yet.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {manifest.tools.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
