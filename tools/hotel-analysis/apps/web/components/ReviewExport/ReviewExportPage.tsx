'use client';

import React, { useMemo, useState } from 'react';
import Link from '@/components/FieldLink';
import { useAssessment } from '@/lib/assessment-context';
import type { Assessment } from 'schema';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { buildReportVMForReview } from '@/app/lib/report/build_report_vm_client';
import { getTemplateCheck } from '@/lib/api';
import { computeCompletion } from '@/app/lib/assessment/completion';
import { reviewExportCopy } from '@/lib/uiCopy/reviewExportCopy';
import { AssessmentStatusStrip } from './AssessmentStatusStrip';
import { ExecutiveSummaryPreview } from './sections/ExecutiveSummaryPreview';
import { InfrastructureSectionsPreview } from './sections/InfrastructureSectionsPreview';
import { CrossDependencyPreview } from './sections/CrossDependencyPreview';
import { SynthesisPreview } from './sections/SynthesisPreview';
import { ExportPanel } from './ExportPanel';

type PageState = 'loading' | 'ready' | 'error';

/**
 * NEW Review & Export page: report-structured preview instead of legacy grid.
 * 
 * LAYOUT (top to bottom):
 * - Header (title + template status)
 * - Assessment Status Strip (badges with completion %, triggers, etc.)
 * - Executive Summary Preview (collapsible)
 * - Asset Dependency Visualization Preview
 * - Infrastructure Sections (5 accordion panels)
 * - Cross-Dependency Preview (collapsible)
 * - Synthesis Preview (collapsible)
 * - Methodology & Appendices (collapsed by default)
 * - Export Panel (sticky at bottom)
 */
