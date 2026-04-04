/**
 * Normalize assessment.cross_dependencies to CrossDependenciesNode.
 * Migrates legacy array format when needed.
 */
import type { Assessment, CrossDependenciesNode, CrossDependencyEdge, CrossDependency } from 'schema';
import { computeDerivedFlags } from './deriveFlags';

const INFRA_CATEGORIES = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

function isValidCategory(s: string): s is CrossDependencyEdge['from_category'] {
  return [...INFRA_CATEGORIES, 'CRITICAL_PRODUCTS'].includes(s as never);
}

const CONFIDENCE_RANK: Record<CrossDependencyEdge['confidence'], number> = {
  confirmed: 4,
  documented: 3,
  assumed: 2,
  unknown: 1,
};

const CRITICALITY_RANK: Record<CrossDependencyEdge['criticality'], number> = {
  critical: 4,
  important: 3,
  limited: 2,
  unknown: 1,
};

const TIME_RANK: Record<CrossDependencyEdge['time_to_cascade_bucket'], number> = {
  immediate: 5,
  short: 4,
  medium: 3,
  long: 2,
  unknown: 1,
};

const SINGLE_PATH_RANK: Record<CrossDependencyEdge['single_path'], number> = {
  yes: 3,
  unknown: 2,
  no: 1,
};

const SOURCE_RANK: Record<NonNullable<CrossDependencyEdge['source']>, number> = {
  user: 2,
  auto_suggest: 1,
};

function semanticEdgeKey(edge: CrossDependencyEdge): string {
  return `${edge.from_category}→${edge.to_category}:${edge.purpose}`;
}

function edgeScore(edge: CrossDependencyEdge): number {
  const confidence = CONFIDENCE_RANK[edge.confidence] ?? 0;
  const criticality = CRITICALITY_RANK[edge.criticality] ?? 0;
  const timing = TIME_RANK[edge.time_to_cascade_bucket] ?? 0;
  const singlePath = SINGLE_PATH_RANK[edge.single_path] ?? 0;
  const source = edge.source ? SOURCE_RANK[edge.source] ?? 0 : 0;
  return confidence * 1000 + criticality * 100 + timing * 10 + singlePath + source;
}

function mergeNotes(a?: string, b?: string): string | undefined {
  const parts = [a, b]
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parts));
  if (unique.length === 0) return undefined;
  return unique.join(' | ');
}

export function dedupeCrossDependencyEdges(edges: CrossDependencyEdge[]): CrossDependencyEdge[] {
  const byKey = new Map<string, CrossDependencyEdge>();
  for (const rawEdge of edges) {
    const edge: CrossDependencyEdge = {
      ...rawEdge,
      notes: typeof rawEdge.notes === 'string' && rawEdge.notes.trim().length > 0 ? rawEdge.notes.trim() : undefined,
    };
    const key = semanticEdgeKey(edge);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, edge);
      continue;
    }

    const keep = edgeScore(edge) > edgeScore(existing) ? edge : existing;
    const mergedSource: CrossDependencyEdge['source'] =
      existing.source === 'user' || edge.source === 'user'
        ? 'user'
        : (keep.source ?? existing.source ?? edge.source);

    byKey.set(key, {
      ...keep,
      source: mergedSource,
      notes: mergeNotes(existing.notes, edge.notes),
    });
  }
  return Array.from(byKey.values());
}

/** Map legacy dependency_type to new purpose. */
function mapPurpose(dt?: string): CrossDependencyEdge['purpose'] {
  if (dt === 'primary_operations') return 'primary_operations';
  if (dt === 'monitoring_control') return 'monitoring_control';
  if (dt === 'backup_systems') return 'restoration_recovery';
  return 'primary_operations';
}

/** Migrate legacy CrossDependency to CrossDependencyEdge. */
function migrateLegacyEntry(leg: CrossDependency): CrossDependencyEdge {
  const from = leg.from_category && isValidCategory(leg.from_category)
    ? (leg.from_category as CrossDependencyEdge['from_category'])
    : 'ELECTRIC_POWER';
  const to = isValidCategory(leg.to_category) ? (leg.to_category as CrossDependencyEdge['to_category']) : 'ELECTRIC_POWER';

  let bucket: CrossDependencyEdge['time_to_cascade_bucket'] = 'unknown';
  if (typeof leg.time_to_cascade_hours === 'number') {
    if (leg.time_to_cascade_hours <= 1) bucket = 'immediate';
    else if (leg.time_to_cascade_hours <= 6) bucket = 'short';
    else if (leg.time_to_cascade_hours <= 24) bucket = 'medium';
    else bucket = 'long';
  }

  return {
    from_category: from,
    to_category: to,
    purpose: mapPurpose(leg.dependency_type),
    criticality: 'critical',
    time_to_cascade_bucket: bucket,
    single_path: 'unknown',
    confidence: 'documented',
    notes: leg.description || undefined,
    source: 'user',
  };
}

export function getCrossDependenciesNode(assessment: Assessment): CrossDependenciesNode {
  const raw = assessment.cross_dependencies;
  if (raw == null) {
    return { edges: [], rejected_keys: [] };
  }
  if (Array.isArray(raw)) {
    const migratedEdges = raw
      .filter((e): e is CrossDependency => e != null && typeof e === 'object' && !!e.to_category)
      .map(migrateLegacyEntry);
    const edges = dedupeCrossDependencyEdges(migratedEdges);
    return {
      edges,
      derived: edges.length > 0 ? computeDerivedFlags(edges) : { circular_dependencies: [], common_mode_spof: [] },
      rejected_keys: [],
    };
  }
  if (typeof raw === 'object' && 'edges' in raw) {
    const edges = dedupeCrossDependencyEdges(Array.isArray(raw.edges) ? raw.edges : []);
    return {
      edges,
      derived: edges.length > 0 ? computeDerivedFlags(edges) : { circular_dependencies: [], common_mode_spof: [] },
      last_auto_suggest_hash: raw.last_auto_suggest_hash,
      rejected_keys: raw.rejected_keys ?? [],
    };
  }
  return { edges: [], rejected_keys: [] };
}
