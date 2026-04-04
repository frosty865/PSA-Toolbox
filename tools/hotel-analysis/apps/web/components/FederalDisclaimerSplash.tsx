'use client';

import React from 'react';

export function FederalDisclaimerSplash({
  onAccept,
}: {
  onAccept: () => void;
}) {
  const handleAccept = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('federal-disclaimer-accepted', 'true');
    }
    onAccept();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'var(--spacing-lg)',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          maxWidth: '650px',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with CISA branding */}
        <div
          style={{
            backgroundColor: '#003366',
            color: '#fff',
            padding: '24px',
            textAlign: 'center',
            borderBottom: '1px solid #d6d7d9',
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>CISA Critical Infrastructure Assessment Tool</h1>
          <p style={{ fontSize: '12px', margin: '8px 0 0 0', opacity: 0.9 }}>Cybersecurity and Infrastructure Security Agency</p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#112e51' }}>
            Notice of Use and Access Warning
          </h2>

          <p style={{ fontSize: '14px', lineHeight: 1.7, marginBottom: '16px', color: '#1b1b1b', fontWeight: 500 }}>
            <strong style={{ color: '#d83933' }}>⚠ Warning Notice:</strong> This system is for authorized use only. All activity is monitored and logged. Unauthorized access, use, or modification of this system is prohibited and may result in criminal and civil liability.
          </p>

          <section style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #d6d7d9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#112e51' }}>Authorized Users</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: '#5b616b' }}>
              This system is intended for authorized use by U.S. federal, state, tribal, territorial, and local government agencies and their designated representatives for the purpose of conducting critical infrastructure dependency assessments.
            </p>
          </section>

          <section style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #d6d7d9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#112e51' }}>Acceptable Use</h3>
            <ul style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, paddingLeft: '20px', color: '#5b616b' }}>
              <li style={{ marginBottom: '8px' }}>Use this system only for authorized dependency assessment and planning activities</li>
              <li style={{ marginBottom: '8px' }}>Do not use this system to access, modify, or disclose information without proper authorization</li>
              <li style={{ marginBottom: '8px' }}>Do not attempt to circumvent security measures or access controls</li>
              <li>Comply with all applicable federal, state, and local laws and regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #d6d7d9' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#112e51' }}>Data and Privacy</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: '#5b616b' }}>
              Assessment data and information entered into this system shall be protected in accordance with applicable federal laws, including the Privacy Act of 1974 and the Computer Security Act of 1987. Users are responsible for maintaining the confidentiality of their assessment data.
            </p>
          </section>

          <section style={{ marginBottom: 0 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#112e51' }}>Monitoring and Recording</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: '#5b616b' }}>
              Use of this system constitutes consent to monitoring and recording of all system activity. Any unauthorized access attempt will be reported to the appropriate authorities.
            </p>
          </section>
        </div>

        {/* Footer with buttons */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f1f1f2',
            borderTop: '1px solid #d6d7d9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handleAccept}
            style={{
              padding: '10px 24px',
              backgroundColor: '#0071bc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              marginLeft: 'auto',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#005a96';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#0071bc';
            }}
          >
            I Understand and Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default FederalDisclaimerSplash;
