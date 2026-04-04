import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type GenericReportSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type GenericReportPayload = {
  generic_report: {
    title: string;
    subtitle?: string;
    header_left?: string;
    header_right?: string;
    footer_left?: string;
    footer_right?: string;
    sections?: GenericReportSection[];
  };
};

export async function POST(request: NextRequest) {
  const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
  if (!reportServiceUrl) {
    return NextResponse.json(
      {
        error:
          'Generic DOCX export requires a hosted reporter service. Set REPORT_SERVICE_URL to the Railway ADA reporter endpoint.',
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Partial<GenericReportPayload>;
  const genericReport = body.generic_report;
  if (!genericReport || typeof genericReport !== 'object') {
    return NextResponse.json(
      { error: 'generic_report payload required' },
      { status: 400 }
    );
  }
  if (typeof genericReport.title !== 'string' || !genericReport.title.trim()) {
    return NextResponse.json(
      { error: 'generic_report.title required' },
      { status: 400 }
    );
  }

  const res = await fetch(`${reportServiceUrl.replace(/\/$/, '')}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generic_report: genericReport }),
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
      'Content-Disposition': 'attachment; filename="report.docx"',
    },
  });
}
