'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from '@/components/FieldLink';
import { useRouter } from 'next/navigation';
import {
  purge,
  exportDraft,
  exportFinal,
  getTemplateCheck,
  getRevisionPackageMetadata,
  importRevisionPackage,
  downloadDraftZip,
  downloadFinalExport,
  ApiError,
} from '@/lib/api';
import { collectAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { writeSessionsToPerTabStorage } from '@/app/lib/io/writeSessionsToStorage';
import { useAssessment } from '@/lib/assessment-context';
import { getDefaultAssessment } from '@/lib/default-assessment';
import { navigateFieldFile, shouldUseFieldFileNavigation } from '@/lib/field/fileProtocolNav';

type ReportStage = 'idle' | 'starting' | 'loading_assessment' | 'validating' | 'assembling' | 'rendering' | 'done' | 'error';

export default function NewAssessmentPage() {
  const router = useRouter();
  const { assessment, setAssessment } = useAssessment();
  const [passphrase, setPassphrase] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importPreviewMeta, setImportPreviewMeta] = useState<{
    tool_version: string;
    template_version: string;
    created_at_iso: string;
    current_tool_version: string;
  } | null>(null);
  const [finalExportAcknowledged, setFinalExportAcknowledged] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState<boolean | null>(null);
  const [reportStage, setReportStage] = useState<ReportStage>('idle');
  const [reportErrorDetail, setReportErrorDetail] = useState<string | null>(null);
  const [reportRequestId, setReportRequestId] = useState<string | null>(null);
  const reportInFlightRef = useRef(false);

  useEffect(() => {
    purge().catch(() => {});
  }, []);

  useEffect(() => {
    getTemplateCheck()
      .then((r) => setTemplateReady(r.ok))
      .catch(() => setTemplateReady(false));
  }, []);

  const draftPassphraseValid = passphrase.trim().length >= 12;

  const handleExportDraft = useCallback(async () => {
    if (!draftPassphraseValid) {
      setError('Passphrase must be at least 12 characters to encrypt the revision package.');
      return;
    }
    setError(null);
    setStatus('Exporting draft...');
    try {
      const sessions = collectAllSessionsFromLocalStorage();
      const blob = await exportDraft(assessment, passphrase.trim(), sessions);
      downloadDraftZip(blob);
      setStatus('Draft downloaded (report + revision package).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft export failed');
      setStatus(null);
    }
  }, [assessment, passphrase, draftPassphraseValid]);

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

  const canPreviewImport = importFile != null && importPassphrase.trim().length > 0;

  const handlePreviewImport = useCallback(async () => {
    if (!importFile || !importPassphrase.trim()) return;
    setError(null);
    setStatus('Reading package...');
    setImportPreviewMeta(null);
    try {
      const meta = await getRevisionPackageMetadata(importFile, importPassphrase.trim());
      setImportPreviewMeta(meta);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read package');
      setStatus(null);
    }
  }, [importFile, importPassphrase]);

  const handleConfirmRestore = useCallback(async () => {
    if (!importFile || !importPassphrase.trim() || !importPreviewMeta) return;
    setError(null);
    setStatus('Restoring...');
    try {
      const restored = await importRevisionPackage(importFile, importPassphrase.trim());
      setAssessment(restored.assessment);
      if (restored.sessions && Object.keys(restored.sessions).length > 0) {
        writeSessionsToPerTabStorage(restored.sessions);
      }
      setImportFile(null);
      setImportPassphrase('');
      setImportPreviewMeta(null);
      setStatus('Assessment restored.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setStatus(null);
    }
  }, [importFile, importPassphrase, importPreviewMeta, setAssessment]);

  const handleImportFileChange = useCallback((file: File | null) => {
    setImportFile(file);
    setImportPreviewMeta(null);
  }, []);

  const handleImportPassphraseChange = useCallback((value: string) => {
    setImportPassphrase(value);
    setImportPreviewMeta(null);
  }, []);

  const importToolVersionMismatch = importPreviewMeta != null
    && importPreviewMeta.tool_version !== importPreviewMeta.current_tool_version;

  const exportDisabled = templateReady === false;

  return (
    <main className="section active">
      <h2 className="section-title">New Assessment</h2>
      <p className="text-secondary mb-4">
        Session is in-memory only. Use draft export to save a revision package.
      </p>

      {templateReady === false && (
        <div className="alert alert-danger mb-4" role="alert">
          DOCX template failed readiness checks (missing anchors). Export is disabled until fixed.
          <br />
          <Link href="/template-readiness?dev=1" className="alert-link">Go to /template-readiness</Link> for details.
        </div>
      )}

      <section className="card mt-4">
        <h3 className="card-title">Export draft (report + revision package)</h3>
        <p className="text-secondary mb-3">
          A passphrase is required to encrypt the revision package.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="draft-passphrase">Passphrase (min. 12 characters)</label>
          <input
            id="draft-passphrase"
            type="password"
            className="form-control"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            minLength={12}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportDraft}
          disabled={!draftPassphraseValid || exportDisabled}
        >
          Download draft (ZIP)
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
          disabled={!finalExportAcknowledged || exportDisabled || (reportStage !== 'idle' && reportStage !== 'error')}
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
        <h3 className="card-title">Import revision package</h3>
        <div className="form-group">
          <label className="form-label">Revision package file</label>
          <input
            type="file"
            className="form-control"
            accept=".pkg,application/octet-stream"
            onChange={(e) => handleImportFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="import-passphrase">Passphrase</label>
          <input
            id="import-passphrase"
            type="password"
            className="form-control"
            placeholder="Passphrase"
            value={importPassphrase}
            onChange={(e) => handleImportPassphraseChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePreviewImport}
          disabled={!canPreviewImport}
        >
          Preview package
        </button>

        {importPreviewMeta != null && (
          <div className="mt-4 p-3" style={{ background: 'var(--cisa-gray-lighter)', borderRadius: 'var(--border-radius)' }}>
            <h4 className="text-primary" style={{ marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-md)' }}>
              Revision package details
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li>Tool version: {importPreviewMeta.tool_version}</li>
              <li>Template version: {importPreviewMeta.template_version}</li>
              <li>Created: {importPreviewMeta.created_at_iso}</li>
            </ul>
            {importToolVersionMismatch && (
              <div className="alert alert-warning mt-3" role="alert">
                This package was created with a different tool version. Review outputs carefully.
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary mt-3"
              onClick={handleConfirmRestore}
            >
              Confirm restore
            </button>
          </div>
        )}
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
