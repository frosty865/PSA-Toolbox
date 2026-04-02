'use client';

import React from 'react';
import Image from 'next/image';

const LOGO_SRC = '/logo/cisa-logo.png';

export interface CisaHeaderProps {
  variant?: 'splash' | 'page';
  title?: string;
  subtitle?: string;
}

function CisaHeader({ variant = 'page', title, subtitle }: CisaHeaderProps) { 
  if (variant === 'splash') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          paddingTop: '48px',
          paddingBottom: '48px',
          backgroundColor: '#ffffff',
        }}
      >
        <Image src={LOGO_SRC} alt="CISA" width={200} height={120} unoptimized style={{ width: '200px', height: 'auto', objectFit: 'contain' }} />
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#112e51',
              margin: 0,
              letterSpacing: '0.5px',
            }}
          >
            {title || 'Infrastructure Dependency Tool (IDT)'}
          </h1>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#5b616b',
              margin: '8px 0 0 0',
              letterSpacing: '1px',
            }}
          >
            {subtitle || 'UNCLASSIFIED // FOR OFFICIAL USE ONLY'}
          </p>
        </div>
      </div>
    );
  }

  // Page header variant
  return (
    <nav
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #d6d7d9',
        padding: '16px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <Image src={LOGO_SRC} alt="CISA" width={48} height={48} unoptimized style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#112e51',
              margin: 0,
              letterSpacing: '0.5px',
            }}
          >
            {title || 'Infrastructure Dependency Tool (IDT)'}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: '12px',
                color: '#5b616b',
                margin: '2px 0 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </nav>
  );
}

export default CisaHeader;
