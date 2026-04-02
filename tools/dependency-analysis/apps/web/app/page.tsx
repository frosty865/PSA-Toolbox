import type { Metadata } from 'next';
import { loadToolboxManifest } from '@/lib/toolboxManifest';
import type { ToolboxManifestTool } from '@/lib/toolboxManifest';
import { ToolboxLandingClient } from '@/components/ToolboxLandingClient';
import { CisaCommandHero } from '@/components/CisaCommandHero';

export const metadata: Metadata = {
  title: 'PSA Toolbox · DHS',
  description:
    'U.S. Department of Homeland Security — PSA Toolbox: Infrastructure Dependency Assessment, Hotel Analysis (HOST), and CISA Site Assessment (PSA Rebuild at /cisa-site-assessment/).',
  applicationName: 'PSA Toolbox',
};

function defaultToolHref(tool: ToolboxManifestTool): string {
  if (tool.entryPath?.trim()) return tool.entryPath.trim();
  if (tool.externalUrl?.trim()) return tool.externalUrl.trim();
  return `/t/${tool.id}/`;
}

/** Stable launch targets (do not rely on manifest alone; matches next.config rewrites for HOST). */
function launchHref(tool: ToolboxManifestTool): string {
  if (tool.id === 'hotel-analysis') return '/hotel-analysis/';
  if (tool.id === 'dependency-analysis') return '/assessment/categories/';
  if (tool.id === 'cisa-site-assessment') return '/cisa-site-assessment/';
  if (tool.externalUrl?.trim()) return tool.externalUrl.trim();
  return defaultToolHref(tool);
}

function ToolCard({ tool }: { tool: ToolboxManifestTool }) {
  const href = launchHref(tool);
  const isCisa = tool.id === 'cisa-site-assessment';
  const label =
    isCisa
      ? tool.entryPath?.trim() ?? href
      : tool.externalUrl?.trim() ?? tool.entryPath?.trim() ?? href;

  const body = (
    <>
      <h2 className="cisa-h2" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        {tool.displayName}
      </h2>
      <p style={{ margin: '0.5rem 0 0', maxWidth: 'none' }}>{tool.description}</p>
      <p className="cisa-meta" style={{ marginTop: '0.75rem' }}>
        {label}
      </p>
    </>
  );

  if (tool.externalUrl?.trim() && !isCisa) {
    return (
      <a
        href={tool.externalUrl.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className="cisa-card"
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </a>
    );
  }

  return (
    <a href={href} className="cisa-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {body}
    </a>
  );
}

export default async function ToolboxLandingPage() {
  const manifest = await loadToolboxManifest();

  return (
    <>
      <ToolboxLandingClient />
      <main className="cisa-doc" style={{ maxWidth: 960, paddingTop: '2rem', paddingBottom: '3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <CisaCommandHero
            topbandSub="PSA Toolbox"
            eyebrow="Assessment command center"
            title="PSA Toolbox"
            subtitle="Choose a registered tool to run structured DHS-aligned workflows: Infrastructure Dependency Assessment in this app, Hotel Analysis (HOST) at /hotel-analysis/, and the full CISA Site Assessment (PSA Rebuild) at /cisa-site-assessment/. Tools are listed in tools-manifest.json at the repository root."
            cta={{ href: '#registered-tools', label: 'Open registered tools' }}
            chips={[
              { label: 'Registry-driven catalog', icon: 'sync' },
              { label: 'Report-ready workflows', icon: 'file' },
              { label: 'DHS / CISA patterns', icon: 'shield' },
            ]}
            howItFits={[
              {
                title: 'Assess',
                body: 'Pick a tool from the manifest and open its entry path or bundled app.',
              },
              {
                title: 'Analyze',
                body: 'Complete section workflows with autosave and validation where the tool provides it.',
              },
              {
                title: 'Deliver',
                body: 'Export or hand off artifacts per each tool’s review and reporting flow.',
              },
            ]}
          />
          <h1 className="cisa-h1" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            PSA Toolbox
          </h1>
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
            id="registered-tools"
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
    </>
  );
}
