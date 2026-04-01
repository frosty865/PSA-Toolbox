'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { REQUIRED_TEMPLATE_ANCHORS } from 'schema';
import { getApiBase } from '@/lib/platform/apiBase';

type CheckResult = {
  ok: boolean;
  templatePath: string;
  missing: string[];
  duplicates: Array<{ anchor: string; count: number }>;
};

const INSTRUCTION = 'Open the DOCX template and place each anchor on its own line where the chart/table should appear.';

function TemplateReadinessContent() {
  const searchParams = useSearchParams();
  const dev = searchParams.get('dev') === '1';
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dev) return;
    setLoading(true);
    setError(null);
    fetch(`${getApiBase()}/api/template/check`)
      .then((res) => res.json())
      .then((data) => {
        setResult(data as CheckResult);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dev]);

  if (!dev) {
    return (
      <main className="ida-section active">
        <h2 className="ida-section-title">Template Readiness</h2>
        <div className="alert alert-warning" role="alert">
          Add <code>?dev=1</code> to the URL to view this page.
        </div>
        <p className="mt-4">
          <Link href="/" className="ida-btn ida-btn-secondary">← Back</Link>
        </p>
      </main>
    );
  }

  const duplicateMap = new Map(
    result?.duplicates?.map((d) => [d.anchor, d.count]) ?? []
  );
  const missingSet = new Set(result?.missing ?? []);

  return (
    <main className="ida-section active">
      <h2 className="ida-section-title">Template Readiness</h2>
      <p className="text-secondary mb-4">
        Template path in use and status of required anchors.
      </p>

      {loading && <p>Checking template…</p>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="mb-4 p-3 ida-readiness-path">
            <strong>Template path:</strong>
            <br />
            <code className="ida-readiness-path-code">{result.templatePath}</code>
          </div>

          {result.ok ? (
            <div className="alert alert-success" role="status">
              <strong>PASS</strong> — All required anchors present exactly once.
            </div>
          ) : (
            <div className="alert alert-danger" role="alert">
              <strong>FAIL</strong> — Missing or duplicate anchors. Fix the template before export.
            </div>
          )}

          <table className="table mt-4">
            <thead>
              <tr>
                <th>Anchor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {REQUIRED_TEMPLATE_ANCHORS.map((anchor) => {
                const isMissing = missingSet.has(anchor);
                const dupCount = duplicateMap.get(anchor);
                const status = isMissing
                  ? 'missing'
                  : dupCount != null
                    ? `duplicate (${dupCount}x)`
                    : 'found';
                return (
                  <tr key={anchor}>
                    <td><code>{anchor}</code></td>
                    <td>
                      {status === 'found' && <span className="text-success">found</span>}
                      {status === 'missing' && <span className="text-danger">missing</span>}
                      {status.startsWith('duplicate') && <span className="text-danger">{status}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 p-3 ida-readiness-instructions">
            <h3 className="ida-readiness-heading">Instructions</h3>
            <p className="ida-readiness-copy">{INSTRUCTION}</p>
          </div>
        </>
      )}

      <p className="mt-5">
        <Link href="/assessment/new/" className="ida-btn ida-btn-secondary ida-link-gap">Export / Import</Link>
        <Link href="/" className="ida-btn ida-btn-secondary">← Back</Link>
      </p>
    </main>
  );
}

export default function TemplateReadinessPage() {
  return (
    <Suspense fallback={
      <main className="ida-section active">
        <h2 className="ida-section-title">Template Readiness</h2>
        <p className="text-secondary">Loading…</p>
      </main>
    }>
      <TemplateReadinessContent />
    </Suspense>
  );
}
