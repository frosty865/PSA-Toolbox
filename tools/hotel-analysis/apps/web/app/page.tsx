import type { Metadata } from 'next';
import { loadToolboxManifest } from '@/lib/toolboxManifest';
import type { ToolboxManifestTool } from '@/lib/toolboxManifest';
import { ToolboxLandingClient } from '@/components/ToolboxLandingClient';
import { CisaCommandHero } from '@/components/CisaCommandHero';
import '@/styles/toolbox-landing.css';

export const metadata: Metadata = {
  title: 'PSA Toolbox | CISA',
  description:
    'Unified workspace for PSA assessment tools registered in tools-manifest.json.',
  applicationName: 'PSA Toolbox',
};

/** Same-origin link: prefer entryPath so removing a tool from the manifest does not require code edits here. */
function toolCardHref(tool: ToolboxManifestTool): string {
  const entry = tool.entryPath?.trim();
  if (entry) return entry.endsWith('/') ? entry : `${entry}/`;
  if (tool.externalUrl?.trim()) return tool.externalUrl.trim();
  return `/t/${tool.id}/`;
}

/** Open in a new tab only when there is no same-origin entryPath (external-only tools). */
function toolCardIsExternal(tool: ToolboxManifestTool): boolean {
  return Boolean(tool.externalUrl?.trim()) && !tool.entryPath?.trim();
}

function ToolCard({ tool }: { tool: ToolboxManifestTool }) {
  const href = toolCardHref(tool);
  const isExternal = toolCardIsExternal(tool);

  const body = (
    <>
      <h2 className="cisa-h2" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        {tool.displayName}
      </h2>
      <p className="psa-tool-card__lede">{tool.description}</p>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={tool.externalUrl!.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className="cisa-card psa-tool-card"
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </a>
    );
  }

  return (
    <a href={href} className="cisa-card psa-tool-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {body}
    </a>
  );
}

export default async function ToolboxLandingPage() {
  const manifest = await loadToolboxManifest();

  return (
    <>
      <ToolboxLandingClient />
      <main className="psa-toolbox-landing">
        {/* Hero outside `.cisa-doc`: shared typography applies dark `h2`/`p` site-wide and breaks contrast on blue. */}
        <div style={{ paddingBottom: 0 }}>
          <CisaCommandHero
            topbandSub="PSA Toolbox"
            eyebrow="PSA Toolbox"
            title="Assessment tools"
            subtitle="Open dependency analysis, hotel security, modular site assessment, or SAFE—pick the tool that fits your work."
            cta={{ href: '#registered-tools', label: 'Choose a tool' }}
            chips={[]}
            howItFitsHeading="How to choose"
            howItFits={[
              {
                title: 'Match the engagement',
                body: 'Dependency and continuity, hospitality operational security, modular PSA assessments by sector and subsector, or facility-wide SAFE assessments—open the tool that matches.',
              },
              {
                title: 'Stay in one tool',
                body: 'Complete the assessment in the application you started so the record stays consistent.',
              },
              {
                title: 'Finish there',
                body: 'Use that tool’s review and reporting steps when the assessment is done.',
              },
            ]}
          />
          <h1
            className="cisa-h1"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            PSA Toolbox
          </h1>
        </div>

        <div className="cisa-doc psa-toolbox-landing__tools">
          {!manifest ? (
            <div className="cisa-callout cisa-callout--warning" role="alert">
              <strong>Could not load tools-manifest.json.</strong> Run the app from the PSA Toolbox clone (or set{' '}
              <code>PSA_TOOLBOX_ROOT</code> to the repo root) so the manifest can be found.
            </div>
          ) : manifest.tools.length === 0 ? (
            <p className="cisa-meta">No tools are defined in the manifest yet.</p>
          ) : (
            <>
              <h2 className="psa-toolbox-section-title" id="registered-tools">
                Registered tools
              </h2>
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
            </>
          )}
        </div>
      </main>
    </>
  );
}
