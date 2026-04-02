"use client";

import CitationIntegrityPanel from '@/app/components/CitationIntegrityPanel';

export default function AdminPage() {
  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Governance Administration</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          This area is used by the governing body to review and approve
          field-submitted Options for Consideration (OFCs).
        </p>
      </div>

      {/* Citation Integrity Panel */}
      <CitationIntegrityPanel />

      {/* Placeholder Section */}
      <div className="card" style={{ 
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        border: '2px dashed var(--cisa-gray-light)'
      }}>
        <p style={{ 
          fontSize: 'var(--font-size-lg)', 
          color: 'var(--cisa-gray)',
          margin: 0,
          fontStyle: 'italic'
        }}>
          Governance features will appear here.
        </p>
      </div>
    </section>
  );
}
