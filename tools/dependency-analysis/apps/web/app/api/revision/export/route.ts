import { NextRequest, NextResponse } from 'next/server';
import { parseAssessment } from 'schema';
import { encryptRevisionSync } from 'security';

export const dynamic = 'force-static';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assessment: raw, passphrase } = body as { assessment: unknown; passphrase: string };
    if (!passphrase || typeof passphrase !== 'string') {
      return NextResponse.json({ error: 'passphrase required' }, { status: 400 });
    }
    const assessment = parseAssessment(raw);
    const payload = Buffer.from(JSON.stringify(assessment), 'utf-8');
    const pkg = encryptRevisionSync(payload, passphrase);
    return new NextResponse(new Uint8Array(pkg), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="revision.pkg"',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
