/**
 * Executive Risk Posture Snapshot Types + Deterministic Narrative Helpers
 *
 * Air-tight rules:
 * - Never coerce missing values to 0.
 * - Accept numeric strings (engine/UI often serialize as strings).
 * - All SIX CI domains always present (null-filled if unavailable).
 * - Narrative uses driver TITLES (deduped), not category codes.
 */

import { formatHours } from "./format_hours";

export type RiskLevel = "HIGH" | "ELEVATED" | "MODERATE" | "LOW" | "NOT_ASSESSED";
export type ToggleState = "ON" | "OFF";
export type DensityStatus = "PASS" | "WARN" | "FAIL";

export type DomainKey =
  | "ELECTRIC_POWER"
  | "COMMUNICATIONS"
  | "INFORMATION_TECHNOLOGY"
  | "WATER"
  | "WASTEWATER"
  | "NATURAL_GAS";

export const DOMAIN_ORDER: DomainKey[] = [
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
  "NATURAL_GAS",
];

export const DOMAIN_LABELS: Record<DomainKey, string> = {
  ELECTRIC_POWER: "Electric Power",
  COMMUNICATIONS: "Communications",
  INFORMATION_TECHNOLOGY: "Information Technology",
  WATER: "Water",
  WASTEWATER: "Wastewater",
  NATURAL_GAS: "Natural Gas",
};

export type DriverCategory =
  | "SinglePointFailure"
  | "RestorationCoordination"
  | "AlternateCapability"
  | "EntryExposure"
  | "Collocation"
  | "DependencyCascade"
  | "OperationalCriticality";

export type DomainTagType = "SinglePoint" | "CollocatedEntry" | "ProviderCoordGap";

export type SnapshotDomain = {
  label: string;
  time_to_severe_hrs: number | null;
  loss_no_alternate_pct: number | null;
  loss_with_alternate_pct: number | null;
  alternate_duration_hrs: number | null;
  recovery_hrs: number | null;
  tags: Array<{ type: DomainTagType; text: string }>;
};

export type Snapshot = {
  meta: {
    facility_name: string;
    assessment_date_iso: string;
    toggles: {
      pra_sla: ToggleState;
      cross_dependency: ToggleState;
    };
  };

  posture: {
    level: RiskLevel;
    narrative: string;
  };

  top_drivers: Array<{
    title: string;
    category: DriverCategory;
    severity: RiskLevel;
    consequence: string;
  }>;

  domains: Record<DomainKey, SnapshotDomain>;

  cascade: {
    enabled: boolean;
    severity: "NONE" | "LOW" | "MED" | "HIGH";
    statements: string[];
    primary_path?: string;
  };

  evidence: {
    findings: {
      structural: number;
      foundational: number;
      cross_cutting: number;
      total: number;
    };
    trigger_density: {
      status: DensityStatus;
      warnings: number;
      fails: number;
    };
    citation_coverage: {
      findings_with_citations: number;
      findings_total: number;
    };
  };
};

export function ensureAllDomains(
  partial: Partial<Record<DomainKey, Partial<SnapshotDomain>>>
): Record<DomainKey, SnapshotDomain> {
  const out = {} as Record<DomainKey, SnapshotDomain>;
  for (const k of DOMAIN_ORDER) {
    const src = partial?.[k] ?? {};
    out[k] = {
      label: typeof src.label === "string" && src.label.trim() ? src.label : DOMAIN_LABELS[k],
      time_to_severe_hrs: isFiniteNumber(src.time_to_severe_hrs) ? src.time_to_severe_hrs : null,
      loss_no_alternate_pct: isFiniteNumber(src.loss_no_alternate_pct) ? src.loss_no_alternate_pct : null,
      loss_with_alternate_pct: isFiniteNumber(src.loss_with_alternate_pct) ? src.loss_with_alternate_pct : null,
      alternate_duration_hrs: isFiniteNumber(src.alternate_duration_hrs) ? src.alternate_duration_hrs : null,
      recovery_hrs: isFiniteNumber(src.recovery_hrs) ? src.recovery_hrs : null,
      tags: Array.isArray(src.tags) ? (src.tags as any).slice(0, 3) : [],
    };
  }
  return out;
}

export function buildDomainTags(flags: {
  singlePoint: boolean;
  collocated: boolean;
  providerGap: boolean;
}): Array<{ type: DomainTagType; text: string }> {
  const tags: Array<{ type: DomainTagType; text: string }> = [];
  if (flags.singlePoint) tags.push({ type: "SinglePoint", text: "Single-point exposure" });
  if (flags.providerGap) tags.push({ type: "ProviderCoordGap", text: "Restoration coordination gap" });
  if (flags.collocated) tags.push({ type: "CollocatedEntry", text: "Co-located service entry" });
  return tags.slice(0, 3);
}

export function selectEarliestImpact(domains: Record<DomainKey, SnapshotDomain>): {
  domain: DomainKey;
  label: string;
  hours: number;
} | null {
  let best: { domain: DomainKey; label: string; hours: number } | null = null;
  for (const k of DOMAIN_ORDER) {
    const hrs = domains[k]?.time_to_severe_hrs;
    if (!isFiniteNumber(hrs)) continue;
    if (!best || hrs < best.hours) best = { domain: k, label: domains[k].label, hours: hrs };
  }
  return best;
}

export function buildPostureNarrative(args: {
  level: RiskLevel;
  topDriverTitles: string[];
  earliestDomainLabel: string | null;
  earliestHours: number | null;
  cascadeEnabled: boolean;
  cascadeSeverity: "NONE" | "LOW" | "MED" | "HIGH";
}): string {
  const titles = uniqStrings((args.topDriverTitles ?? []).map((s) => (s ?? "").trim()).filter(Boolean));
  const primary = titles[0];
  const secondary = titles[1];

  const s1 =
    primary && secondary
      ? `Overall dependency exposure is ${args.level}, driven primarily by ${primary} and ${secondary}.`
      : primary
        ? `Overall dependency exposure is ${args.level}, driven primarily by ${primary}.`
        : `Overall dependency exposure is ${args.level}.`;

  const s2 =
    args.earliestDomainLabel && isFiniteNumber(args.earliestHours)
      ? `Most immediate operational degradation is associated with ${args.earliestDomainLabel} within ${formatHours(args.earliestHours)} under loss of external service without alternate capability.`
      : `Time-to-severe operational impact could not be quantified from available inputs.`;

  const s3 =
    args.cascadeEnabled && args.cascadeSeverity !== "NONE"
      ? `Cross-domain interdependencies increase the likelihood of concurrent degradation during localized disruption.`
      : "";

  return [s1, s2, s3].filter(Boolean).join(" ");
}

export function fmtOrDash(v: number | null, suffix?: string): string {
  if (!isFiniteNumber(v)) return "—";
  return suffix ? `${v}${suffix}` : String(v);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const key = s.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}