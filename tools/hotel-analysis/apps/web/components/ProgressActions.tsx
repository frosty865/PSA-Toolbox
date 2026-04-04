'use client';

import React, { useRef, useState } from 'react';
import type { Assessment } from 'schema';
import { buildProgressFileV2, downloadProgress, importProgress, type ImportResult } from '@/app/lib/io/progressFile';
import { wipeLocalAssessment } from '@/app/lib/io/assessmentStorage';
import { collectAllSessionsFromLocalStorage, clearAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { writeSessionsToPerTabStorage } from '@/app/lib/io/writeSessionsToStorage';
import { syncAssessmentCategoriesToPerTabStorage } from '@/app/lib/io/syncAssessmentToSessions';
import { DEFAULT_PRIORITY_RESTORATION } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';

const SAVE_WARNING =
  'This JSON contains assessment details. Handle per policy.';

export interface ProgressActionsProps {
  assessment: Assessment;
  setAssessment: (a: Assessment) => void;
  onLoadSuccess?: () => void;
  onClear?: () => void;
}

export function ProgressActions({ assessment, setAssessment, onLoadSuccess, onClear }: ProgressActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSaveClick = () => setSaveModalOpen(true);

  const handleSaveConfirm = () => {
    if (typeof window === 'undefined') {
      setSaveModalOpen(false);
      return;
    }
    // Sessions are source of truth for dependency form data; do not overwrite with assessment
    const sessions = collectAllSessionsFromLocalStorage();
    const sanitized = sanitizeAssessmentBeforeSave(assessment);
    const file = buildProgressFileV2(sanitized, sessions);
    downloadProgress(file);
    setSaveModalOpen(false);
  };

  const handleLoadClick = () => {
    setLoadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importProgress(file).then((result: ImportResult) => {
      if (result.ok) {
        const merged: Assessment = {
          ...result.assessment,
          priority_restoration: result.assessment.priority_restoration ?? DEFAULT_PRIORITY_RESTORATION,
        };
        // Assessment object is source of truth. Sessions are persisted for tab UX only.
        // They must not overwrite assessment answers during load.
        clearAllSessionsFromLocalStorage();
        if (Object.keys(result.sessions).length > 0) {
          writeSessionsToPerTabStorage(result.sessions);
        }
        syncAssessmentCategoriesToPerTabStorage(merged);
        setAssessment(normalizeCurveStorage(merged));
        onLoadSuccess?.();
      } else {
        setLoadError(result.error);
      }
    });
  };

  const handleClear = () => {
    onClear?.();
  };

  const handleWipeLocal = () => {
    if (typeof window !== 'undefined' && window.confirm('Permanently remove saved assessment data from this device? This cannot be undone.')) {
      wipeLocalAssessment();
      clearAllSessionsFromLocalStorage();
      onClear?.();
    }
  };

  return (
    <>
      <div className="progress-actions mb-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={handleSaveClick}>
          Save Progress
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleLoadClick}>
          Load Progress
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleClear}>
          Clear Session
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleWipeLocal} title="Remove saved data from this device">
          Wipe local data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label="Load progress file"
        />
        {loadError && (
          <span className="text-danger" style={{ fontSize: '0.875rem' }} role="alert">
            {loadError}
          </span>
        )}
      </div>

      {saveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--background, #fff)',
              padding: '1.25rem',
              borderRadius: 4,
              maxWidth: 400,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="save-modal-title" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
              Save Progress
            </h3>
            <p className="text-secondary" style={{ marginBottom: '1rem' }}>
              {SAVE_WARNING}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSaveModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveConfirm}>
                Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
