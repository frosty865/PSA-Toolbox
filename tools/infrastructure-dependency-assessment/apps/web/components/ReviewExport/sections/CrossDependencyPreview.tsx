'use client';

import React, { useMemo } from 'react';
import type { Assessment } from 'schema';
import type { EdgeVM, ReportVM } from '@/app/lib/report/view_model';
import { renderDependencyGraph } from '@/app/lib/report/graphics';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { computeDerivedFlags, detectCascadeChains, formatCascadeChain, formatCircularPath } from '@/app/lib/cross-dependencies/deriveFlags';
import { buildDownstreamFailureIndicators } from '@/app/lib/cross-dependencies/buildSuggestions';

function toDisplayLabel(code: string): string {
  return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimingWindow(timing: string): string {
  const map: Record<string, string> = {
    IMMEDIATE: 'Immediate (0-1 hour)',
    SHORT_TERM: 'Short term (1-4 hours)',
    DELAYED: 'Delayed (4+ hours)',
    STRATEGIC: 'Strategic (long-horizon)',
  };
  return map[timing] ?? timing;
}

function mapBucketToSeverity(bucket: string): EdgeVM['timing_sensitivity'] {
  if (bucket === 'immediate') return 'IMMEDIATE';
  if (bucket === 'short') return 'SHORT_TERM';
  if (bucket === 'long') return 'STRATEGIC';
  return 'DELAYED';
}

function mapPurposeLabel(purpose: string): string {
  const map: Record<string, string> = {
    primary_operations: 'primary operations',
    monitoring_control: 'monitoring/control',
    restoration_recovery: 'restoration/recovery',
    safety_life_safety: 'safety/life safety',
  };
  return map[purpose] ?? purpose.replace(/_/g, ' ');
}

/**
 * Cross-Dependency & Cascading Risk Preview: Shows confirmed edges, derived flags, and implications.
 */
export function CrossDependencyPreview({
  assessment,
  reportVM,
  showHelp,
}: {
  assessment: Assessment;
  reportVM: ReportVM | null;
  showHelp: boolean;
}) {
  const confirmedEdges = useMemo(() => {
    const node = getCrossDependenciesNode(assessment);
    if (node.edges.length > 0) {
      return node.edges.map((edge) => {
        const notes = (edge.notes ?? '').trim();
        const rationaleBase = `Purpose: ${mapPurposeLabel(edge.purpose)}; criticality: ${edge.criticality}; single-path: ${edge.single_path}.`;
        const rationale = notes ? `${rationaleBase} ${notes}` : rationaleBase;
        return {
          from: edge.from_category,
          to: edge.to_category,
          timing_sensitivity: mapBucketToSeverity(edge.time_to_cascade_bucket),
          rationale,
        } as EdgeVM;
      });
    }
    return reportVM?.cross_dependency?.confirmed_edges ?? [];
  }, [assessment, reportVM]);
  const infras = useMemo(
    () =>
      Array.from(
        new Set([
          ...confirmedEdges.map((edge) => edge.from),
          ...confirmedEdges.map((edge) => edge.to),
        ])
      ),
    [confirmedEdges]
  );
  const graphSvg = useMemo(() => {
    if (confirmedEdges.length === 0 || infras.length < 2) return null;
    return renderDependencyGraph(confirmedEdges, infras);
  }, [confirmedEdges, infras]);

  const factBasedFlags = useMemo(() => {
    const node = getCrossDependenciesNode(assessment);
    const derived = node.derived ?? computeDerivedFlags(node.edges);
    const flags: Array<{ title: string; description: string }> = [];

    for (const cycle of derived.circular_dependencies ?? []) {
      if (!cycle.path || cycle.path.length < 2) continue;
      flags.push({
        title: 'Circular Dependency Confirmed',
        description: `Confirmed cycle from recorded edges: ${formatCircularPath(cycle.path)}.`,
      });
    }

    for (const spof of derived.common_mode_spof ?? []) {
      const supports = node.edges.filter(
        (edge) =>
          edge.from_category === spof.upstream_category &&
          edge.criticality === 'critical' &&
          (edge.single_path === 'yes' || edge.single_path === 'unknown')
      );
      const affected = Array.from(new Set(supports.map((edge) => edge.to_category)));
      if (supports.length === 0 || affected.length === 0) continue;
      flags.push({
        title: 'Common-Mode Single Point of Failure (SPoF)',
        description: `${spof.upstream_category.replace(/_/g, ' ')} has ${supports.length} critical single-path edge(s) affecting ${affected
          .map((cat) => cat.replace(/_/g, ' '))
          .join(', ')}.`,
      });
    }

    const chains = detectCascadeChains(node.edges, 4).slice(0, 3);
    for (const chain of chains) {
      flags.push({
        title: 'Downstream Cascading Path Confirmed',
        description: `Confirmed dependency chain from recorded edges: ${formatCascadeChain(chain)}.`,
      });
    }

    return flags;
  }, [assessment]);

  const downstreamIndicators = useMemo(
    () => buildDownstreamFailureIndicators(assessment),
    [assessment]
  );

  return (
    <div>
      {/* Confirmed Edges List */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Confirmed Dependency Edges
        </h4>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #666)', margin: '0 0 var(--spacing-md) 0' }}>
          These are the validated upstream-to-downstream dependencies in your assessment. Each edge shows what system is likely to be impacted next and how quickly that impact can cascade.
        </p>
        {confirmedEdges.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {confirmedEdges.map((edge, idx) => (
              <li
                key={`${edge.from}-${edge.to}-${idx}`}
                style={{
                  padding: 'var(--spacing-md)',
                  marginBottom: 'var(--spacing-sm)',
                  backgroundColor: 'var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                    alignItems: 'center',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                  <strong>{toDisplayLabel(edge.from)}</strong> → <strong>{toDisplayLabel(edge.to)}</strong>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #555)' }}>
                    If <strong>{toDisplayLabel(edge.from)}</strong> is disrupted, <strong>{toDisplayLabel(edge.to)}</strong> is expected to degrade on the selected timing window.
                  </p>
                  {edge.rationale && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-secondary, #666)' }}>
                      {edge.rationale}
                    </p>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-success)',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    marginLeft: '0.5rem',
                  }}
                  title="Estimated time window for downstream impact"
                >
                  {formatTimingWindow(edge.timing_sensitivity)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div
            style={{
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-md)',
              color: 'var(--color-secondary, #666)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            No confirmed cross-infrastructure edges were derived from the current assessment.
          </div>
        )}
      </div>

      {/* Derived Cascading Flags */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Cascading Risk Flags
        </h4>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #666)', margin: '0 0 var(--spacing-md) 0' }}>
          These flags are generated from the confirmed edges and call out high-consequence patterns such as dependency loops, common-mode failures, and multi-step cascade chains.
        </p>
        {factBasedFlags.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {factBasedFlags.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--color-warning-bg, #fff3cd)',
                  borderLeft: '4px solid var(--color-warning, #fdb81e)',
                  borderRadius: 'var(--border-radius)',
                }}
              >
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                  <span style={{ overflowWrap: 'anywhere' }}>{item.title}</span>
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, overflowWrap: 'anywhere' }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-md)',
              color: 'var(--color-secondary, #666)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            No cascading conditions were triggered from the current inputs.
          </div>
        )}
      </div>

      {/* Downstream Failure Indicators */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Downstream Failure Indicators by Infrastructure
        </h4>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #666)', margin: '0 0 var(--spacing-md) 0' }}>
          Infrastructure-specific downstream effects identified from current answers (for example pumps, critical hosted services, and command-and-control functions).
        </p>
        {downstreamIndicators.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {downstreamIndicators.map((indicator) => (
              <div
                key={indicator.category}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: 'var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                }}
              >
                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                  {toDisplayLabel(indicator.category)}
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'var(--font-size-sm)' }}>
                  {indicator.failures.map((failure, idx) => (
                    <li key={`${indicator.category}-${idx}`}>{failure}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-md)',
              color: 'var(--color-secondary, #666)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            No downstream failure indicators were derived from the current inputs.
          </div>
        )}
      </div>

      {/* Dependency Graph */}
      <div>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Dependency Visualization
        </h4>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #666)', margin: '0 0 var(--spacing-md) 0' }}>
          Visual map of the same confirmed edges. Nodes are infrastructure systems; connecting lines show the direction of potential cascading impact.
        </p>
        {graphSvg ? (
          <div
            style={{
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-background, #fff)',
              overflowX: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: graphSvg }}
          />
        ) : (
          <div
            style={{
              border: '2px dashed var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              backgroundColor: 'var(--cisa-gray-light)',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <p style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, margin: '0 0 var(--spacing-sm) 0' }}>
              Cross-Infrastructure Dependency Graph
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary)', margin: 0 }}>
              Add or confirm dependency edges to populate this graph.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
