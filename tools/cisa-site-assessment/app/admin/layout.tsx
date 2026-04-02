import { Suspense } from 'react';
import AdminNav from '../components/AdminNav';
import CitationIntegrityBadge from '../components/CitationIntegrityBadge';
import AdminAccessGate from '../components/AdminAccessGate';

export const metadata = {
  title: 'Governance Administration - PSA',
  description: 'Governance administration for reviewing and approving Options for Consideration (OFCs)'
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
      {/* Admin Header */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #d6d7d9',
        padding: '1.5rem 0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          width: '100%',
          margin: 0,
          padding: '0 1.5rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <h1 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#112e51',
                margin: 0,
                lineHeight: 1.2
              }}>
                Governance Administration
              </h1>
            </div>
            <div style={{ flexShrink: 0 }}>
              <CitationIntegrityBadge />
            </div>
          </div>
          <p style={{
            fontSize: '16px',
            color: '#5b616b',
            margin: 0,
            lineHeight: 1.5
          }}>
            Administrative interface for governance review
          </p>
        </div>
      </div>

      {/* Admin Navigation */}
      <Suspense fallback={<div style={{ padding: 'var(--spacing-md) 0', marginBottom: 'var(--spacing-lg)', borderBottom: '1px solid var(--cisa-gray-light)' }} />}>
        <AdminNav />
      </Suspense>

      <AdminAccessGate>
        {/* Admin Content — full width so wide tables (e.g. Source Registry) show all columns; only vertical scroll site-wide */}
        <div style={{
          width: '100%',
          margin: 0,
          padding: '1.5rem',
          boxSizing: 'border-box'
        }}>
          {children}
        </div>
      </AdminAccessGate>
    </div>
  );
}
