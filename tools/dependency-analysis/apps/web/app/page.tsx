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
    <main className="psa-toolbox-landing">
      {/* Hero outside `.cisa-doc`: shared typography applies dark `h2`/`p` site-wide and breaks contrast on blue. */}
      <div className="psa-toolbox-landing__hero">
        <CisaCommandHero
          topbandSub="PSA Toolbox"
          eyebrow="PSA Toolbox"
          title="Assessment tools"
          subtitle="One workspace for dependency and continuity, hospitality security, modular site assessments, and facility-wide SAFE—open the tool that matches your engagement."
          cta={{ href: '#registered-tools', label: 'Browse registered tools' }}
          chips={[
            { label: 'Infrastructure', icon: 'sync' },
            { label: 'Hospitality', icon: 'shield' },
            { label: 'Reporting', icon: 'file' },
          ]}
          howItFitsHeading="How to choose"
          howItFits={[
            {
              title: 'Match the engagement',
              body: 'Pick the assessment that aligns with sector, facility type, and scope—IDA, HOST, Modular Site Assessment, or SAFE.',
            },
            {
              title: 'Stay in one tool',
              body: 'Complete the work in the application you started so responses and records stay in one place.',
            },
            {
              title: 'Close out in place',
              body: 'Use each tool’s review and export steps when the assessment is finished.',
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
            <header className="psa-toolbox-landing__tools-header">
              <div className="psa-toolbox-landing__tools-intro">
                <h2 className="psa-toolbox-section-title" id="registered-tools">
                  Registered tools
                </h2>
                <p className="psa-toolbox-section-lede">
                  Each link opens the tool’s web workspace in this site (or a registered external URL when noted).
                </p>
              </div>
              <ToolboxLandingClient />
            </header>
            <ul className="psa-toolbox-grid">
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
  );
}
