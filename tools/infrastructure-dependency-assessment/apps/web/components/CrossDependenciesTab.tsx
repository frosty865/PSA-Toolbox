'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { Assessment, CrossDependencyEdge, CrossDependenciesNode, CrossDependencyCategory } from 'schema';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import {
  buildCrossDependencySuggestions,
  computeSuggestionHash,
  buildDownstreamFailureIndicators,
  type SuggestedEdge,
} from '@/app/lib/cross-dependencies/buildSuggestions';
import {
  computeDerivedFlags,
  formatCircularPath,
} from '@/app/lib/cross-dependencies/deriveFlags';
import { HelpIcon } from 'ui';
import {
  CROSS_DEPENDENCY_MODULES,
  mergeModulesState,
  type ModulesState,
} from '@/app/lib/modules/registry';
import { deriveOtIcsModule, deriveOtIcsDerivedStrings } from '@/app/lib/modules/ot_ics_resilience_derive';
import type { ModuleQuestionConfig } from '@/app/lib/modules/ot_ics_resilience_module';
import { EdgeLegend } from './EdgeLegend';

const CATEGORY_LABELS: Record<CrossDependencyCategory, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

const PURPOSE_LABELS: Record<CrossDependencyEdge['purpose'], string> = {
  primary_operations: 'Primary operations',
  monitoring_control: 'Monitoring / control',
  restoration_recovery: 'Restoration / recovery',
  safety_life_safety: 'Safety / life safety',
};

const TIME_BUCKET_LABELS: Record<CrossDependencyEdge['time_to_cascade_bucket'], string> = {
  immediate: 'Immediate',
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  unknown: 'Unknown',
};

const CRITICALITY_OPTIONS: CrossDependencyEdge['criticality'][] = ['critical', 'important', 'limited', 'unknown'];
const SINGLE_PATH_OPTIONS: CrossDependencyEdge['single_path'][] = ['yes', 'no', 'unknown'];
const CONFIDENCE_OPTIONS: CrossDependencyEdge['confidence'][] = ['assumed', 'documented', 'confirmed', 'unknown'];
const PURPOSE_OPTIONS: CrossDependencyEdge['purpose'][] = [
  'primary_operations',
  'monitoring_control',
  'restoration_recovery',
  'safety_life_safety',
];
const TIME_BUCKET_OPTIONS: CrossDependencyEdge['time_to_cascade_bucket'][] = [
  'immediate',
  'short',
  'medium',
  'long',
  'unknown',
];

function edgeKey(from: string, to: string, purpose: string): string {
  return `${from}→${to}:${purpose}`;
}

export interface CrossDependenciesTabProps {
  assessment: Assessment;
  onUpdate: (node: CrossDependenciesNode) => void;
  /** Optional: use React setState setter for updates. More reliable than callback. */
  setAssessment?: React.Dispatch<React.SetStateAction<Assessment>>;
}

