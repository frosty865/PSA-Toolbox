import { NextRequest, NextResponse } from 'next/server';

import { getToolById, loadToolboxManifest } from '@/lib/toolboxManifest';

export const dynamic = 'force-dynamic';

function toolSections(tool: NonNullable<Awaited<ReturnType<typeof getToolById>>>) {
  return [
    {
      heading: 'Overview',
      paragraphs: [tool.description],
      bullets: [
        `Tool ID: ${tool.id}`,
        `App path: ${tool.relativePath}`,
        tool.entryPath ? `Web route: ${tool.entryPath}` : null,
        tool.externalUrl ? `External URL: ${tool.externalUrl}` : null,
      ].filter((item): item is string => Boolean(item)),
    },
  ];
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ toolId: string }> }
) {
  const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
  if (!reportServiceUrl) {
    return NextResponse.json(
      { error: 'Tool report requires REPORT_SERVICE_URL to be set to the hosted reporter endpoint.' },
      { status: 503 }
    );
  }

  const { toolId } = await context.params;
  const tool = await getToolById(toolId);
  if (!tool) {
    return NextResponse.json({ error: `Unknown tool: ${toolId}` }, { status: 404 });
  }

  const manifest = await loadToolboxManifest();
  const sections = [
    ...toolSections(tool),
    {
      heading: 'Registered tools',
      bullets: manifest?.tools.map((item) => `${item.displayName} (${item.entryPath?.trim() || item.externalUrl?.trim() || item.relativePath})`) ?? [],
    },
  ];

  const res = await fetch(`${reportServiceUrl.replace(/\/$/, '')}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generic_report: {
        title: tool.displayName,
        subtitle: 'Tool overview report',
        header_left: tool.displayName,
        header_right: tool.id,
        footer_left: 'Hosted DOCX report',
        footer_right: `Generated from ${tool.relativePath}`,
        sections,
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || `Reporter API ${res.status}` }, { status: 502 });
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${tool.id}-report.docx"`,
    },
  });
}
