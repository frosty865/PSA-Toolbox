"use client";

interface EvidenceItem {
  page: number;
  excerpt: string;
  source_offset: null;
}

interface EvidenceViewerProps {
  evidence: EvidenceItem[];
}

export default function EvidenceViewer({ evidence }: EvidenceViewerProps) {
  return (
    <details style={{ cursor: 'pointer' }}>
      <summary 
        className="btn btn-sm btn-info" 
        style={{ listStyle: 'none', display: 'inline-block' }}
        onClick={(e) => {
          e.preventDefault();
          const details = e.currentTarget.closest('details');
          if (details) {
            details.open = !details.open;
          }
        }}
      >
        View Evidence ({evidence.length})
      </summary>
      <div className="mt-3" style={{ padding: '1rem', backgroundColor: 'var(--cisa-gray-lighter)', borderRadius: '4px' }}>
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
