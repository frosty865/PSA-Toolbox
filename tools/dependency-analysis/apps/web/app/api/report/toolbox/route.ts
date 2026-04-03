import { NextRequest, NextResponse } from 'next/server';
import { loadToolboxManifest } from '@/lib/toolboxManifest';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
  if (!reportServiceUrl) {
    return NextResponse.json(
      { error: 'Toolbox report requires REPORT_SERVICE_URL to be set to the hosted reporter endpoint.' },
      { status: 503 }
    );
  }

  const manifest = await loadToolboxManifest();
  if (!manifest) {
    return NextResponse.json(
      { error: 'Could not load tools-manifest.json' },
      { status: 500 }
    );
  }

  const sections = [
    {
      heading: 'Registered tools',
      bullets: manifest.tools.map((tool) => {
        const pathOrUrl = tool.entryPath?.trim() || tool.externalUrl?.trim() || tool.relativePath;
        return `${tool.displayName}: ${tool.description} (${pathOrUrl})`;
      }),
    },
  ];

  const res = await fetch(`${reportServiceUrl.replace(/\/$/, '')}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generic_report: {
        title: 'PSA Toolbox',
        subtitle: 'Registered tools report',
        sections,
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || `Reporter API ${res.status}` },
      { status: 502 }
    );
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="PSA-Toolbox-Report.docx"',
    },
  });
}
