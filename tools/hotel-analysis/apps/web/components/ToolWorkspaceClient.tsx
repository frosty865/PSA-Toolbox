'use client';

import { useState } from 'react';
import { generateToolReport } from '@/lib/api';

type Props = {
  toolId: string;
  downloadName: string;
};

export function ToolWorkspaceClient({ toolId, downloadName }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleReportClick() {
    setBusy(true);
    try {
      const blob = await generateToolReport(toolId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
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
      className="cisa-button"
    >
      {busy ? 'Generating report…' : 'Generate report'}
    </button>
  );
}
