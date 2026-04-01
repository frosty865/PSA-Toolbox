/**
 * Map Engine Output → Snapshot
 *
 * Air-tight mapping rules (based on actual engine shape):
 * - Source of truth for curve values is engine.infrastructures[].curve.*
 * - Accept numeric strings AND numbers. Do not coerce missing values to 0.
 * - If requires_service flag is absent, assume the service is required (engine only emits curves for relevant infra).
 * - Earliest impact is selected only from finite numbers (no fallbacks).
 * - Always emit 6 CI domains (null-filled if engine doesn't provide one yet).
 */

import {
  Snapshot,
  DomainKey,
  DOMAIN_ORDER,
  DOMAIN_LABELS,
  buildPostureNarrative,
  buildDomainTags,
  ensureAllDomains,
  parseFiniteNumber,
  selectEarliestImpact,
  uniqStrings,
} from "./snapshot";

function getInfra(engine: any, k: DomainKey): any | null {
  const arr = engine?.infrastructures;
  if (!Array.isArray(arr)) return null;
  return arr.find((i: any) => i?.code === k) ?? null;
}

function getCurve(engine: any, k: DomainKey): any {
  return getInfra(engine, k)?.curve ?? {};
}

function requiresServiceFromCurve(curve: any): boolean {
  // If explicitly false → not required.
  // If absent → assume required (engine emits curves for assessed infra; absence shouldn't zero-out).
  const v =
    curve?.requires_service ??
    curve?.requiresService ??
    curve?.curve_requires_service ??
    curve?.requires;
  return v === false ? false : true;
}

function n(v: unknown): number | null {
  return parseFiniteNumber(v);
}

type CascadeSeverity = Snapshot["cascade"]["severity"];

type CascadeEdge = {
  from: string;
  to: string;
  timing: "IMMEDIATE" | "SHORT_TERM" | "DELAYED" | "STRATEGIC" | "UNKNOWN";
};

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function normalizeCascadeSeverity(value: unknown): CascadeSeverity | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "NONE" || normalized === "LOW" || normalized === "MED" || normalized === "HIGH") {
    return normalized as CascadeSeverity;
  }
  return null;
}

function normalizeTiming(value: unknown): CascadeEdge["timing"] {
  if (typeof value !== "string") return "UNKNOWN";
  const normalized = value.trim().toUpperCase();
  if (normalized === "IMMEDIATE") return "IMMEDIATE";
  if (normalized === "SHORT" || normalized === "SHORT_TERM" || normalized === "SHORT-TERM") return "SHORT_TERM";
  if (normalized === "DELAYED" || normalized === "MEDIUM" || normalized === "MED") return "DELAYED";
  if (normalized === "LONG" || normalized === "STRATEGIC") return "STRATEGIC";
  return "UNKNOWN";
}

