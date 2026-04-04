/**
 * Derived flags from confirmed cross-dependency edges.
 * Circular dependencies + common-mode SPOF (no numeric scores).
 */
import type {
  CrossDependencyEdge,
  CrossDependencyCircular,
  CrossDependencyCommonMode,
  CrossDependencyCategory,
} from 'schema';

const CATEGORY_LABELS: Record<CrossDependencyCategory, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

function label(c: CrossDependencyCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}

/** Build adj list from confirmed edges. */
function buildGraph(edges: CrossDependencyEdge[]): Map<CrossDependencyCategory, CrossDependencyCategory[]> {
  const g = new Map<CrossDependencyCategory, CrossDependencyCategory[]>();
  for (const e of edges) {
    const arr = g.get(e.from_category) ?? [];
    if (!arr.includes(e.to_category)) arr.push(e.to_category);
    g.set(e.from_category, arr);
  }
  return g;
}

/** DFS cycle detection. Returns cycle path if found (first cycle only). */
function findCycle(
  g: Map<CrossDependencyCategory, CrossDependencyCategory[]>
): CrossDependencyCategory[] | null {
  const visited = new Set<CrossDependencyCategory>();
  const recStack = new Set<CrossDependencyCategory>();
  const parent = new Map<CrossDependencyCategory, CrossDependencyCategory>();

  const getAllNodes = () => {
    const s = new Set<CrossDependencyCategory>();
    for (const k of g.keys()) s.add(k);
    for (const arr of g.values()) for (const v of arr) s.add(v);
    return s;
  };

  const dfs = (u: CrossDependencyCategory): CrossDependencyCategory[] | null => {
    visited.add(u);
    recStack.add(u);
    const neighbors = g.get(u) ?? [];
    for (const v of neighbors) {
      if (!visited.has(v)) {
        parent.set(v, u);
        const cycle = dfs(v);
        if (cycle) return cycle;
      } else if (recStack.has(v)) {
        const path: CrossDependencyCategory[] = [];
        let cur: CrossDependencyCategory | undefined = u;
        while (cur !== undefined) {
          path.unshift(cur);
          if (cur === v) break;
          cur = parent.get(cur);
        }
        return path;
      }
    }
    recStack.delete(u);
    return null;
  };

  for (const node of getAllNodes()) {
    if (visited.has(node)) continue;
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return null;
}

/** Canonicalize cycle: rotate so smallest (by string) node is first. */
function canonicalizeCycle(path: CrossDependencyCategory[]): CrossDependencyCategory[] {
  if (path.length <= 1) return path;
  const minIdx = path.reduce((best, x, i) => (x < path[best] ? i : best), 0);
  return [...path.slice(minIdx), ...path.slice(0, minIdx)];
}

/** Detect all cycles. Removes found cycle edges and repeats. */
export function detectCircularDependencies(edges: CrossDependencyEdge[]): CrossDependencyCircular[] {
  const result: CrossDependencyCircular[] = [];
  const seenCanon = new Set<string>();

  let remaining = [...edges];
  while (remaining.length > 0) {
    const g = buildGraph(remaining);
    const cycle = findCycle(g);
    if (!cycle) break;

    const canon = canonicalizeCycle(cycle);
    const key = canon.join(',');
    if (!seenCanon.has(key)) {
      seenCanon.add(key);
      result.push({ path: canon });
    }

    const cycleEdges = new Set<string>();
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      cycleEdges.add(`${from}→${to}`);
    }
    remaining = remaining.filter((e) => !cycleEdges.has(`${e.from_category}→${e.to_category}`));
  }
  return result;
}

/** Common-mode SPOF: upstream U has 2+ critical downstream edges and at least one single_path yes/unknown. */
export function detectCommonModeSpof(edges: CrossDependencyEdge[]): CrossDependencyCommonMode[] {
  const result: CrossDependencyCommonMode[] = [];
  const byUpstream = new Map<CrossDependencyCategory, CrossDependencyEdge[]>();
  for (const e of edges) {
    const arr = byUpstream.get(e.from_category) ?? [];
    arr.push(e);
    byUpstream.set(e.from_category, arr);
  }

  for (const [upstream, downstreamEdges] of byUpstream.entries()) {
    const critical = downstreamEdges.filter((e) => e.criticality === 'critical');
    if (critical.length < 2) continue;
    const hasSinglePath = critical.some((e) => e.single_path === 'yes' || e.single_path === 'unknown');
    if (!hasSinglePath) continue;

    const affected = [...new Set(critical.map((e) => e.to_category))];
    result.push({
      upstream_category: upstream,
      affected_categories: affected,
      rationale: 'Multiple critical services depend on a single-path upstream category.',
    });
  }
  return result;
}

export function computeDerivedFlags(edges: CrossDependencyEdge[]): {
  circular_dependencies: CrossDependencyCircular[];
  common_mode_spof: CrossDependencyCommonMode[];
} {
  return {
    circular_dependencies: detectCircularDependencies(edges),
    common_mode_spof: detectCommonModeSpof(edges),
  };
}

/** Format circular path for display. */
export function formatCircularPath(path: CrossDependencyCategory[]): string {
  return path.map(label).join(' → ') + (path.length > 1 ? ` → ${label(path[0])}` : '');
}

/**
 * Detect downstream cascade chains (A→B→C) from confirmed edges.
 * Returns unique paths by node sequence, limited by maxDepth.
 */
export function detectCascadeChains(
  edges: CrossDependencyEdge[],
  maxDepth = 3
): CrossDependencyCategory[][] {
  if (maxDepth < 2 || edges.length === 0) return [];
  const g = buildGraph(edges);
  const keys = new Set<string>();
  const out: CrossDependencyCategory[][] = [];

  const visit = (path: CrossDependencyCategory[]) => {
    if (path.length > maxDepth) return;
    if (path.length >= 3) {
      const k = path.join('>');
      if (!keys.has(k)) {
        keys.add(k);
        out.push([...path]);
      }
    }
    const last = path[path.length - 1];
    for (const nxt of g.get(last) ?? []) {
      if (path.includes(nxt)) continue;
      path.push(nxt);
      visit(path);
      path.pop();
    }
  };

  const starts = new Set<CrossDependencyCategory>();
  for (const e of edges) starts.add(e.from_category);
  for (const s of starts) visit([s]);
  return out;
}

/** Format downstream chain for display (A -> B -> C). */
export function formatCascadeChain(path: CrossDependencyCategory[]): string {
  return path.map(label).join(' → ');
}