export function ReviewExportPage() {
  const { assessment } = useAssessment();
  const [pageState, setPageState] = useState<PageState>('ready');
  const [error, setError] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState<boolean | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    infrastructure_power: false,
    infrastructure_comms: false,
    infrastructure_it: false,
    infrastructure_water: false,
    infrastructure_wastewater: false,
    crossDependency: false,
    synthesis: false,
    methodology: false,
    appendices: false,
  });

  const praSlaEnabled = isPraSlaEnabled(assessment);
  const crossDependencyEnabled = isCrossDependencyEnabled(assessment);

  // Source of truth on Review page is the in-memory assessment object.
  // Do not overlay localStorage sessions here; stale browser sessions can diverge from imported/restored assessment data.
  const mergedAssessment = useMemo(() => {
    return assessment ?? ({ categories: {} } as Assessment);
  }, [assessment]);

  const completion = useMemo(() => computeCompletion(mergedAssessment), [mergedAssessment]);

  const reportVM = useMemo(() => {
    try {
      return buildReportVMForReview(mergedAssessment, {
        completion,
        templateReady: templateReady === true,
      });
    } catch (e) {
      console.error('Failed to build ReportVM:', e);
      return null;
    }
  }, [mergedAssessment, completion, templateReady]);

  // Fetch template status on mount
  React.useEffect(() => {
    getTemplateCheck()
      .then((r) => setTemplateReady(r.ok))
      .catch(() => setTemplateReady(false));
  }, []);

  const toggleSection = (sectionKey: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <div style={{ paddingBottom: '200px' }}>
      {/* HEADER */}
      <section className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="card-title">{reviewExportCopy.pageTitle}</h2>
            <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
              {reviewExportCopy.pageDescription}
            </p>
            {templateReady !== null && (
              <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-sm)' }}>
                {reviewExportCopy.templateLabel}{' '}
                {templateReady ? (
                  <span style={{ color: 'var(--color-success, #0a0)', fontWeight: 600 }}>{reviewExportCopy.templateReady}</span>
                ) : (
                  <span style={{ color: 'var(--color-danger, #c00)', fontWeight: 600 }}>
                    {reviewExportCopy.templateMissingAnchors} {' '}
                    <Link href="/template-readiness?dev=1" style={{ fontSize: 'inherit' }}>{reviewExportCopy.templateDetailsLink}</Link>
                  </span>
                )}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            {process.env.NEXT_PUBLIC_REPORT_DEBUG === '1' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="checkbox"
                  defaultChecked={false}
                  style={{ cursor: 'pointer' }}
                />
                {reviewExportCopy.debugPreview}
              </label>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      {/* ASSESSMENT STATUS STRIP */}
      <AssessmentStatusStrip completion={completion} reportVM={reportVM} />

      {/* FINAL REPORT PREVIEW */}
      <section className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 'var(--spacing-md)',
            marginBottom: expandedSections.synthesis ? 'var(--spacing-md)' : 0,
            borderBottom: expandedSections.synthesis ? '1px solid var(--cisa-gray-light)' : 'none',
          }}
          onClick={() => toggleSection('synthesis')}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>Final Report Preview</h3>
          <span style={{ fontSize: '1.5rem' }}>{expandedSections.synthesis ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
        </div>
        {expandedSections.synthesis && (
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p className="text-secondary" style={{ marginTop: 0 }}>
              The executive summary, citations, and vulnerabilities are included in the report payload and will render in the final DOCX output.
            </p>
            <ExecutiveSummaryPreview assessment={assessment} reportVM={reportVM ?? null} completion={completion} showHelp={true} />
            <SynthesisPreview assessment={assessment} reportVM={reportVM ?? null} showHelp={true} />
          </div>
        )}
      </section>

      {/* INFRASTRUCTURE SECTIONS PREVIEW */}
      <InfrastructureSectionsPreview
        assessment={mergedAssessment}
        reportVM={reportVM}
        expandedSections={expandedSections}
        toggleSection={toggleSection as (key: string) => void}
        showHelp={true}
      />

      {/* CROSS-DEPENDENCY PREVIEW */}
      {crossDependencyEnabled && (
        <section className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              padding: 'var(--spacing-md)',
              marginBottom: expandedSections.crossDependency ? 'var(--spacing-md)' : 0,
              borderBottom: expandedSections.crossDependency ? '1px solid var(--cisa-gray-light)' : 'none',
            }}
            onClick={() => toggleSection('crossDependency')}
          >
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>
              {reviewExportCopy.crossDependencyCascadingRisk}
            </h3>
            <span style={{ fontSize: '1.5rem' }}>{expandedSections.crossDependency ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
          </div>
          {expandedSections.crossDependency && (
            <div style={{ padding: 'var(--spacing-md)' }}>
              <CrossDependencyPreview assessment={mergedAssessment} reportVM={reportVM} showHelp={true} />
            </div>
          )}
        </section>
      )}

      {/* METHODOLOGY & APPENDICES (collapsed by default) */}
      <section className="card" style={{ marginBottom: '200px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 'var(--spacing-md)',
            marginBottom: expandedSections.methodology ? 'var(--spacing-md)' : 0,
            borderBottom: expandedSections.methodology ? '1px solid var(--cisa-gray-light)' : 'none',
          }}
          onClick={() => toggleSection('methodology')}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: 0 }}>{reviewExportCopy.methodologyAppendices}</h3>
          <span style={{ fontSize: '1.5rem' }}>{expandedSections.methodology ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
        </div>
        {expandedSections.methodology && (
          <div style={{ padding: 'var(--spacing-md)' }}>
            {reportVM?.methodology?.sections?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {reportVM.methodology.sections.map((section, idx) => (
                  <div key={idx}>
                    <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>{section.heading}</h5>
                    {section.paragraphs?.map((p, pidx) => (
                      <p key={pidx} className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', margin: pidx ? '0.5rem 0 0 0' : 0, lineHeight: 1.6 }}>
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                Not available (not generated). Complete the assessment to populate methodology.
              </p>
            )}
          </div>
        )}
      </section>

      {/* EXPORT PANEL (sticky) */}
      <ExportPanel
        assessment={mergedAssessment}
        templateReady={templateReady}
        completion={completion}
        reportVM={reportVM}
      />
    </div>
  );
}
