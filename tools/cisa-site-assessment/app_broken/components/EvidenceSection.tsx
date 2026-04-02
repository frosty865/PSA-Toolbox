"use client";

import { Evidence } from '../lib/phase2_5';

interface EvidenceSectionProps {
  evidence: Evidence[];
  title: string;
  defaultOpen?: boolean;
}

export default function EvidenceSection({ 
  evidence, 
  title, 
  defaultOpen = true,
}: EvidenceSectionProps) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <details open={defaultOpen} style={{ marginBottom: '1rem' }}>
      <summary 
        style={{ 
          cursor: 'pointer', 
          listStyle: 'none',
          fontWeight: 600,
          padding: '0.5rem 0',
          userSelect: 'none'
        }}
        onClick={(e) => {
          e.preventDefault();
          const details = e.currentTarget.closest('details');
          if (details) {
            details.open = !details.open;
          }
        }}
      >
        {title} ({evidence.length})
      </summary>
      <div style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
        {evidence.map((item, idx) => (
          <div key={idx} className="mb-4" style={{ borderBottom: '1px solid var(--cisa-gray-light)', paddingBottom: '1rem' }}>
            <div className="mb-2" style={{ fontSize: '1rem', fontWeight: 600 }}>
              Page {item.page}
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: '#1b1b1b',
                color: '#00ff00',
                padding: '1rem',
                borderRadius: '4px',
                overflowY: 'auto',
              }}
            >
              {item.excerpt}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
