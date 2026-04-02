import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getToolById } from '@/lib/toolboxManifest';

type Props = { params: Promise<{ toolId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { toolId } = await params;
  const tool = await getToolById(toolId);
  if (!tool) return { title: 'Tool · PSA Toolbox' };
  return {
    title: `${tool.displayName} · PSA Toolbox`,
    description: tool.description,
  };
}

export default async function ToolWorkspacePage({ params }: Props) {
  const { toolId } = await params;
  const tool = await getToolById(toolId);
  if (!tool) notFound();

  if (tool.externalUrl?.trim()) {
    redirect(tool.externalUrl.trim());
  }

  const entry = tool.entryPath?.trim();
  if (entry) {
    const normalized = entry.endsWith('/') ? entry : `${entry}/`;
    redirect(normalized);
  }

  return (
    <main className="cisa-doc" style={{ maxWidth: 720, paddingTop: '1.5rem', paddingBottom: '2rem' }}>
      <h1 className="cisa-h1">{tool.displayName}</h1>
      <p className="cisa-lede">{tool.description}</p>
      <p className="cisa-meta">
        No <code>entryPath</code> or <code>externalUrl</code> in <code>tools-manifest.json</code> for this tool. Add one
        to open the primary UI from this route.
      </p>
    </main>
  );
}
