/**
 * Validates that a DOCX template contains required anchors exactly once.
 * Uses zip parse (word/document.xml) to extract text and find [[...]] anchors.
 * Uses REQUIRED_TEMPLATE_ANCHORS from schema as the authoritative list.
 */

import JSZip from 'jszip';
import fs from 'fs/promises';
import { REQUIRED_TEMPLATE_ANCHORS } from 'schema';

const ANCHOR_REGEX = /\[\[([^\]]+)\]\]/g;

export interface AnchorCount {
  anchor: string;
  count: number;
}

/**
 * Extract all [[...]] anchors from a DOCX file (paragraphs and table cells in word/document.xml).
 * Returns list of anchor strings with counts.
 */
export async function extractAnchorsFromDocx(templatePath: string): Promise<AnchorCount[]> {
  const buf = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file('word/document.xml');
  if (!entry) {
    throw new Error(`Template is not a valid DOCX: missing word/document.xml`);
  }
  const xml = await entry.async('string');
  const matches = [...xml.matchAll(ANCHOR_REGEX)];
  const fullMatch = matches.map((m) => m[0]);
  const countByAnchor = new Map<string, number>();
  for (const a of fullMatch) {
    countByAnchor.set(a, (countByAnchor.get(a) ?? 0) + 1);
  }
  return [...countByAnchor.entries()].map(([anchor, count]) => ({ anchor, count }));
}

const ANCHOR_HINT =
  'Open the DOCX and place the anchor on its own line where content should be inserted.';

/**
 * Validates that the template at templatePath contains every required anchor exactly once.
 * Fails with actionable diagnostics: template path, missing/duplicate anchors, and found anchors list.
 */
export async function validateTemplateAnchors(
  templatePath: string,
  anchors: readonly string[] = REQUIRED_TEMPLATE_ANCHORS
): Promise<void> {
  const required = [...anchors];
  const found = await extractAnchorsFromDocx(templatePath);
  const foundMap = new Map(found.map((f) => [f.anchor, f.count]));
  const errors: string[] = [];
  const missing: string[] = [];
  const duplicates: { anchor: string; count: number }[] = [];

  for (const anchor of required) {
    const count = foundMap.get(anchor) ?? 0;
    if (count === 0) {
      missing.push(anchor);
      errors.push(
        `Missing required anchor: ${anchor}\n  Template: ${templatePath}\n  Suggestion: ${ANCHOR_HINT}`
      );
    } else if (count > 1) {
      duplicates.push({ anchor, count });
      errors.push(`Duplicate anchor: ${anchor} (found ${count} times). Template: ${templatePath}`);
    }
  }

  if (errors.length > 0) {
    const foundList =
      found.length > 0
        ? `Found anchors in template:\n  ${found.map((f) => `${f.anchor} (${f.count}x)`).join('\n  ')}`
        : 'No [[...]] anchors found in template.';
    throw new Error(
      `Template anchor validation failed:\n\n${errors.join('\n\n')}\n\n${foundList}`
    );
  }
}

export type TemplateCheckResult = {
  ok: boolean;
  templatePath: string;
  missing: string[];
  duplicates: Array<{ anchor: string; count: number }>;
};

/**
 * Check template anchors without throwing. Returns ok, missing, and duplicates for API/UI.
 */
export async function checkTemplateAnchors(
  templatePath: string,
  anchors: readonly string[] = REQUIRED_TEMPLATE_ANCHORS
): Promise<TemplateCheckResult> {
  const required = [...anchors];
  let found: AnchorCount[];
  try {
    found = await extractAnchorsFromDocx(templatePath);
  } catch (e) {
    return {
      ok: false,
      templatePath,
      missing: required,
      duplicates: [],
    };
  }
  const foundMap = new Map(found.map((f) => [f.anchor, f.count]));
  const missing: string[] = [];
  const duplicates: Array<{ anchor: string; count: number }> = [];
  for (const anchor of required) {
    const count = foundMap.get(anchor) ?? 0;
    if (count === 0) missing.push(anchor);
    else if (count > 1) duplicates.push({ anchor, count });
  }
  return {
    ok: missing.length === 0 && duplicates.length === 0,
    templatePath,
    missing,
    duplicates,
  };
}

const validatedPaths = new Set<string>();

/**
 * Run validateTemplateAnchors once per template path and cache success.
 */
export async function validateTemplateAnchorsOnce(
  templatePath: string,
  anchors: readonly string[] = REQUIRED_TEMPLATE_ANCHORS
): Promise<void> {
  if (validatedPaths.has(templatePath)) return;
  await validateTemplateAnchors(templatePath, anchors);
  validatedPaths.add(templatePath);
}