function formatInfra(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function collectConfirmedEdges(engine: any): CascadeEdge[] {
  const rawEdges = [
    ...(Array.isArray(engine?.executive?.cross_dependency_overview?.confirmed_edges)
      ? engine.executive.cross_dependency_overview.confirmed_edges
      : []),
    ...(Array.isArray(engine?.cross_dependency?.confirmed_edges) ? engine.cross_dependency.confirmed_edges : []),
  ];

  const seen = new Set<string>();
  const edges: CascadeEdge[] = [];

  for (const edge of rawEdges) {
    const from = typeof edge?.from === "string" ? edge.from.trim() : "";
    const to = typeof edge?.to === "string" ? edge.to.trim() : "";
    if (!from || !to) continue;
    const timing = normalizeTiming(edge?.timing_sensitivity ?? edge?.time_to_cascade_bucket ?? edge?.timing);
    const key = `${from}|${to}|${timing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, timing });
  }

  return edges;
}

function collectCascadeFindings(engine: any): Array<{ title: string; narrative: string }> {
  const raw = Array.isArray(engine?.cross_dependency?.cascading_conditions)
    ? engine.cross_dependency.cascading_conditions
    : [];

  return raw
    .map((item: any) => ({
      title: typeof item?.title === "string" ? item.title.trim() : "",
      narrative: typeof item?.narrative === "string" ? item.narrative.trim() : "",
    }))
    .filter((item: { title: string; narrative: string }) => item.title || item.narrative);
}

function buildAdjacency(edges: CascadeEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const list = map.get(edge.from) ?? [];
    if (!list.includes(edge.to)) list.push(edge.to);
    map.set(edge.from, list);
  }
  return map;
}

function findCyclePath(edges: CascadeEdge[]): string[] | null {
  if (edges.length === 0) return null;

  const adjacency = buildAdjacency(edges);
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string): string[] | null => {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
        continue;
      }
      if (inStack.has(next)) {
        const idx = path.indexOf(next);
        if (idx >= 0) return [...path.slice(idx), next];
        return [node, next, node];
      }
    }

    path.pop();
    inStack.delete(node);
    return null;
  };

  for (const node of nodes) {
    if (visited.has(node)) continue;
    const found = dfs(node);
    if (found) return found;
  }

  return null;
}

function findCascadeChain(edges: CascadeEdge[], maxDepth = 4): string[] | null {
  if (edges.length === 0) return null;
  const adjacency = buildAdjacency(edges);
  const starts = new Set<string>(edges.map((edge) => edge.from));

  const dfs = (path: string[]): string[] | null => {
    if (path.length >= 3) return [...path];
    if (path.length >= maxDepth) return null;

    const last = path[path.length - 1];
    for (const next of adjacency.get(last) ?? []) {
      if (path.includes(next)) continue;
      path.push(next);
      const found = dfs(path);
      if (found) return found;
      path.pop();
    }
    return null;
  };

  for (const start of starts) {
    const found = dfs([start]);
    if (found) return found;
  }
  return null;
}

function deriveCascadeFallback(engine: any): {
  severity: CascadeSeverity;
  statements: string[];
  primaryPath?: string;
} {
  const edges = collectConfirmedEdges(engine);
  const findings = collectCascadeFindings(engine);
  const cyclePath = findCyclePath(edges);
  const chainPath = findCascadeChain(edges);
  const immediateOrShort = edges.filter((edge) => edge.timing === "IMMEDIATE" || edge.timing === "SHORT_TERM");

  const hasHighFinding = findings.some((finding) =>
    /(circular|single point|spof|common-mode|fast cascading)/i.test(`${finding.title} ${finding.narrative}`)
  );

  let severity: CascadeSeverity = "NONE";
  if (hasHighFinding || cyclePath || immediateOrShort.length > 0) {
    severity = "HIGH";
  } else if (chainPath || edges.length >= 2) {
    severity = "MED";
  } else if (edges.length > 0 || findings.length > 0) {
    severity = "LOW";
  }

  const findingNarratives = uniqueNonEmptyStrings(findings.map((finding) => finding.narrative || finding.title)).slice(0, 5);

  const statements = [...findingNarratives];
  if (statements.length === 0) {
    if (cyclePath) {
      statements.push(`Confirmed circular dependency path: ${cyclePath.map(formatInfra).join(" → ")}.`);
    }
    if (chainPath) {
      statements.push(`Confirmed downstream dependency chain: ${chainPath.map(formatInfra).join(" → ")}.`);
    }
    if (immediateOrShort.length > 0) {
      statements.push(
        `${immediateOrShort.length} confirmed dependency edge(s) have immediate or short-term cascade timing.`
      );
    }
    if (statements.length === 0 && edges.length > 0) {
      statements.push(`${edges.length} confirmed cross-domain dependency edge(s) are recorded.`);
    }
  }

  let primaryPath: string | undefined;
  if (chainPath) {
    primaryPath = chainPath.map(formatInfra).join(" → ");
  } else if (cyclePath) {
    primaryPath = cyclePath.map(formatInfra).join(" → ");
  } else if (edges.length > 0) {
    const edge = immediateOrShort[0] ?? edges[0];
    primaryPath = `${formatInfra(edge.from)} → ${formatInfra(edge.to)}`;
  }

  return {
    severity,
    statements: statements.slice(0, 5),
    primaryPath,
  };
}

export function mapEngineToSnapshot(engine: any): Snapshot {
  const toggles = engine?.toggles ?? {};
  const praSlaEnabled = toggles?.pra_sla === true || toggles?.pra_sla === "ON";
  const crossDepEnabled = toggles?.cross_dependency === true || toggles?.cross_dependency === "ON";

  // --- Domains (6 CI enforced) ---
  const partialDomains: Partial<Snapshot["domains"]> = {};

  for (const k of DOMAIN_ORDER) {
    const curve = getCurve(engine, k);
    const infra = getInfra(engine, k);

    const required = requiresServiceFromCurve(curve);
    const backupAvailable = curve?.backup_available === true || curve?.backupAvailable === true;

    // Trust engine values; never invent 0.
    const timeToImpact = required ? n(curve?.time_to_impact_hr) : null;
    const recovery = required ? n(curve?.recovery_hr) : null;

    const lossNoAlt = required ? n(curve?.loss_no_backup_pct) : null;

    const altDuration = required && backupAvailable ? n(curve?.backup_duration_hr) : null;
    const lossWithAlt = required && backupAvailable ? n(curve?.loss_with_backup_pct) : null;

    // Flags come from engine if present; otherwise no tags.
    const flags = engine?.domain_flags?.[k] ?? {};

    partialDomains[k] = {
      label: infra?.display_name ?? DOMAIN_LABELS[k],
      time_to_severe_hrs: timeToImpact,
      loss_no_alternate_pct: lossNoAlt,
      loss_with_alternate_pct: lossWithAlt,
      alternate_duration_hrs: altDuration,
      recovery_hrs: recovery,
      tags: buildDomainTags({
        singlePoint: !!(flags.singlePoint ?? flags.single_point),
        collocated: !!(flags.collocatedEntry ?? flags.collocated_entry),
        providerGap: !!(flags.providerCoordGap ?? flags.provider_coord_gap),
      }),
    };
  }

  const domains = ensureAllDomains(partialDomains as any);

  // --- Earliest impact (deterministic, no fallbacks) ---
  const earliest = selectEarliestImpact(domains);

  // --- Drivers (titles only for narrative; keep full objects for card list) ---
  const rawDrivers = Array.isArray(engine?.executive?.key_risk_drivers)
    ? engine.executive.key_risk_drivers
    : [];

  /** Stable dedupe by driver title (first occurrence wins), then slice to 6. */
  function dedupeDriversByTitle(driverList: any[]): any[] {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const d of driverList) {
      const title = typeof d?.title === "string" ? d.title.trim() : "";
      if (!title) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      out.push(d);
    }
    return out;
  }

  const drivers = dedupeDriversByTitle(rawDrivers);
  const topDriverTitles = uniqStrings(
    drivers
      .map((d: any) => (typeof d?.title === "string" ? d.title.trim() : ""))
      .filter(Boolean)
  );

  // --- Posture level ---
  // If engine provides it, use it. Otherwise default to MODERATE only when you actually have inputs.
  const hasAnyCurveData = DOMAIN_ORDER.some((k) => {
    const c = getCurve(engine, k);
    return n(c?.time_to_impact_hr) !== null || n(c?.recovery_hr) !== null;
  });

  const postureLevel: Snapshot["posture"]["level"] =
    engine?.synthesis?.risk_posture_level ??
    (drivers.length === 0 && !hasAnyCurveData ? "NOT_ASSESSED" : "MODERATE");

  const cascade = engine?.cascade ?? {};
  const derivedCascade = deriveCascadeFallback(engine);
  const explicitCascadeSeverity = normalizeCascadeSeverity(cascade?.severity);
  const resolvedCascadeSeverity: CascadeSeverity = crossDepEnabled
    ? explicitCascadeSeverity ?? derivedCascade.severity
    : "NONE";

  const narrative =
    postureLevel === "NOT_ASSESSED"
      ? "Complete the dependency assessment to see risk posture."
      : buildPostureNarrative({
          level: postureLevel,
          topDriverTitles,
          earliestDomainLabel: earliest?.label ?? null,
          earliestHours: earliest?.hours ?? null,
          cascadeEnabled: crossDepEnabled,
          cascadeSeverity: resolvedCascadeSeverity,
        });

  // --- Evidence blocks ---
  const findingsCount = engine?.findings_count ?? {
    structural: 0,
    foundational: 0,
    cross_cutting: 0,
    total: 0,
  };

  const triggerDensity = engine?.trigger_density ?? { status: "PASS", warnings: 0, fails: 0 };

  const citationCoverage = engine?.citation_coverage ?? {
    findings_with_citations: 0,
    findings_total: 0,
  };

  // --- Cascade ---
  const providedStatements =
    crossDepEnabled && Array.isArray(cascade?.statements)
      ? uniqueNonEmptyStrings(cascade.statements).slice(0, 5)
      : [];
  const resolvedStatements = providedStatements.length > 0 ? providedStatements : uniqueNonEmptyStrings(derivedCascade.statements);
  const providedPrimaryPath =
    typeof cascade?.primary_path === "string" && cascade.primary_path.trim().length > 0
      ? cascade.primary_path
      : undefined;
  const resolvedPrimaryPath = providedPrimaryPath ?? derivedCascade.primaryPath;

  return {
    meta: {
      facility_name: engine?.meta?.org_name ?? engine?.meta?.site_name ?? "—",
      assessment_date_iso: engine?.meta?.generated_at ?? new Date().toISOString(),
      toggles: {
        pra_sla: praSlaEnabled ? "ON" : "OFF",
        cross_dependency: crossDepEnabled ? "ON" : "OFF",
      },
    },

    posture: {
      level: postureLevel,
      narrative,
    },

    top_drivers: drivers.slice(0, 6).map((d: any) => ({
      title: d?.title ?? "Risk Driver",
      category: d?._category ?? "OperationalCriticality",
      severity: d?.severity ?? postureLevel,
      consequence: d?.narrative ?? "",
    })),

    domains,

    cascade: {
      enabled: crossDepEnabled,
      severity: resolvedCascadeSeverity,
      statements: crossDepEnabled
        ? resolvedStatements.length > 0
          ? resolvedStatements
          : ["No material cross-domain cascading exposure flagged by current inputs."]
        : [],
      primary_path: crossDepEnabled ? resolvedPrimaryPath : undefined,
    },

    evidence: {
      findings: {
        structural: findingsCount.structural,
        foundational: findingsCount.foundational,
        cross_cutting: findingsCount.cross_cutting,
        total: findingsCount.total,
      },
      trigger_density: {
        status: triggerDensity.status,
        warnings: triggerDensity.warnings,
        fails: triggerDensity.fails,
      },
      citation_coverage: {
        findings_with_citations: citationCoverage.findings_with_citations,
        findings_total: citationCoverage.findings_total,
      },
    },
  };
}

// Back-compat export (existing code imports this name)
export const mapToSnapshot = mapEngineToSnapshot;
