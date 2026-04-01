import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { decryptRevisionSync } from 'security';

export const dynamic = 'force-static';

const CURRENT_TOOL_VERSION = process.env.TOOL_VERSION ?? '0.1.0';

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

/**
 * Decrypt revision package and return metadata only. No persistence.
 * Accepts either revision.pkg or draft ZIP (extracts revision.pkg).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const passphrase = formData.get('passphrase') as string | null;
    if (!file || !passphrase) {
      return NextResponse.json(
        { error: 'file and passphrase required' },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    let revisionBuf: Buffer;
    if (isZip(buf)) {
      const zip = await JSZip.loadAsync(buf);
      const revisionEntry = zip.file('revision.pkg');
      if (!revisionEntry) {
        return NextResponse.json({ error: 'ZIP missing revision.pkg' }, { status: 400 });
      }
      revisionBuf = Buffer.from(await revisionEntry.async('arraybuffer'));
    } else {
      revisionBuf = buf;
    }
    const plaintext = decryptRevisionSync(revisionBuf, passphrase);
    const json = JSON.parse(plaintext.toString('utf-8'));
    const meta = json?.meta;
    if (!meta || typeof meta.tool_version !== 'string' || typeof meta.template_version !== 'string' || typeof meta.created_at_iso !== 'string') {
      return NextResponse.json(
        { error: 'Invalid revision package: missing meta' },
        { status: 400 }
      );
    }
    return NextResponse.json({
      tool_version: meta.tool_version,
      template_version: meta.template_version,
      created_at_iso: meta.created_at_iso,
      current_tool_version: CURRENT_TOOL_VERSION,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read package';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
