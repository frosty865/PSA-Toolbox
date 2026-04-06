'use client';

import React, { useEffect, useState } from 'react';
import Link from '@/components/FieldLink';
import { useAssessment } from '@/lib/assessment-context';
import { getVofcCollection } from '@/lib/api';
import type { VOFCCollection } from 'schema';

export default function ReportPage() {
  const { assessment } = useAssessment();
  const [collection, setCollection] = useState<VOFCCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getVofcCollection(assessment)
      .then((c) => {
        if (!cancelled) setCollection(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load VOFCs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [assessment]);

  const items = collection?.items ?? [];
  const { meta, asset } = assessment;

  return (
    <main className="report-page section active">
      <div className="no-print mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" disabled title="DOCX export is handled by the report export flow">
          Export DOCX
        </button>
        <Link href="/assessment/review/" className="btn btn-secondary">← Back to Review</Link>
      </div>

      {loading && <p className="text-secondary">Loading report…</p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!loading && !error && (
        <div className="report-content">
          <h1 className="report-title" style={{ marginBottom: '0.5rem' }}>Infrastructure Dependency Tool Report</h1>
          <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '1.5rem' }}>
            Tool version: {meta.tool_version} · Created: {meta.created_at_iso}
          </p>

          <section className="report-section">
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Facility</h2>
            <p><strong>Asset:</strong> {asset.asset_name}</p>
            <p><strong>Visit date:</strong> {asset.visit_date_iso}</p>
            {asset.location && <p><strong>Location (Lat/Long):</strong> {asset.location}</p>}
            {asset.assessor && <p><strong>Assessor:</strong> {asset.assessor}</p>}
          </section>

          <section className="report-section" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Vulnerabilities and Options for Consideration</h2>
            <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.25rem' }}>
              Generated: {collection?.generated_at_iso ?? '—'}. These items are based on assessed dependency conditions and standardized thresholds; they are not findings or recommendations.
            </p>
            <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.75rem' }}>
              <strong>Scope:</strong> Communications = carrier-based transport (ISP, fiber, wireless, satellite). Information Technology = externally hosted or managed digital services (SaaS, cloud, managed IT). Systems owned by the facility are not assessed as dependencies here.
            </p>
            {items.length === 0 ? (
              <p className="text-secondary">No vulnerabilities generated for the current assessment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table" style={{ fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Category</th>
                      <th>Vulnerability</th>
                      <th>Option for Consideration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.vofc_id}>
                        <td>{row.vofc_id}</td>
                        <td>{row.category}</td>
                        <td>{row.vulnerability}</td>
                        <td>{row.option_for_consideration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

    </main>
  );
}
