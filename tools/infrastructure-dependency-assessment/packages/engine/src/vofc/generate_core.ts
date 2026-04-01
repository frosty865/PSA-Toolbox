/**
 * Client-safe VOFC generation from in-memory entries (no Node fs/path/xlsx).
 * Used by engine/client and by generate.ts (which adds the file-loading path).
 */
import type { Assessment, VOFC, VOFCCollection } from "schema";
import type { InternalVofcEntry } from "./library_types";
import {
  MAX_VOFC_PER_CATEGORY,
  SEVERITY_ORDER,
  APPLICABILITY_ORDER,
} from "./map_doctrine";
import { evaluateTriggers } from "./evaluate_triggers";
import { normalizeVOFC } from "./normalize";
import { calibrateSeverity } from "./calibrate_severity";
import { assertMAPCompliance } from "./map_guard";
import { buildSummary } from "../summary";

const SEVERITY_RANK: Record<string, number> = Object.fromEntries(
  SEVERITY_ORDER.map((s, i) => [s, SEVERITY_ORDER.length - 1 - i])
);
const APPLICABILITY_RANK: Record<string, number> = Object.fromEntries(
  APPLICABILITY_ORDER.map((a, i) => [a, APPLICABILITY_ORDER.length - 1 - i])
);

function compareByMap(a: VOFC, b: VOFC): number {
  const sev = SEVERITY_RANK[b.calibrated_severity] - SEVERITY_RANK[a.calibrated_severity];
  if (sev !== 0) return sev;
  const app = APPLICABILITY_RANK[b.applicability] - APPLICABILITY_RANK[a.applicability];
  if (app !== 0) return app;
  return a.vofc_id.localeCompare(b.vofc_id);
}

const OUT_OF_SCOPE_VULNERABILITY_PHRASES = [
  "access control",
  "access controls",
  "exterior ids",
  "exterior intrusion",
  "intrusion detection",
] as const;

function normalizedScopeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOutOfScopeEntry(entry: InternalVofcEntry): boolean {
  const raw = [
    entry.vulnerability ?? "",
    entry.title ?? "",
    entry.option_for_consideration ?? "",
  ].join(" ");
  const text = normalizedScopeText(raw);
  return OUT_OF_SCOPE_VULNERABILITY_PHRASES.some((phrase) =>
    text.includes(normalizedScopeText(phrase))
  );
}

export function runGeneration(assessment: Assessment, entries: InternalVofcEntry[]): VOFCCollection {
  const byId = new Map<string, VOFC>();
  const summary = buildSummary(assessment);

  for (const entry of entries) {
    if (isOutOfScopeEntry(entry)) continue;
    const { matched, applicability } = evaluateTriggers(
      entry.trigger_conditions,
      assessment,
      entry.category
    );
    if (!matched) continue;
    if (byId.has(entry.vofc_id)) continue;

    const vofc: VOFC = {
      vofc_id: entry.vofc_id,
      category: entry.category,
      title: entry.title,
      vulnerability: entry.vulnerability,
      impact: entry.impact,
      option_for_consideration: entry.option_for_consideration,
      base_severity: entry.severity,
      calibrated_severity: entry.severity,
      calibration_reason: null,
      applicability,
      source_ref: entry.source_ref,
      origin: entry.origin ?? "SOURCE",
      source_registry_id: entry.source_registry_id ?? undefined,
      source_tier: entry.source_tier ?? undefined,
      source_publisher: entry.source_publisher ?? undefined,
    };
    const normalized = normalizeVOFC(vofc);
    const { calibrated, reason } = calibrateSeverity(normalized, assessment, summary);
    normalized.calibrated_severity = calibrated;
    normalized.calibration_reason = reason;
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && calibrated !== entry.severity) {
      console.log(`[VOFC CALIBRATION] ${entry.vofc_id}: ${entry.severity} → ${calibrated}`);
    }
    byId.set(entry.vofc_id, normalized);
  }

  let items = [...byId.values()];
  items.sort(compareByMap);

  const byCategory = new Map<string, VOFC[]>();
  for (const v of items) {
    const list = byCategory.get(v.category) ?? [];
    list.push(v);
    byCategory.set(v.category, list);
  }

  const capped: VOFC[] = [];
  const categoryOrder = [...byCategory.keys()].sort();
  for (const cat of categoryOrder) {
    const list = byCategory.get(cat) ?? [];
    capped.push(...list.slice(0, MAX_VOFC_PER_CATEGORY));
  }

  for (const v of capped) {
    const base = v.base_severity;
    const cal = v.calibrated_severity;
    const reason = v.calibration_reason;
    if (base === cal && reason != null) {
      throw new Error(`VOFC calibration integrity: vofc_id=${v.vofc_id} has base_severity===calibrated_severity but non-null calibration_reason`);
    }
    if (base !== cal && reason == null) {
      throw new Error(`VOFC calibration integrity: vofc_id=${v.vofc_id} has base_severity!==calibrated_severity but null calibration_reason`);
    }
  }

  const tool_version = assessment.meta?.tool_version ?? "0.1.0";
  const collection = {
    generated_at_iso: new Date().toISOString(),
    tool_version,
    items: capped,
  };
  assertMAPCompliance(collection);
  return collection;
}

export function generateVOFCsFromEntries(assessment: Assessment, entries: InternalVofcEntry[]): VOFCCollection {
  return runGeneration(assessment, entries);
}
