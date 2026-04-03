import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { Writable } from 'stream';
import { randomUUID } from 'crypto';
import archiver from 'archiver';
import { parseAssessment } from 'schema';
import { encryptRevisionSync } from 'security';
import type { DependencySessionsMap } from '@/app/lib/io/sessionTypes';
import { buildSummary, assertExportReady, REQUIRED_ANCHORS } from 'engine';
import { validateTemplateAnchorsOnce } from '@/app/lib/template/validateAnchors';
import { getRepoRoot, getTemplatePath, getWritableTempBase } from '@/app/lib/template/path';
import { purgeAll } from '@/app/lib/purge/purgeAll';
import { buildUiHelpDump } from '@/app/lib/help/uiHelpDump';
import { buildSlaReliabilityForReport } from '@/app/lib/export/sla_report_helpers';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';

export const dynamic = 'force-static';

const TOOL_VERSION = process.env.TOOL_VERSION ?? '0.1.0';

export async function POST(request: NextRequest) {
  let workDir: string | null = null;
  try {
    const body = await request.json();
    const { assessment: raw, passphrase, sessions } = body as { assessment: unknown; passphrase?: string; sessions?: DependencySessionsMap };
    if (!passphrase || typeof passphrase !== 'string') {
      return NextResponse.json(
        { error: 'passphrase required for draft export' },
        { status: 400 }
      );
    }
    const trimmed = passphrase.trim();
    if (trimmed.length < 12) {
      return NextResponse.json(
        { error: 'passphrase must be at least 12 characters to encrypt the revision package' },
        { status: 400 }
      );
    }
    const assessment = parseAssessment(raw);
    const reportServiceUrl = process.env.REPORT_SERVICE_URL?.trim();
    if (!reportServiceUrl) {
      return NextResponse.json(
        { error: 'Draft export requires a hosted reporter service. Set REPORT_SERVICE_URL to the Railway ADA reporter endpoint.' },
        { status: 503 }
      );
    }
    const repoRoot = getRepoRoot();
    const tempBase = getWritableTempBase(repoRoot);
    workDir = path.join(tempBase, randomUUID());
    await fs.mkdir(workDir, { recursive: true });

    const vofcCollection = buildVofcCollectionFromAssessment(assessment);
    const summary = buildSummary(assessment);
    assertExportReady({
      assessment,
      summary,
      vofcs: vofcCollection,
      requiredAnchors: [...REQUIRED_ANCHORS],
    });

    await validateTemplateAnchorsOnce(getTemplatePath());

    const templatePath = getTemplatePath();
    const sla_reliability_for_report = buildSlaReliabilityForReport(assessment);
    const docxBytes = await callRemoteReporter(reportServiceUrl, {
      assessment,
      vofc_collection: vofcCollection,
      sla_reliability_for_report,
    });

    const revisionPayload = Buffer.from(JSON.stringify(assessment), 'utf-8');
    const revisionPackage = encryptRevisionSync(revisionPayload, trimmed);
    const helpDump = buildUiHelpDump();
    const helpDumpJson = Buffer.from(JSON.stringify(helpDump, null, 2), 'utf-8');

    const sessionsPackage = (sessions && Object.keys(sessions).length > 0)
      ? encryptRevisionSync(Buffer.from(JSON.stringify(sessions), 'utf-8'), trimmed)
      : null;

    const zip = await createZip(docxBytes, revisionPackage, helpDumpJson, sessionsPackage);
    await purgeAll(repoRoot);
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="draft-report-and-revision.zip"',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    if (workDir) await rmSafe(workDir);
    try {
      await purgeAll(getRepoRoot());
    } catch (_) {}
  }
}

async function callRemoteReporter(baseUrl: string, payload: object): Promise<Buffer> {
  const url = `${baseUrl.replace(/\/$/, '')}/render`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reporter API ${res.status}: ${text || res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function createZip(
  docxBytes: Buffer,
  revisionBytes: Buffer,
  helpDumpJson: Buffer,
  sessionsBytes: Buffer | null
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(writable);
  archive.append(docxBytes, { name: 'report.docx' });
  archive.append(revisionBytes, { name: 'revision.pkg' });
  archive.append(helpDumpJson, { name: 'ui_help_dump.json' });
  if (sessionsBytes) {
    archive.append(sessionsBytes, { name: 'sessions.pkg' });
  }
  archive.finalize();
  return new Promise((resolve, reject) => {
    writable.on('finish', () => resolve(Buffer.concat(chunks)));
    writable.on('error', reject);
    archive.on('error', reject);
  });
}

async function rmSafe(p: string) {
  try {
    await fs.rm(p, { recursive: true });
  } catch (_) {}
}
