'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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

  const handlePrint = () => {
    window.print();
  };

  const items = collection?.items ?? [];
  const { meta, asset } = assessment;

  return (
    <main className="report-page ida-section active">
      <div className="no-print mb-4 ida-report-toolbar">
        <button type="button" className="ida-btn ida-btn-primary" onClick={handlePrint}>
          Print
        </button>
        <Link href="/assessment/review/" className="ida-btn ida-btn-secondary">← Back to Review</Link>
      </div>

      {loading && <p className="text-secondary">Loading report…</p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!loading && !error && (
        <div className="report-content">
          <h1 className="report-title ida-report-title">Infrastructure Dependency Assessment Report</h1>
          <p className="text-secondary ida-report-meta">
            PSA IDA · Tool version: {meta.tool_version} · Created: {meta.created_at_iso}
          </p>

          <section className="report-section ida-report-section">
            <h2 className="ida-report-subtitle">Facility</h2>
            <p><strong>Asset:</strong> {asset.asset_name}</p>
            <p><strong>Visit date:</strong> {asset.visit_date_iso}</p>
            {asset.location && <p><strong>Location (Lat/Long):</strong> {asset.location}</p>}
            {asset.assessor && <p><strong>Assessor:</strong> {asset.assessor}</p>}
          </section>

          <section className="report-section ida-report-section mt-4">
            <h2 className="ida-report-subtitle">Vulnerabilities and Options for Consideration</h2>
            <p className="text-secondary ida-report-copy-tight">
              Generated: {collection?.generated_at_iso ?? '—'}. These items are based on assessed dependency conditions and standardized thresholds; they are not findings or recommendations.
            </p>
            <p className="text-secondary ida-report-copy">
              <strong>Scope:</strong> Communications = carrier-based transport (ISP, fiber, wireless, satellite). Information Technology = externally hosted or managed digital services (SaaS, cloud, managed IT). Systems owned by the facility are not assessed as dependencies here.
            </p>
            {items.length === 0 ? (
              <p className="text-secondary">No vulnerabilities generated for the current assessment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table ida-report-table">
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
