"use client";

import Link from "next/link";

export default function OFCsPage() {
  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">OFC Templates</h1>
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray)',
          lineHeight: '1.6',
          marginTop: 'var(--spacing-md)'
        }}>
          Browse and manage Options for Consideration (OFC) templates.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--spacing-lg)',
        marginTop: 'var(--spacing-xl)'
      }}>
        <Link
          href="/ofcs/library"
          className="card"
          style={{
            padding: 'var(--spacing-xl)',
            textDecoration: 'none',
            display: 'block',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
        >
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 600,
            color: 'var(--cisa-blue)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            OFC Library
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--cisa-gray-dark)',
            lineHeight: '1.6',
            margin: 0
          }}>
            Browse the canonical OFC library with approved Options for Consideration organized by discipline and subtype.
          </p>
        </Link>

        <Link
          href="/ofcs/nominate"
          className="card"
          style={{
            padding: 'var(--spacing-xl)',
            textDecoration: 'none',
            display: 'block',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
        >
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 600,
            color: 'var(--cisa-blue)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            Nominate OFC
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--cisa-gray-dark)',
            lineHeight: '1.6',
            margin: 0
          }}>
            Nominate a new Option for Consideration to be added to the canonical library.
          </p>
        </Link>
      </div>
    </section>
  );
}
