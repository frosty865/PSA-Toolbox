'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAssessment } from '@/lib/assessment-context';
import type { Assessment } from 'schema';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { buildReportVMForReview } from '@/app/lib/report/build_report_vm_client';
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
    executiveSummary: true,
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
    const fetchTemplateStatus = async () => {
      try {
        const response = await fetch('/api/template/check');
        const result = await response.json();
        setTemplateReady(result.ok ?? false);
      } catch (e) {
        setTemplateReady(false);
      }
    };
    fetchTemplateStatus();
  }, []);

  const toggleSection = (sectionKey: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <div className="ida-review-shell">
      {/* HEADER */}
      <section className="card ida-review-card">
        <div className="ida-review-header">
          <div>
            <h2 className="card-title">{reviewExportCopy.pageTitle}</h2>
            <p className="text-secondary ida-review-description">
              {reviewExportCopy.pageDescription}
            </p>
            {templateReady !== null && (
              <p className="ida-review-template-status">
                {reviewExportCopy.templateLabel}{' '}
                {templateReady ? (
                  <span className="ida-review-template-ok">{reviewExportCopy.templateReady}</span>
                ) : (
                  <span className="ida-review-template-error">
                    {reviewExportCopy.templateMissingAnchors} {' '}
                    <Link href="/template-readiness?dev=1" className="ida-review-template-link">{reviewExportCopy.templateDetailsLink}</Link>
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="ida-review-header-actions">
            {process.env.NEXT_PUBLIC_REPORT_DEBUG === '1' && (
              <label className="ida-review-debug-toggle">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  className="ida-review-debug-input"
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

      {/* EXECUTIVE SUMMARY PREVIEW */}
      <section className="card ida-review-card">
        <div
          className={`ida-accordion-header ${expandedSections.executiveSummary ? 'is-open' : ''}`}
          onClick={() => toggleSection('executiveSummary')}
        >
          <h3 className="ida-accordion-title">{reviewExportCopy.executiveSummary}</h3>
          <span className="ida-accordion-indicator">{expandedSections.executiveSummary ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
        </div>
        {expandedSections.executiveSummary && (
          <div className="ida-accordion-body">
            <ExecutiveSummaryPreview assessment={mergedAssessment} reportVM={reportVM} completion={completion} showHelp={true} />
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
        <section className="card ida-review-card">
          <div
            className={`ida-accordion-header ${expandedSections.crossDependency ? 'is-open' : ''}`}
            onClick={() => toggleSection('crossDependency')}
          >
            <h3 className="ida-accordion-title">
              {reviewExportCopy.crossDependencyCascadingRisk}
            </h3>
            <span className="ida-accordion-indicator">{expandedSections.crossDependency ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
          </div>
          {expandedSections.crossDependency && (
            <div className="ida-accordion-body">
              <CrossDependencyPreview assessment={mergedAssessment} reportVM={reportVM} showHelp={true} />
            </div>
          )}
        </section>
      )}

      {/* SYNTHESIS PREVIEW */}
      <section className="card ida-review-card">
        <div
          className={`ida-accordion-header ${expandedSections.synthesis ? 'is-open' : ''}`}
          onClick={() => toggleSection('synthesis')}
        >
          <h3 className="ida-accordion-title">{reviewExportCopy.synthesisAnalysis}</h3>
          <span className="ida-accordion-indicator">{expandedSections.synthesis ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
        </div>
        {expandedSections.synthesis && (
          <div className="ida-accordion-body">
            <SynthesisPreview assessment={assessment} reportVM={reportVM ?? null} showHelp={true} />
          </div>
        )}
      </section>

      {/* METHODOLOGY & APPENDICES (collapsed by default) */}
      <section className="card ida-review-card ida-review-card-final">
        <div
          className={`ida-accordion-header ${expandedSections.methodology ? 'is-open' : ''}`}
          onClick={() => toggleSection('methodology')}
        >
          <h3 className="ida-accordion-title">{reviewExportCopy.methodologyAppendices}</h3>
          <span className="ida-accordion-indicator">{expandedSections.methodology ? reviewExportCopy.expandIndicator : reviewExportCopy.collapseIndicator}</span>
        </div>
        {expandedSections.methodology && (
          <div className="ida-accordion-body">
            {reportVM?.methodology?.sections?.length ? (
              <div className="ida-review-methodology-list">
                {reportVM.methodology.sections.map((section, idx) => (
                  <div key={idx}>
                    <h5 className="ida-review-methodology-heading">{section.heading}</h5>
                    {section.paragraphs?.map((p, pidx) => (
                      <p key={pidx} className={`text-secondary ida-review-methodology-copy ${pidx ? 'ida-review-methodology-copy-gap' : ''}`}>
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-secondary ida-review-methodology-empty">
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
