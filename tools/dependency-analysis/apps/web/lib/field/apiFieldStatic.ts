/**
 * Client-only implementations for /lib/api.ts when NEXT_PUBLIC_FIELD_STATIC=1.
 * No fetch, no Node, no Python (field static build).
 */

import JSZip from 'jszip';
import { parseAssessment } from 'schema';
import type { Assessment } from 'schema';
import { buildSummary } from 'engine/summary';
import { assertExportReady, REQUIRED_ANCHORS } from 'engine/export/export_guard';
import { buildUiHelpDump } from '@/app/lib/help/uiHelpDump';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { collectAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { buildProgressFileV2 } from '@/app/lib/io/progressFile';
import type { DependencySessionsMap } from '@/app/lib/io/sessionTypes';
import {
  encryptRevisionPackageFromString,
  decryptRevisionPackageToString,
} from '@/app/lib/revision/revisionPackageBrowser';

const TOOL_VERSION = process.env.NEXT_PUBLIC_TOOL_VERSION ?? '0.1.0';

export async function getVofcReady(): Promise<{ ready: true } | { ready: false; error: string }> {
  return { ready: true };
}

type AnchorManifestVerified = {
  kind: 'verified';
  required: string[];
  anchors: Record<string, number>;
};

type AnchorManifestUnverified = {
  kind: 'unverified';
  required?: string[];
};

export async function getTemplateCheck(): Promise<{
  ok: boolean;
  templatePath: string;
  missing: string[];
  duplicates: Array<{ anchor: string; count: number }>;
}> {
  if (typeof window === 'undefined') {
    return { ok: true, templatePath: 'field-static', missing: [], duplicates: [] };
  }
  try {
    const basePath = (process.env.NEXT_PUBLIC_FIELD_STATIC_BASE_PATH ?? '').replace(/\/$/, '');
    let manifestUrl: string;
    if (basePath) {
      const manifestPath = `${basePath}/template-anchor-manifest.json`.replace(/\/+/g, '/');
      manifestUrl = new URL(manifestPath, window.location.origin).href;
    } else if (typeof document !== 'undefined' && document.location.protocol === 'file:') {
      const depthStr = document.documentElement.getAttribute('data-idt-out-depth');
      const depth = depthStr != null ? Number(depthStr) : 0;
      const pre = depth <= 0 ? './' : `${'../'.repeat(depth)}`;
      manifestUrl = new URL(`${pre}template-anchor-manifest.json`, window.location.href).href;
    } else {
      manifestUrl = new URL('/template-anchor-manifest.json', window.location.origin).href;
    }
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    if (!res.ok) {
      return { ok: true, templatePath: 'field-static', missing: [], duplicates: [] };
    }
    const data = (await res.json()) as AnchorManifestVerified | AnchorManifestUnverified | Record<string, unknown>;
    if (data.kind === 'unverified') {
      return { ok: true, templatePath: 'field-static-unverified', missing: [], duplicates: [] };
    }
    if (data.kind !== 'verified' || !data.anchors || !Array.isArray(data.required)) {
      return { ok: true, templatePath: 'field-static', missing: [], duplicates: [] };
    }
    const verified = data as AnchorManifestVerified;
    const missing: string[] = [];
    const duplicates: Array<{ anchor: string; count: number }> = [];
    for (const anchor of verified.required) {
      const c = verified.anchors[anchor] ?? 0;
      if (c === 0) missing.push(anchor);
      if (c > 1) duplicates.push({ anchor, count: c });
    }
    return {
      ok: missing.length === 0 && duplicates.length === 0,
      templatePath: 'field-static-manifest',
      missing,
      duplicates,
    };
  } catch {
    return { ok: true, templatePath: 'field-static', missing: [], duplicates: [] };
  }
}

function fieldReadmeText(): string {
  return [
    'Infrastructure Dependency Tool — field bundle (static)',
    '',
    'This ZIP was produced without a local DOCX report (no Python reporter on the workstation).',
    'Contents: revision.pkg (encrypted assessment), optional sessions.pkg, ui_help_dump.json.',
    'For the canonical JSON export, use Review & Export → Export JSON (canonical) or Final export on New Assessment.',
    '',
  ].join('\n');
}

export async function exportDraft(
  assessment: Assessment,
  passphrase: string,
  sessions?: DependencySessionsMap
): Promise<Blob> {
  const trimmed = passphrase.trim();
  if (trimmed.length < 12) {
    throw new Error('passphrase must be at least 12 characters to encrypt the revision package');
  }
  const vofcCollection = buildVofcCollectionFromAssessment(assessment);
  const summary = buildSummary(assessment);
  assertExportReady({
    assessment,
    summary,
    vofcs: vofcCollection,
    requiredAnchors: [...REQUIRED_ANCHORS],
  });

  const revisionJson = JSON.stringify(assessment);
  const revisionPkg = await encryptRevisionPackageFromString(revisionJson, trimmed);

  const zip = new JSZip();
  zip.file('FIELD_BUNDLE.txt', fieldReadmeText());
  zip.file('revision.pkg', revisionPkg);
  zip.file('ui_help_dump.json', JSON.stringify(buildUiHelpDump(), null, 2));
  if (sessions && Object.keys(sessions).length > 0) {
    const sessBuf = await encryptRevisionPackageFromString(JSON.stringify(sessions), trimmed);
    zip.file('sessions.pkg', sessBuf);
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
}

export async function exportFinal(
  assessment: Assessment,
  _options?: {
    timeoutMs?: number;
    energy_dependency?: unknown;
    dependency_sections?: unknown;
  }
): Promise<Blob> {
  const sanitized = sanitizeAssessmentBeforeSave(assessment);
  const sessions = collectAllSessionsFromLocalStorage();
  const file = buildProgressFileV2(sanitized, sessions);
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
}

export async function exportRevisionPackage(assessment: Assessment, passphrase: string): Promise<Blob> {
  const trimmed = passphrase.trim();
  if (!trimmed) throw new Error('passphrase required');
  const payload = JSON.stringify(parseAssessment(assessment as unknown));
  const pkg = await encryptRevisionPackageFromString(payload, trimmed);
  return new Blob([new Uint8Array(pkg)], { type: 'application/octet-stream' });
}

export async function getRevisionPackageMetadata(
  file: File,
  passphrase: string
): Promise<{
  tool_version: string;
  template_version: string;
  created_at_iso: string;
  current_tool_version: string;
}> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let revisionBuf: Uint8Array;
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf);
    const revisionEntry = zip.file('revision.pkg');
    if (!revisionEntry) throw new Error('ZIP missing revision.pkg');
    revisionBuf = new Uint8Array(await revisionEntry.async('arraybuffer'));
  } else {
    revisionBuf = buf;
  }
  const jsonText = await decryptRevisionPackageToString(revisionBuf, passphrase);
  const json = JSON.parse(jsonText) as { meta?: Record<string, unknown> };
  const meta = json?.meta;
  if (
    !meta ||
    typeof meta !== 'object' ||
    typeof (meta as { tool_version?: unknown }).tool_version !== 'string' ||
    typeof (meta as { template_version?: unknown }).template_version !== 'string' ||
    typeof (meta as { created_at_iso?: unknown }).created_at_iso !== 'string'
  ) {
    throw new Error('Invalid revision package: missing meta');
  }
  return {
    tool_version: (meta as { tool_version: string }).tool_version,
    template_version: (meta as { template_version: string }).template_version,
    created_at_iso: (meta as { created_at_iso: string }).created_at_iso,
    current_tool_version: TOOL_VERSION,
  };
}

