'use client';

import { useState, useEffect } from 'react';
import type { SubtypeGuidance } from '@/app/lib/types/baseline';
import SubtypeReferenceImplPanel from '@/app/components/SubtypeReferenceImplPanel';

interface IntentPanelProps {
  defaultOpen?: boolean;
  disciplineSubtypeId?: string | null | undefined; // Gating signal: Reference Impl first, then Subtype Overview
  subtypeCode?: string | null | undefined; // For fallback to subtype doctrine
  subtypeGuidance?: SubtypeGuidance | null | undefined; // For fallback to subtype doctrine
}

/**
 * IntentPanel Component
 * 
 * Displays intent guidance for a question in a collapsible panel.
 * Read-only UI aid - does not affect scoring.
 * 
 * MANDATORY Rendering Precedence (LEGACY INTENT REMOVED):
 * 
 * IF (discipline_subtype_id exists):
 *   Attempt to load Reference Implementation by discipline_subtype_id
 *   
 *   IF (Reference Implementation exists):
 *     Render Reference Implementation content ONLY
 *   
 *   ELSE (no Reference Implementation exists):
 *     Render subtype doctrine Overview ONLY
 * 
 * ELSE (discipline_subtype_id does not exist):
 *   Render: "No subtype is assigned to this question."
 * 
 * Legacy intent blocks (Intent, What counts as YES, What does NOT count,
 * Typical evidence, Field tip, References) are REMOVED from the product path entirely.
 */
export default function IntentPanel({ 
  defaultOpen = false, 
  disciplineSubtypeId,
  subtypeCode,
  subtypeGuidance,
}: IntentPanelProps) {
  void subtypeCode; // reserved for future use

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasReferenceImpl, setHasReferenceImpl] = useState<boolean | null>(null); // null = checking, true = exists, false = not found
  const [subtypeOverview, setSubtypeOverview] = useState<{ overview: string; references?: string[] } | null>(null);

  // Check if reference_impl exists and load subtype overview when disciplineSubtypeId is provided
  useEffect(() => {
    if (!disciplineSubtypeId) {
      queueMicrotask(() => {
        setHasReferenceImpl(false);
        setSubtypeOverview(null);
      });
      return;
    }

    const loadSubtypeContent = async () => {
      try {
        // First check for Reference Implementation
        const refImplResponse = await fetch(
          `/api/reference/discipline-subtypes/${encodeURIComponent(disciplineSubtypeId)}/reference-impl`
        );
        const hasRefImpl = refImplResponse.status === 200;
        setHasReferenceImpl(hasRefImpl);

        // If no Reference Implementation, load subtype overview from database
        if (!hasRefImpl) {
          try {
            const overviewResponse = await fetch(
              `/api/reference/discipline-subtypes?subtype_id=${encodeURIComponent(disciplineSubtypeId)}`
            );
            if (overviewResponse.ok) {
              const data = await overviewResponse.json();
              const subtype = data.subtypes?.[0];
              if (subtype?.overview) {
                setSubtypeOverview({
                  overview: subtype.overview,
                  references: Array.isArray(subtype.standards_references) ? subtype.standards_references : []
                });
              } else {
                setSubtypeOverview(null);
              }
            } else {
              setSubtypeOverview(null);
            }
          } catch (overviewError) {
            console.error('Error loading subtype overview:', overviewError);
            setSubtypeOverview(null);
          }
        } else {
          setSubtypeOverview(null);
        }
      } catch (error) {
        console.error('Error checking reference implementation:', error);
        setHasReferenceImpl(false);
        setSubtypeOverview(null);
      }
    };

    loadSubtypeContent();
  }, [disciplineSubtypeId]);

  return (
    <div style={{
      border: '1px solid var(--cisa-gray-light)',
      borderRadius: 'var(--border-radius)',
      marginTop: 'var(--spacing-sm)',
      backgroundColor: '#f9fafb'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--cisa-blue)'
        }}
      >
        <span>What this question means</span>
        <span style={{ fontSize: 'var(--font-size-xs)' }}>
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
          {/* Content: Reference Implementation OR Subtype Overview OR No subtype */}
          {disciplineSubtypeId ? (
            <>
              {/* IF checking for reference_impl: Show loading */}
              {hasReferenceImpl === null ? (
                <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--cisa-gray)', fontStyle: 'italic', fontSize: 'var(--font-size-xs)' }}>
                  Loading subtype guidance...
                </div>
              ) : /* ELSE IF reference_impl exists: Show ONLY Reference Implementation */
              hasReferenceImpl === true ? (
                <SubtypeReferenceImplPanel
                  disciplineSubtypeId={disciplineSubtypeId}
                  onFallbackToDoctrine={() => {}}
                />
              ) : /* ELSE (no reference_impl): Show ONLY subtype doctrine Overview */
              (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  {subtypeOverview?.overview ? (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
                        Overview
                      </div>
                      <div style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.6 }}>
                        {subtypeOverview.overview}
                      </div>
                      {subtypeOverview.references && subtypeOverview.references.length > 0 && (
                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
                            References
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--cisa-gray)', fontSize: 'var(--font-size-xs)' }}>
                            {subtypeOverview.references.map((ref, idx) => (
                              <li key={idx} style={{ marginBottom: 'var(--spacing-xs)', lineHeight: 1.5 }}>
                                {ref}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : subtypeGuidance?.overview ? (
                    // Fallback to props if database query failed
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--cisa-gray-dark)' }}>
                        Overview
                      </div>
                      <div style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.6 }}>
                        {subtypeGuidance.overview}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--cisa-gray)', fontStyle: 'italic', fontSize: 'var(--font-size-xs)' }}>
                      No subtype reference implementation exists yet for this subtype.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : /* ELSE (no discipline_subtype_id): Show "No subtype assigned" */
          (
            <div style={{ marginBottom: 'var(--spacing-md)', color: 'var(--cisa-gray)', fontStyle: 'italic', fontSize: 'var(--font-size-xs)' }}>
              No subtype is assigned to this question.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
