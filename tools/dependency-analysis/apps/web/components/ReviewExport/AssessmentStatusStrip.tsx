'use client';

import React from 'react';
import type { ReportVM } from '@/app/lib/report/view_model';
import type { ReportVMWithPreflight } from '@/app/lib/report/build_report_vm_client';
import type { CompletionResult } from '@/app/lib/assessment/completion';

/**
 * Assessment Status Strip: a persistent status info bar showing:
 * - Assessment completion % (visible required questions answered)
 * - Report readiness (from VM preflight)
 * - Triggered conditions count (per infra + total)
 * - Key Risk Drivers count
 * - Cascading dependencies identified (Yes/No)
 * - Citations used count
 */
export function AssessmentStatusStrip({
  completion,
  reportVM = null,
}: {
  completion: CompletionResult;
  reportVM?: ReportVM | ReportVMWithPreflight | null;
}) {
  const completionPercent = completion.overallPct;
  const preflight = (reportVM as ReportVMWithPreflight)?.preflight;
  const reportReady = preflight?.can_export ?? false;

  const totalTriggers = reportVM
    ? reportVM.infrastructures.reduce((sum, inf) => sum + (inf.findings?.length ?? 0), 0)
    : 0;

  const keyRiskDriversCount = reportVM?.executive?.key_risk_drivers?.length ?? 0;

  const hasCascadingDeps =
    reportVM?.cross_dependency?.confirmed_edges != null && reportVM.cross_dependency.confirmed_edges.length > 0;

  const citationsCount = reportVM
    ? reportVM.infrastructures.reduce((sum, inf) => {
        const citations = inf.findings?.flatMap((f) => f.citations ?? []) ?? [];
        const seen = new Set(citations.map((c) => (c.key ?? '') + (c.short ?? '')));
        return sum + seen.size;
      }, 0)
    : 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--cisa-gray-light, #f5f5f5)',
        borderRadius: 'var(--border-radius, 4px)',
        marginBottom: 'var(--spacing-lg)',
      }}
    >
      {/* Assessment completion % */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Assessment completion:</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-primary, #0071bc)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          {completionPercent}%
        </span>
      </div>

      {/* Report readiness */}
      {preflight != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Report readiness:</span>
          <span
            style={{
              display: 'inline-block',
              backgroundColor: reportReady ? 'var(--color-success, #00a91d)' : 'var(--color-warning, #fdb81e)',
              color: reportReady ? 'white' : '#333',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            {reportReady ? 'Ready' : 'Not ready'}
          </span>
        </div>
      )}

      {/* Triggered Conditions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Triggered Conditions:</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-warning, #fdb81e)',
            color: '#333',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          {totalTriggers}
        </span>
      </div>

      {/* Key Risk Drivers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Risk Drivers Identified:</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-danger, #e31c3d)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          {keyRiskDriversCount}
        </span>
      </div>

      {/* Cascading Dependencies */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Cascading Risk:</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: hasCascadingDeps ? 'var(--color-danger, #e31c3d)' : 'var(--color-success, #00a91d)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          {hasCascadingDeps ? 'Yes' : 'No'}
        </span>
      </div>

      {/* Citations Used */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Citations:</span>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--cisa-blue, #0071bc)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          {citationsCount}
        </span>
      </div>
    </div>
  );
}