export async function importRevisionPackage(
  file: File,
  passphrase: string
): Promise<{ assessment: Assessment; sessions?: DependencySessionsMap }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let revisionBuf: Uint8Array;
  let sessionsBuf: Uint8Array | null = null;

  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf);
    const revisionEntry = zip.file('revision.pkg');
    if (!revisionEntry) throw new Error('ZIP missing revision.pkg');
    revisionBuf = new Uint8Array(await revisionEntry.async('arraybuffer'));
    const sessionsEntry = zip.file('sessions.pkg');
    if (sessionsEntry) {
      sessionsBuf = new Uint8Array(await sessionsEntry.async('arraybuffer'));
    }
  } else {
    revisionBuf = buf;
  }

  const jsonText = await decryptRevisionPackageToString(revisionBuf, passphrase);
  const json = JSON.parse(jsonText);
  const assessment = parseAssessment(json);

  let sessions: DependencySessionsMap | undefined;
  if (sessionsBuf) {
    try {
      const sessionsPlain = await decryptRevisionPackageToString(sessionsBuf, passphrase);
      const parsed = JSON.parse(sessionsPlain);
      if (parsed && typeof parsed === 'object') {
        sessions = parsed as DependencySessionsMap;
      }
    } catch {
      // ignore invalid sessions
    }
  }

  return { assessment, sessions };
}
