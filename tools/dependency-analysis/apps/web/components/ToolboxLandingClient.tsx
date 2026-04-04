'use client';

import { useEffect, useState } from 'react';
import { generateGenericReport, purge } from '@/lib/api';

/** Clears in-browser assessment session when visiting the toolbox home (legacy home behavior). */
export function ToolboxLandingClient() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    purge().catch(() => {});
  }, []);

  async function handleReportClick() {
    setBusy(true);
    try {
      const blob = await generateGenericReport({
        generic_report: {
          title: 'PSA Toolbox',
          subtitle: 'Registered tools report',
          sections: [
            {
              heading: 'Registered tools',
              bullets: ['Open the report to review the current toolbox manifest.'],
            },
          ],
        },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PSA-Toolbox-Report.docx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReportClick}
      disabled={busy}
      className="psa-toolbox-landing__report-btn"
    >
      {busy ? 'Generating…' : 'Download manifest report'}
    </button>
  );
}
