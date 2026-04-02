'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from '@/components/FieldLink';
import { useAssessment } from '@/lib/assessment-context';
import { exportFinal, downloadFinalExport, ApiError } from '@/lib/api';
import { isFieldStaticMode } from '@/lib/field/isFieldStaticMode';
import { loadEnergyAnswers } from '@/app/lib/dependencies/persistence';
import { reviewExportCopy, getExportFilename } from '@/lib/uiCopy/reviewExportCopy';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { computeExportPreflight, SECTOR_LABELS } from '@/app/lib/assessment/completion';
import type { CompletionResult } from '@/app/lib/assessment/completion';
import type { SectorKey } from '@/app/lib/assessment/completion';
import type { ReportVMWithPreflight } from '@/app/lib/report/build_report_vm_client';
import { buildProgressFileV2 } from '@/app/lib/io/progressFile';
import { collectAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import type { Assessment } from 'schema';

type ReportStage = 'idle' | 'starting' | 'loading_assessment' | 'validating' | 'assembling' | 'rendering' | 'done' | 'error';

/**
 * Export Panel: Sticky footer with export buttons and status.
 * Export disabled when preflight fails (template, completion, or curve points).
 */
export function ExportPanel({
  assessment,
  templateReady,
  completion,
  reportVM = null,
}: {
  assessment: Assessment | null;
  templateReady: boolean | null;
  completion: CompletionResult;
  reportVM?: ReportVMWithPreflight | null;
}) {
  const { assessment: ctxAssessment } = useAssessment();
  const currentAssessment = assessment || ctxAssessment;

  const preflight = useMemo(() => {
    if (reportVM?.preflight) {
      return {
        canExport: reportVM.preflight.can_export,
        errors: reportVM.preflight.blockers.map((b) => b.message),
        errorDetails: reportVM.preflight.blockers.map((b) => ({
          message: b.message,
          sector: b.sector,
        })),
      };
    }
    const a = currentAssessment ?? { categories: {} };
    return computeExportPreflight(a, completion, templateReady === true);
  }, [currentAssessment, completion, templateReady, reportVM]);

  const [reportStage, setReportStage] = useState<ReportStage>('idle');
  const [reportErrorDetail, setReportErrorDetail] = useState<string | null>(null);
  const [reportRequestId, setReportRequestId] = useState<string | null>(null);
  const reportInFlightRef = useRef(false);

  const handleDownloadReport = async () => {
    if (reportInFlightRef.current || !preflight.canExport) return;

    reportInFlightRef.current = true;
    setReportErrorDetail(null);
    setReportRequestId(null);
    setReportStage('starting');

    try {
      setReportStage('loading_assessment');
      setReportStage('validating');
      setReportStage('assembling');
      setReportStage('rendering');

      // Source of truth for DOCX export from Review page is the current in-memory assessment.
      // Avoid localStorage session overlay here to prevent stale-session drift.
      const assessmentForReport = currentAssessment;

      const energyStored = typeof window !== 'undefined' ? loadEnergyAnswers() : null;

      const energy_dependency =
        energyStored?.derived
          ? {
              dataBlocks: energyStored.derived.reportBlocks,
              vulnerabilities: energyStored.derived.vulnerabilities,
              ofcs: energyStored.derived.ofcs,
              themedFindings: energyStored.derived.themedFindings ?? [],
              knowledgeGaps: energyStored.derived.knowledgeGaps ?? [],
            }
          : undefined;

      const blob = await exportFinal(assessmentForReport, {
        timeoutMs: 120000,
        energy_dependency,
      });

      setReportStage('done');
      downloadFinalExport(blob, assessmentForReport);
    } catch (e) {
      setReportStage('error');
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Report generation failed';
      const details = e instanceof ApiError ? e.details : undefined;
      const serverDetails = details && typeof details === 'object' ? (details as Record<string, unknown>).details : undefined;
      const flat = (typeof serverDetails === 'object' && serverDetails !== null ? serverDetails : details) as Record<string, unknown> | undefined;
      let fullDetail = msg;
      if (flat && typeof flat === 'object') {
        const templatePath = flat.template_path;
        const repoRoot = flat.repo_root;
        if (typeof templatePath === 'string' && templatePath) fullDetail += `\n\nTemplate path: ${templatePath}`;
        if (typeof repoRoot === 'string' && repoRoot) fullDetail += `\n\nRepo root: ${repoRoot}`;
        const stderr = flat.reporter_stderr;
        const stdout = flat.reporter_stdout;
        const errMsg = flat.error_message;
        if (typeof stderr === 'string' && stderr) fullDetail += `\n\nReporter stderr:\n${stderr}`;
        if (typeof stdout === 'string' && stdout) fullDetail += `\n\nReporter stdout:\n${stdout}`;
        if (typeof errMsg === 'string' && errMsg && !fullDetail.includes(errMsg)) fullDetail += `\n\n${errMsg}`;
      }
      setReportErrorDetail(fullDetail);
      const requestId = (details && typeof details === 'object' && (details as Record<string, unknown>).request_id) as string | undefined
        ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `req-${Date.now()}`);
      setReportRequestId(requestId);
    } finally {
      reportInFlightRef.current = false;
    }
  };

  const handleReportRetry = () => {
    setReportStage('idle');
    setReportErrorDetail(null);
    setReportRequestId(null);
  };

  const handleExportJson = () => {
    if (!currentAssessment) return;
    const sanitized = sanitizeAssessmentBeforeSave(currentAssessment);
    const sessions = typeof window !== 'undefined' ? collectAllSessionsFromLocalStorage() : undefined;
    const file = buildProgressFileV2(sanitized, sessions);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', getExportFilename(currentAssessment.meta?.created_at_iso, 'json'));
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid var(--cisa-gray-light)',
        padding: 'var(--spacing-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportJson}
          disabled={!currentAssessment}
        >
          {reviewExportCopy.exportJsonButton}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownloadReport}
          disabled={!preflight.canExport || (reportStage !== 'idle' && reportStage !== 'done' && reportStage !== 'error')}
        >
          {reportStage === 'rendering' || reportStage === 'assembling' || reportStage === 'loading_assessment' || reportStage === 'validating' || reportStage === 'starting'
            ? reviewExportCopy.generatingReport
            : isFieldStaticMode()
              ? 'Export report (JSON)'
              : reviewExportCopy.exportDocxButton}
        </button>

        {reportStage !== 'idle' && reportStage !== 'done' && reportStage !== 'error' && (
          <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
            {reportStage === 'starting' && reviewExportCopy.starting}
            {(reportStage === 'loading_assessment' || reportStage === 'validating') && reviewExportCopy.validating}
            {reportStage === 'assembling' && reviewExportCopy.assembling}
            {reportStage === 'rendering' && reviewExportCopy.rendering}
          </span>
        )}

        {reportStage === 'error' && (
          <button type="button" className="btn btn-secondary" onClick={handleReportRetry}>
            {reviewExportCopy.retryButton}
          </button>
        )}

        <Link href="/assessment/new/" className="btn btn-secondary">
          {reviewExportCopy.exportImportJsonLink}
        </Link>
      </div>

      {!preflight.canExport && preflight.errors.length > 0 && (
        <div style={{ width: '100%' }}>
          <div className="alert alert-warning" role="alert" style={{ marginBottom: 0 }}>
            <p style={{ marginBottom: 'var(--spacing-sm)' }}>
              <strong>Export not available</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'var(--font-size-sm)' }}>
              {(preflight.errorDetails ?? preflight.errors.map((m) => ({ message: m }))).map((item, i) => (
                <li key={i}>
                  {typeof item === 'string' ? (
                    item
                  ) : item.sector ? (
                    <>
                      {item.message.split(SECTOR_LABELS[item.sector as SectorKey]).map((part, j) => (
                        <React.Fragment key={j}>
                          {j > 0 ? (
                            <Link
                              href={`/assessment/categories?tab=${item.sector}`}
                              className="alert-link"
                              style={{ fontWeight: 600 }}
                            >
                              {SECTOR_LABELS[item.sector as SectorKey]}
                            </Link>
                          ) : null}
                          {part}
                        </React.Fragment>
                      ))}
                    </>
                  ) : (
                    item.message
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {reportStage === 'error' && (reportErrorDetail != null || reportRequestId != null) && (
        <div style={{ width: '100%' }}>
          <div className="alert alert-danger" role="alert" style={{ marginBottom: 0 }}>
            <p style={{ marginBottom: 'var(--spacing-sm)' }}>
              <strong>{reviewExportCopy.reportGenerationFailed}</strong>
            </p>
            {reportRequestId && (
              <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
                Request ID: <code>{reportRequestId}</code>
              </p>
            )}
            {reportErrorDetail && (
              <pre
                style={{
                  fontSize: 'var(--font-size-sm)',
                  maxHeight: '150px',
                  overflow: 'auto',
                  backgroundColor: '#f5f5f5',
                  padding: 'var(--spacing-sm)',
                  borderRadius: '3px',
                  marginBottom: 0,
                }}
              >
                {reportErrorDetail.slice(0, 3000)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
