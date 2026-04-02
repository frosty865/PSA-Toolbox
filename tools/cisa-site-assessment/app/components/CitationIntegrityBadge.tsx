"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface IntegrityStatus {
  integrity_ok: boolean;
  missing_count: number;
}

export default function CitationIntegrityBadge() {
  const pathname = usePathname();
  const [status, setStatus] = useState<IntegrityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const isWizard = pathname?.includes("/admin/modules/new") ?? false;

  useEffect(() => {
    if (isWizard) {
      setLoading(false);
      return;
    }
    async function checkStatus() {
      try {
        const response = await fetch("/api/admin/citations/integrity-audit");
        if (response.ok) {
          const data = await response.json();
          setStatus({
            integrity_ok: data.integrity_ok,
            missing_count: data.missing_count || 0,
          });
        }
      } catch {
        // Silently fail - badge is optional
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isWizard]);

  if (loading || !status) {
    return null;
  }

  if (status.integrity_ok) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        backgroundColor: '#d1fae5',
        border: '1px solid #86efac',
        borderRadius: '16px',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 500,
        color: '#065f46'
      }}>
        <span>✅</span>
        <span>Citations OK</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      backgroundColor: '#fee2e2',
      border: '1px solid #fca5a5',
      borderRadius: '16px',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 600,
      color: '#991b1b',
      cursor: 'pointer'
    }}
    onClick={() => {
      window.location.href = '/admin';
    }}
    title={`${status.missing_count} citation integrity violation(s) - Click to view details`}
    >
      <span>⚠️</span>
      <span>{status.missing_count} Violation{status.missing_count !== 1 ? 's' : ''}</span>
    </div>
  );
}
