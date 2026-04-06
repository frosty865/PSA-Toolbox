/**
 * Client-only implementations for /lib/api.ts when NEXT_PUBLIC_FIELD_STATIC=1.
 * No fetch, no Node, no Python (field static build).
 */

import type { Assessment } from 'schema';
import { buildSummary } from 'engine/summary';
import { assertExportReady, REQUIRED_ANCHORS } from 'engine/export/export_guard';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { collectAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { buildProgressFileV2 } from '@/app/lib/io/progressFile';

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

export async function exportDraft(
  assessment: Assessment
): Promise<Blob> {
  const vofcCollection = buildVofcCollectionFromAssessment(assessment);
  const summary = buildSummary(assessment);
  assertExportReady({
    assessment,
    summary,
    vofcs: vofcCollection,
    requiredAnchors: [...REQUIRED_ANCHORS],
  });
  const sessions = collectAllSessionsFromLocalStorage();
  const file = buildProgressFileV2(sanitizeAssessmentBeforeSave(assessment), sessions);
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
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
