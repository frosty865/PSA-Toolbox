import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getToolById } from '@/lib/toolboxManifest';
import { ToolWorkspaceClient } from '@/components/ToolWorkspaceClient';

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

  const entry = tool.entryPath?.trim();
  const external = tool.externalUrl?.trim();
  const href = entry ? (entry.endsWith('/') ? entry : `${entry}/`) : external ?? null;

  return (
    <main className="cisa-doc" style={{ maxWidth: 720, paddingTop: '1.5rem', paddingBottom: '2rem' }}>
      <h1 className="cisa-h1">{tool.displayName}</h1>
      <p className="cisa-lede">{tool.description}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {href ? (
          <Link href={href} className="cisa-button">
            Open tool
          </Link>
        ) : null}
        <ToolWorkspaceClient toolId={tool.id} downloadName={`${tool.id}-report.docx`} />
      </div>
      <p className="cisa-meta" style={{ marginTop: '1rem' }}>
        Tool report uses the hosted DOCX service and the shared template. Each tool can generate its own report from
        this page.
      </p>
    </main>
  );
}
