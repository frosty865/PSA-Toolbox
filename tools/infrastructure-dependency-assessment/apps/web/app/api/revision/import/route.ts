import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { parseAssessment } from 'schema';
import { decryptRevisionSync } from 'security';
import { purgeAll, getRepoRoot } from '@/app/lib/purge/purgeAll';
import type { DependencySessionsMap } from '@/app/lib/io/sessionTypes';

export const dynamic = 'force-static';

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

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
    let sessionsBuf: Buffer | null = null;

    if (isZip(buf)) {
      const zip = await JSZip.loadAsync(buf);
      const revisionEntry = zip.file('revision.pkg');
      if (!revisionEntry) {
        return NextResponse.json({ error: 'ZIP missing revision.pkg' }, { status: 400 });
      }
      revisionBuf = Buffer.from(await revisionEntry.async('arraybuffer'));
      const sessionsEntry = zip.file('sessions.pkg');
      if (sessionsEntry) {
        sessionsBuf = Buffer.from(await sessionsEntry.async('arraybuffer'));
      }
    } else {
      revisionBuf = buf;
    }

    const plaintext = decryptRevisionSync(revisionBuf, passphrase);
    const json = JSON.parse(plaintext.toString('utf-8'));
    const assessment = parseAssessment(json);

    let sessions: DependencySessionsMap | undefined;
    if (sessionsBuf) {
      try {
        const sessionsPlain = decryptRevisionSync(sessionsBuf, passphrase);
        const parsed = JSON.parse(sessionsPlain.toString('utf-8'));
        if (parsed && typeof parsed === 'object') {
          sessions = parsed as DependencySessionsMap;
        }
      } catch {
        // sessions.pkg invalid or wrong passphrase; proceed without sessions
      }
    }

    return NextResponse.json({ assessment, sessions });
  } catch (e) {
    await purgeAll(getRepoRoot()).catch(() => {});
    const message = e instanceof Error ? e.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