export function CrossDependenciesTab({ assessment, onUpdate, setAssessment: setAssessmentProp }: CrossDependenciesTabProps) {
  const onUpdateStable = React.useCallback(
    (node: CrossDependenciesNode) => {
      if (setAssessmentProp) {
        setAssessmentProp((prev) => ({ ...prev, cross_dependencies: node }));
      } else {
        onUpdate(node);
      }
    },
    [setAssessmentProp, onUpdate]
  );
  const node = useMemo(() => getCrossDependenciesNode(assessment), [assessment]);
  const rejectedSet = useMemo(() => new Set(node.rejected_keys ?? []), [node.rejected_keys]);
  const currentHash = useMemo(() => computeSuggestionHash(assessment), [assessment]);

  const [editingEdge, setEditingEdge] = useState<CrossDependencyEdge | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingIsSuggestion, setEditingIsSuggestion] = useState(false);
  const [expandedReasonIndex, setExpandedReasonIndex] = useState<number | null>(null);

  const modulesState = useMemo(() => mergeModulesState(assessment.modules as ModulesState | undefined), [assessment.modules]);
  const updateModulesState = useCallback(
    (next: ModulesState) => {
      if (!setAssessmentProp) return;
      setAssessmentProp((prev) => ({ ...prev, modules: next }));
    },
    [setAssessmentProp]
  );

  const setModuleEnabled = useCallback(
    (code: string, enabled: boolean) => {
      const next = mergeModulesState(assessment.modules as ModulesState | undefined);
      next[code] = { ...next[code], enabled };
      updateModulesState(next);
    },
    [assessment.modules, updateModulesState]
  );

  const setModuleAnswers = useCallback(
    (code: string, answers: Record<string, unknown>) => {
      const next = mergeModulesState(assessment.modules as ModulesState | undefined);
      const derived = code === 'MODULE_OT_ICS_RESILIENCE'
        ? deriveOtIcsDerivedStrings(answers)
        : undefined;
      next[code] = {
        ...next[code],
        answers,
        derived,
      };
      updateModulesState(next);
    },
    [assessment.modules, updateModulesState]
  );

  const suggestions = useMemo(
    () => buildCrossDependencySuggestions(assessment, rejectedSet),
    [assessment, rejectedSet]
  );
  const downstreamIndicators = useMemo(
    () => buildDownstreamFailureIndicators(assessment),
    [assessment]
  );

  const confirmed = node.edges;
  const derived = useMemo(
    () => (confirmed.length > 0 ? computeDerivedFlags(confirmed) : { circular_dependencies: [], common_mode_spof: [] }),
    [confirmed]
  );

  const moduleFlags = useMemo(() => {
    const flags: Array<{ id: string; title: string; text: string }> = [];
    for (const mod of CROSS_DEPENDENCY_MODULES) {
      const state = modulesState[mod.module_code];
      if (!state?.enabled) continue;
      if (mod.module_code === 'MODULE_OT_ICS_RESILIENCE') {
        const derivedMod = deriveOtIcsModule(state.answers ?? {});
        flags.push(...derivedMod.flags);
      }
    }
    return flags;
  }, [modulesState]);

  const hashChanged = currentHash !== node.last_auto_suggest_hash;

  const refreshSuggestions = useCallback(() => {
    onUpdateStable({
      ...node,
      last_auto_suggest_hash: currentHash,
      rejected_keys: node.rejected_keys ?? [],
    });
  }, [node, currentHash, onUpdateStable]);

  const accept = useCallback(
    (e: CrossDependencyEdge) => {
      const k = edgeKey(e.from_category, e.to_category, e.purpose);
      const nextEdges = [...confirmed];
      const idx = nextEdges.findIndex(
        (x) => edgeKey(x.from_category, x.to_category, x.purpose) === k
      );
      const accepted = { ...e, confidence: 'confirmed' as const, source: 'auto_suggest' as const };
      if (idx >= 0) nextEdges[idx] = accepted;
      else nextEdges.push(accepted);

      const nextDerived = computeDerivedFlags(nextEdges);
      onUpdateStable({
        ...node,
        edges: nextEdges,
        derived: nextDerived,
        last_auto_suggest_hash: currentHash,
      });
    },
    [confirmed, node, currentHash, onUpdateStable]
  );

  const reject = useCallback(
    (e: CrossDependencyEdge) => {
      const k = edgeKey(e.from_category, e.to_category, e.purpose);
      const nextRejected = [...(node.rejected_keys ?? []), k];
      onUpdateStable({ ...node, rejected_keys: nextRejected, last_auto_suggest_hash: currentHash });
    },
    [node, currentHash, onUpdateStable]
  );

  const acceptAll = useCallback(() => {
    let nextEdges = [...confirmed];
    for (const e of suggestions) {
      const k = edgeKey(e.from_category, e.to_category, e.purpose);
      if (nextEdges.some((x) => edgeKey(x.from_category, x.to_category, x.purpose) === k)) continue;
      nextEdges.push({ ...e, confidence: 'confirmed' as const, source: 'auto_suggest' as const });
    }
    const nextRejected = node.rejected_keys ?? [];
    const nextDerived = computeDerivedFlags(nextEdges);
    onUpdateStable({
      ...node,
      edges: nextEdges,
      derived: nextDerived,
      rejected_keys: nextRejected,
      last_auto_suggest_hash: currentHash,
    });
  }, [confirmed, suggestions, node, currentHash, onUpdateStable]);

  const removeConfirmed = useCallback(
    (idx: number) => {
      const nextEdges = confirmed.filter((_, i) => i !== idx);
      const nextDerived = computeDerivedFlags(nextEdges);
      onUpdateStable({ ...node, edges: nextEdges, derived: nextDerived });
    },
    [confirmed, node, onUpdateStable]
  );

  const updateEdge = useCallback(
    (updated: CrossDependencyEdge) => {
      if (editingIndex !== null) {
        const next = [...confirmed];
        next[editingIndex] = updated;
        const nextDerived = computeDerivedFlags(next);
        onUpdateStable({ ...node, edges: next, derived: nextDerived });
      } else if (editingIsSuggestion && editingEdge) {
        accept(updated);
      }
      setEditingEdge(null);
      setEditingIndex(null);
      setEditingIsSuggestion(false);
    },
    [editingIndex, editingEdge, editingIsSuggestion, confirmed, node, accept, onUpdateStable]
  );

  const openEdit = useCallback(
    (e: CrossDependencyEdge, idx: number | null, isSuggestion: boolean) => {
      setEditingEdge({ ...e });
      setEditingIndex(idx);
      setEditingIsSuggestion(isSuggestion);
    },
    []
  );

  return (
    <div className="cross-dependencies-tab">
      <p className="text-secondary mb-4">
        Auto-suggested dependencies are derived from your assessment answers. Review modules, accept or reject suggestions, and confirm edges to identify risks such as circular dependencies and common-mode SPOF.
      </p>

      <section className="card">
        <h3 className="card-title">Cross-Dependency Modules</h3>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-lg)' }}>
          Cross-cutting conditions that can change impacts across multiple dependencies (does not create a curve).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {CROSS_DEPENDENCY_MODULES.map((mod) => {
            const state = modulesState[mod.module_code];
            const enabled = Boolean(state?.enabled);
            const answers = (state?.answers ?? {}) as Record<string, unknown>;
            const derived = mod.module_code === 'MODULE_OT_ICS_RESILIENCE'
              ? deriveOtIcsModule(answers)
              : null;
            return (
              <div key={mod.module_code} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                  <div>
                    <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>{mod.title}</h4>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary, #666)', margin: 0 }}>{mod.intro.purpose}</p>
                  </div>
                  <div className="checkbox-item" style={{ marginBottom: 0 }}>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setModuleEnabled(mod.module_code, e.target.checked)}
                      />
                      <span>{enabled ? 'Enabled' : 'Enable'}</span>
                    </label>
                  </div>
                </div>

                {enabled && (
                  <div style={{ marginTop: 'var(--spacing-lg)' }}>
                    <div style={{ background: 'var(--background-alt, #f8fafc)', border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                      <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)', margin: 0 }}><strong>Purpose:</strong> {mod.intro.purpose}</p>
                      <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)', margin: 0 }}><strong>Includes:</strong> {mod.intro.includes.join('; ')}</p>
                      <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)', margin: 0 }}><strong>Excludes:</strong> {mod.intro.excludes.join('; ')}</p>
                      <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}><strong>How used:</strong> {mod.intro.how_used}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
                      {mod.questions.map((q) => {
                        if (!shouldShowModuleQuestion(q, answers)) return null;
                        return (
                          <ModuleQuestion
                            key={q.id}
                            question={q}
                            answers={answers}
                            onChange={(next) => setModuleAnswers(mod.module_code, next)}
                          />
                        );
                      })}
                    </div>

                    {derived && (
                      <div>
                        <h5 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)', margin: 0 }}>Module Findings</h5>
                        {derived.vulnerabilities.length === 0 ? (
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary, #666)', margin: 0 }}>No significant cross-dependency control gaps identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
                            {derived.vulnerabilities.map((v) => (
                              <div key={v.id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-sm)', margin: 0 }}>{v.title}</p>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary, #666)', marginBottom: 'var(--spacing-md)', margin: 0 }}>{v.text}</p>
                                {v.ofcs.length > 0 && (
                                  <ul style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 0, marginTop: 'var(--spacing-sm)' }}>
                                    {v.ofcs.slice(0, 4).map((o) => (
                                      <li key={o.id} style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                        <strong>OFC:</strong> {o.option_for_consideration}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="ida-btn ida-btn-outline-secondary ida-btn-sm"
          onClick={refreshSuggestions}
          title="Recompute suggestions from current assessment"
        >
          Refresh suggestions
        </button>
        <button
          type="button"
          className="ida-btn ida-btn-outline-primary ida-btn-sm"
          onClick={acceptAll}
          disabled={suggestions.length === 0}
        >
          Accept all suggestions
        </button>
      </div>

      <section className="card">
        <h3 className="card-title">Downstream Failure Indicators by Infrastructure</h3>
        <p className="text-secondary mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
          Each infrastructure below lists likely downstream operational failures observed in your answers
          (for example pumps, critical hosted services, or command-and-control functions).
        </p>
        {downstreamIndicators.length === 0 ? (
          <p className="text-secondary mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>
            No downstream indicators yet. Complete infrastructure answers to populate this view.
          </p>
        ) : (
          <ul className="list-group list-group-flush">
            {downstreamIndicators.map((indicator) => (
              <li key={indicator.category} className="list-group-item">
                <div className="fw-semibold mb-2">{CATEGORY_LABELS[indicator.category]}</div>
                <ul className="mb-2" style={{ paddingLeft: '1.25rem' }}>
                  {indicator.failures.map((failure, idx) => (
                    <li key={`${indicator.category}-${idx}`} style={{ fontSize: 'var(--font-size-sm)' }}>
                      {failure}
                    </li>
                  ))}
                </ul>
                {indicator.sources.length > 0 && (
                  <div style={{ fontSize: '0.75rem' }} className="text-secondary">
                    <strong>Based on:</strong> {indicator.sources.join(', ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D1: Suggested Dependencies */}
      <section className="card">
        <h3 className="card-title">Suggested Dependencies</h3>
        {hashChanged && (
          <p className="text-secondary mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
            Assessment changed since last refresh. Click &quot;Refresh suggestions&quot; to update.
          </p>
        )}
        {suggestions.length === 0 ? (
          <p className="text-secondary mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>No suggestions. Complete dependency tabs to see auto-suggested edges.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {suggestions.map((e, i) => {
              const isExpanded = expandedReasonIndex === i;
              return (
                <li
                  key={`${e.from_category}-${e.to_category}-${e.purpose}-${i}`}
                  className="list-group-item"
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                    <span>
                    <span style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                      <strong>{CATEGORY_LABELS[e.from_category]}</strong> →{' '}
                      <strong>{CATEGORY_LABELS[e.to_category]}</strong>
                      {' · '}
                      {PURPOSE_LABELS[e.purpose]}
                      {' · '}
                      {TIME_BUCKET_LABELS[e.time_to_cascade_bucket]}
                      {' · '}
                      <span className="text-muted">{e.reason.confidence}</span>
                    </span>
                    </span>
                    <span style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="ida-btn ida-btn-sm ida-btn-success"
                        onClick={() => accept(e)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="ida-btn ida-btn-sm ida-btn-outline-secondary"
                        onClick={() => reject(e)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="ida-btn ida-btn-sm ida-btn-outline-primary"
                        onClick={() => openEdit(e, null, true)}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ida-btn ida-btn-sm ida-btn-link p-0 text-decoration-none"
                    onClick={() => setExpandedReasonIndex(isExpanded ? null : i)}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {isExpanded ? '▼' : '▶'} Why was this suggested?
                  </button>
                  {isExpanded && e.reason && (
                    <div className="mt-2 p-2 border rounded" style={{ background: 'var(--background-alt, #f8fafc)', fontSize: '0.875rem' }}>
                      <div className="mb-2">
                        <strong>Reasoning:</strong>
                        <ul className="mb-1 mt-1" style={{ paddingLeft: '1.5rem' }}>
                          {e.reason.drivers.map((driver, idx) => (
                            <li key={idx}>{driver}</li>
                          ))}
                        </ul>
                      </div>
                      {Array.isArray(e.reason.downstream_failures) && e.reason.downstream_failures.length > 0 && (
                        <div className="mb-2">
                          <strong>Downstream failures to validate:</strong>
                          <ul className="mb-1 mt-1" style={{ paddingLeft: '1.5rem' }}>
                            {e.reason.downstream_failures.map((failure, idx) => (
                              <li key={idx}>{failure}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <strong>Based on:</strong>
                        <span className="ms-1 text-secondary">{e.reason.sources.join(', ')}</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Edge Classification Legend */}
      <EdgeLegend />

      {/* D2: Confirmed Cross-Dependencies */}
      <section className="card">
        <h3 className="card-title">Confirmed Cross-Dependencies</h3>
        {confirmed.length === 0 ? (
          <p className="text-secondary mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>No confirmed edges. Accept suggestions above.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {confirmed.map((e, i) => (
              <li
                key={`c-${e.from_category}-${e.to_category}-${e.purpose}-${i}`}
                className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2"
              >
                <span>
                <span style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                  <strong>{CATEGORY_LABELS[e.from_category]}</strong> →{' '}
                  <strong>{CATEGORY_LABELS[e.to_category]}</strong>
                  {' · '}
                  {PURPOSE_LABELS[e.purpose]}
                  {' · '}
                  {e.criticality}
                  {' · '}
                  {TIME_BUCKET_LABELS[e.time_to_cascade_bucket]}
                </span>
                </span>
                <span style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="ida-btn ida-btn-sm ida-btn-outline-primary"
                    onClick={() => openEdit(e, i, false)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ida-btn ida-btn-sm ida-btn-outline-danger"
                    onClick={() => removeConfirmed(i)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D3: Matrix View */}
      {confirmed.length > 0 && (
        <section className="card">
          <h3 className="card-title">Matrix View</h3>
          <p className="text-secondary mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
            Click a cell to edit the edge.
          </p>
          <div className="overflow-x-auto">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th></th>
                  {Object.entries(CATEGORY_LABELS).map(([code]) => (
                    <th key={code} style={{ fontSize: '0.75rem' }}>
                      {CATEGORY_LABELS[code as CrossDependencyCategory]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORY_LABELS).map(([fromCode]) => (
                  <tr key={fromCode}>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {CATEGORY_LABELS[fromCode as CrossDependencyCategory]}
                    </td>
                    {Object.entries(CATEGORY_LABELS).map(([toCode]) => {
                      const edge = confirmed.find(
                        (e) => e.from_category === fromCode && e.to_category === toCode
                      );
                      const cellStyle: React.CSSProperties = {
                        padding: 2,
                        textAlign: 'center',
                        ...(edge ? { background: 'rgba(13, 110, 253, 0.08)' } : {}),
                      };
                      return (
                        <td key={toCode} style={cellStyle}>
                          {edge ? (
                            <button
                              type="button"
                              className="ida-btn ida-btn-sm ida-btn-outline-primary"
                              style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}
                              onClick={() => {
                                const idx = confirmed.indexOf(edge);
                                openEdit(edge, idx, false);
                              }}
                              title={[
                                `${CATEGORY_LABELS[edge.from_category]} → ${CATEGORY_LABELS[edge.to_category]}`,
                                `Purpose: ${PURPOSE_LABELS[edge.purpose]}`,
                                `Criticality: ${edge.criticality}`,
                                `Timing: ${TIME_BUCKET_LABELS[edge.time_to_cascade_bucket]}`,
                                `Confidence: ${edge.confidence}`,
                              ].join('\n')}
                              aria-label={`Edit dependency from ${CATEGORY_LABELS[edge.from_category]} to ${CATEGORY_LABELS[edge.to_category]}`}
                            >
                              ✓
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* D4: Derived Flags */}
      {(derived.circular_dependencies.length > 0 || derived.common_mode_spof.length > 0 || moduleFlags.length > 0) && (
        <section className="card" style={{ borderLeft: '4px solid var(--cisa-orange, #e87500)' }}>
          <h3 className="card-title">Derived Flags</h3>
          
          {/* Structural Dependency Flags */}
          {(derived.circular_dependencies.length > 0 || derived.common_mode_spof.length > 0) && (
            <div className="mb-4">
              <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', marginBottom: 'var(--spacing-md)', color: 'var(--cisa-orange, #e87500)' }}>
                Structural Dependency Flags
              </h4>
              <p className="text-secondary mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                Flags derived from confirmed cross-dependency edges.
              </p>
              
              {derived.circular_dependencies.length > 0 && (
                <div className="mb-3">
                  <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', marginBottom: 'var(--spacing-sm)' }}>Circular dependencies detected</h5>
                  <ul className="list-unstyled mb-0">
                    {derived.circular_dependencies.map((c, i) => (
                      <li key={i} className="mb-1">
                        <span className="text-danger">●</span>{' '}
                        {formatCircularPath(c.path)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {derived.common_mode_spof.length > 0 && (
                <div>
                  <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', marginBottom: 'var(--spacing-sm)' }}>Common-mode SPOF risk</h5>
                  <ul className="list-unstyled mb-0">
                    {derived.common_mode_spof.map((f, i) => (
                      <li key={i} className="mb-1">
                        <span className="text-warning">●</span>{' '}
                        <strong>{CATEGORY_LABELS[f.upstream_category]}</strong> →{' '}
                        {f.affected_categories.map((c) => CATEGORY_LABELS[c]).join(', ')}
                        {' · '}
                        <span className="text-secondary">{f.rationale}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Module-Based Flags */}
          {moduleFlags.length > 0 && (
            <div>
              <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold', marginBottom: 'var(--spacing-md)', color: 'var(--cisa-orange, #e87500)' }}>
                Module-Based Flags
              </h4>
              <p className="text-secondary mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                Flags derived from enabled cross-dependency modules.
              </p>
              <ul className="list-unstyled mb-0">
                {moduleFlags.map((f) => (
                  <li key={f.id} className="mb-2">
                    <span className="text-info">●</span>{' '}
                    <strong>{f.title}:</strong> <span className="text-secondary">{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Edge Editor Drawer */}
      {editingEdge && (
        <EdgeEditorDrawer
          edge={editingEdge}
          onSave={updateEdge}
          onCancel={() => {
            setEditingEdge(null);
            setEditingIndex(null);
            setEditingIsSuggestion(false);
          }}
        />
      )}
    </div>
  );
}

function EdgeEditorDrawer({
  edge,
  onSave,
  onCancel,
}: {
  edge: CrossDependencyEdge;
  onSave: (e: CrossDependencyEdge) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(edge);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edge-editor-title"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(400px, 100vw)',
        background: 'var(--background, #fff)',
        borderLeft: '1px solid var(--cisa-gray-light)',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 1050,
        overflow: 'auto',
        padding: '1.5rem',
      }}
    >
      <h3 id="edge-editor-title" style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-lg)' }}>Edit Cross-Dependency</h3>
      <div className="mb-2">
        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
          {CATEGORY_LABELS[form.from_category]} → {CATEGORY_LABELS[form.to_category]}
        </span>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Purpose</label>
        <select
          className="form-control form-control-sm"
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value as CrossDependencyEdge['purpose'] })}
        >
          {PURPOSE_OPTIONS.map((o) => (
            <option key={o} value={o}>{PURPOSE_LABELS[o]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Criticality</label>
        <select
          className="form-control form-control-sm"
          value={form.criticality}
          onChange={(e) => setForm({ ...form, criticality: e.target.value as CrossDependencyEdge['criticality'] })}
        >
          {CRITICALITY_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Time to cascade</label>
        <select
          className="form-control form-control-sm"
          value={form.time_to_cascade_bucket}
          onChange={(e) =>
            setForm({ ...form, time_to_cascade_bucket: e.target.value as CrossDependencyEdge['time_to_cascade_bucket'] })
          }
        >
          {TIME_BUCKET_OPTIONS.map((o) => (
            <option key={o} value={o}>{TIME_BUCKET_LABELS[o]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Single path (SPOF)</label>
        <select
          className="form-control form-control-sm"
          value={form.single_path}
          onChange={(e) => setForm({ ...form, single_path: e.target.value as CrossDependencyEdge['single_path'] })}
        >
          {SINGLE_PATH_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Confidence</label>
        <select
          className="form-control form-control-sm"
          value={form.confidence}
          onChange={(e) => setForm({ ...form, confidence: e.target.value as CrossDependencyEdge['confidence'] })}
        >
          {CONFIDENCE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Notes (optional)</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.notes ?? ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value || undefined })}
          placeholder="Optional notes"
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button type="button" className="ida-btn ida-btn-primary ida-btn-sm" onClick={() => onSave(form)}>
          Save
        </button>
        <button type="button" className="ida-btn ida-btn-outline-secondary ida-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function shouldShowModuleQuestion(question: ModuleQuestionConfig, answers: Record<string, unknown>): boolean {
  if (!question.showWhen || question.showWhen.length === 0) return true;
  return question.showWhen.every((cond) => String(answers[cond.questionId]) === cond.equals);
}

function ModuleQuestion({
  question,
  answers,
  onChange,
}: {
  question: ModuleQuestionConfig;
  answers: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const value = answers[question.id];
  const help = question.help_text?.trim();
  const id = `module-q-${question.id}`;
  const update = (nextVal: unknown) => onChange({ ...answers, [question.id]: nextVal });

  const label = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{question.prompt}</span>
      {help && <HelpIcon help={help} id={`${id}-help`} />}
    </div>
  );

  if (question.type === 'TRI_STATE') {
    return (
      <div id={id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', backgroundColor: 'var(--cisa-white)' }}>
        {label}
        <div className="radio-group" style={{ marginTop: 'var(--spacing-md)' }}>
          {(['YES', 'NO', 'UNKNOWN'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }}>
              <input
                type="radio"
                name={id}
                value={opt}
                checked={value === opt}
                onChange={() => update(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'FOUR_STATE') {
    return (
      <div id={id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', backgroundColor: 'var(--cisa-white)' }}>
        {label}
        <div className="radio-group" style={{ marginTop: 'var(--spacing-md)' }}>
          {(['YES', 'NO', 'PARTIAL', 'UNKNOWN'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }}>
              <input
                type="radio"
                name={id}
                value={opt}
                checked={value === opt}
                onChange={() => update(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div id={id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', backgroundColor: 'var(--cisa-white)' }}>
        {label}
        <div className="checkbox-group" style={{ marginTop: 'var(--spacing-md)' }}>
          {(question.options ?? []).map((opt) => (
            <div key={opt} className="checkbox-item">
              <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter((v: string) => v !== opt);
                    update(next);
                  }}
                />
                <span>{opt}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'SHORT_TEXT') {
    return (
      <div id={id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', backgroundColor: '#fff' }}>
        {label}
        <input
          type="text"
          className="form-control"
          style={{ marginTop: 'var(--spacing-md)' }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => update(e.target.value)}
        />
      </div>
    );
  }

  if (question.type === 'LONG_TEXT') {
    return (
      <div id={id} style={{ border: '1px solid var(--cisa-border, #d0d0d0)', borderRadius: 'var(--border-radius, 4px)', padding: 'var(--spacing-md)', backgroundColor: '#fff' }}>
        {label}
        <textarea
          className="form-control"
          style={{ marginTop: 'var(--spacing-md)' }}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => update(e.target.value)}
        />
      </div>
    );
  }

  return null;
}
