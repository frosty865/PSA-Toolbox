'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from '@/components/FieldLink';
import { useRouter } from 'next/navigation';
import {
  purge,
  exportDraft,
  exportFinal,
  getTemplateCheck,
  downloadJson,
  downloadFinalExport,
  ApiError,
} from '@/lib/api';
import { writeSessionsToPerTabStorage } from '@/app/lib/io/writeSessionsToStorage';
import { importProgress } from '@/app/lib/io/progressFile';
import { useAssessment } from '@/lib/assessment-context';
import { getDefaultAssessment } from '@/lib/default-assessment';
import { navigateFieldFile, shouldUseFieldFileNavigation } from '@/lib/field/fileProtocolNav';
import { getBrowserReportServiceBaseUrl } from '@/lib/field/remoteExport';

type ReportStage = 'idle' | 'starting' | 'loading_assessment' | 'validating' | 'assembling' | 'rendering' | 'done' | 'error';

export default function NewAssessmentPage() {
  const router = useRouter();
  const { assessment, setAssessment } = useAssessment();
  const [jsonImportFile, setJsonImportFile] = useState<File | null>(null);
  const [finalExportAcknowledged, setFinalExportAcknowledged] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState<boolean | null>(null);
  const [reportStage, setReportStage] = useState<ReportStage>('idle');
  const [reportErrorDetail, setReportErrorDetail] = useState<string | null>(null);
  const [reportRequestId, setReportRequestId] = useState<string | null>(null);
  const reportInFlightRef = useRef(false);
  const remoteReportServiceEnabled = getBrowserReportServiceBaseUrl() != null;

  useEffect(() => {
    purge().catch(() => {});
  }, []);

  useEffect(() => {
    if (remoteReportServiceEnabled) {
      setTemplateReady(true);
      return;
    }
    getTemplateCheck()
      .then((r) => setTemplateReady(r.ok))
      .catch(() => setTemplateReady(false));
  }, [remoteReportServiceEnabled]);

  const handleExportDraft = useCallback(async () => {
      setError(null);
    setStatus('Exporting JSON...');
    try {
      const blob = await exportDraft(assessment);
      downloadJson(blob);
      setStatus('JSON downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON export failed');
      setStatus(null);
    }
  }, [assessment]);

  const handleExportFinal = useCallback(async () => {
    if (!finalExportAcknowledged || reportInFlightRef.current) return;
    reportInFlightRef.current = true;
    setError(null);
    setReportErrorDetail(null);
    setReportRequestId(null);
    setReportStage('starting');
    setStatus(null);
    try {
      setReportStage('loading_assessment');
      setReportStage('validating');
      setReportStage('assembling');
      setReportStage('rendering');
      const blob = await exportFinal(assessment, { timeoutMs: 120000 });
      setReportStage('done');
      downloadFinalExport(blob, assessment);
      await purge();
      setAssessment(getDefaultAssessment());
      if (shouldUseFieldFileNavigation()) {
        navigateFieldFile('/');
      } else {
        router.push('/');
      }
    } catch (e) {
      setReportStage('error');
      const msg = e instanceof Error ? e.message : 'Final export failed';
      setError(msg);
      const body =
        e instanceof ApiError && (e as ApiError & { serverResponseBody?: string }).serverResponseBody != null
          ? (e as ApiError & { serverResponseBody?: string }).serverResponseBody
          : null;
      setReportErrorDetail(body ?? msg);
      const id = e instanceof ApiError && e.details?.request_id != null ? String(e.details.request_id) : null;
      setReportRequestId(id ?? null);
      setStatus(null);
    } finally {
      reportInFlightRef.current = false;
    }
  }, [assessment, finalExportAcknowledged, setAssessment, router]);

  const handleReportRetry = useCallback(() => {
    setError(null);
    setReportErrorDetail(null);
    setReportRequestId(null);
    setReportStage('idle');
  }, []);

  const handleJsonImport = useCallback(async () => {
    if (!jsonImportFile) return;
    setError(null);
    setStatus('Loading IDT JSON...');
    try {
      const result = await importProgress(jsonImportFile);
      if (!result.ok) {
        setError(result.error);
        setStatus(null);
        return;
      }
      setAssessment({
        ...result.assessment,
        priority_restoration: result.assessment.priority_restoration ?? getDefaultAssessment().priority_restoration,
      });
      setJsonImportFile(null);
      setStatus('Assessment restored from IDT JSON.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON import failed');
      setStatus(null);
    }
  }, [jsonImportFile, setAssessment]);

  return (
    <main className="section active">
      <h2 className="section-title">New Assessment</h2>
      <p className="text-secondary mb-4">
        Session is in-memory only. Use JSON export to save progress.
      </p>

      {!remoteReportServiceEnabled && templateReady === false && (
        <div className="alert alert-danger mb-4" role="alert">
          DOCX template failed readiness checks (missing anchors). Export is disabled until fixed.
          <br />
          <Link href="/template-readiness?dev=1" className="alert-link">Go to /template-readiness</Link> for details.
        </div>
      )}

      <section className="card mt-4">
        <h3 className="card-title">Export JSON</h3>
        <p className="text-secondary mb-3">
          Downloads the canonical IDT progress JSON.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportDraft}
        >
          Download JSON
        </button>
      </section>

      <section className="card mt-4">
        <h3 className="card-title">Export final report</h3>
        <p className="text-secondary mb-3">Downloads report only, then purges temp and resets.</p>
        {reportStage !== 'idle' && reportStage !== 'done' && reportStage !== 'error' && (
          <p className="mb-3" role="status">
            {reportStage === 'starting' && 'Starting…'}
            {(reportStage === 'loading_assessment' || reportStage === 'validating') && 'Loading and validating assessment…'}
            {reportStage === 'assembling' && 'Assembling sections…'}
            {reportStage === 'rendering' && 'Generating report…'}
          </p>
        )}
        <div className="checkbox-item mb-3">
          <input
            id="final-export-ack"
            type="checkbox"
            checked={finalExportAcknowledged}
            onChange={(e) => setFinalExportAcknowledged(e.target.checked)}
          />
          <label htmlFor="final-export-ack">
            I understand this report may contain sensitive information and all session data will be purged after export.
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportFinal}
          disabled={!finalExportAcknowledged || (reportStage !== 'idle' && reportStage !== 'error')}
        >
          {reportStage === 'rendering' || reportStage === 'assembling' || reportStage === 'loading_assessment' || reportStage === 'validating' || reportStage === 'starting'
            ? 'Generating…'
            : 'Download report &amp; purge'}
        </button>
        {reportStage === 'error' && (
          <div className="mt-3">
            <button type="button" className="btn btn-secondary" onClick={handleReportRetry}>
              Retry
            </button>
          </div>
        )}
        {reportStage === 'error' && (reportErrorDetail != null || reportRequestId != null) && (
          <div className="alert alert-danger mt-3" role="alert">
            {reportRequestId != null && (
              <p className="mb-2"><strong>Request ID:</strong> <code>{reportRequestId}</code></p>
            )}
            {reportErrorDetail != null && (
              <pre className="mb-0 text-left" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto', fontSize: 'var(--font-size-sm)' }}>
                {reportErrorDetail.slice(0, 2000)}
              </pre>
            )}
          </div>
        )}
      </section>

      <section className="card mt-4">
        <h3 className="card-title">Import IDT JSON</h3>
        <div className="form-group">
          <label className="form-label">IDT JSON file</label>
          <input
            type="file"
            className="form-control"
            accept=".json,application/json"
            onChange={(e) => setJsonImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleJsonImport}
          disabled={jsonImportFile == null}
        >
          Load JSON
        </button>
      </section>

      <section className="card mt-4">
        <h3 className="card-title">Import IDT JSON</h3>
        <p className="text-secondary mb-3">
          Loads a plain IDT progress JSON and populates the assessment directly.
        </p>
        <div className="form-group">
          <label className="form-label">IDT JSON file</label>
          <input
            type="file"
            className="form-control"
            accept=".json,application/json"
            onChange={(e) => setJsonImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleJsonImport}
          disabled={jsonImportFile == null}
        >
          Load IDT JSON
        </button>
      </section>

      {status && <div className="alert alert-success mt-4" role="status">{status}</div>}
      {error && <div className="alert alert-danger mt-4" role="alert">{error}</div>}

      <p className="mt-5">
        <Link href="/assessment/review/" className="btn btn-secondary" style={{ marginRight: '0.5rem' }}>Review VOFCs</Link>
        <Link href="/assessment/categories/" className="btn btn-secondary" style={{ marginRight: '0.5rem' }}>Category data</Link>
        <Link href="/" className="btn btn-secondary">← Back</Link>
      </p>
    </main>
  );
}
