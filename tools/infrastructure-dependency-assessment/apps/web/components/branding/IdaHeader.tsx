'use client';

import React from 'react';
import Image from 'next/image';

const LOGO_SRC = '/psa-logo.svg';

export interface IdaHeaderProps {
  variant?: 'splash' | 'page';
  title?: string;
  subtitle?: string;
}

function IdaHeader({ variant = 'page', title, subtitle }: IdaHeaderProps) {
  if (variant === 'splash') {
    return (
      <div className="ida-splash-header">
        <Image src={LOGO_SRC} alt="PSA Toolbox" width={220} height={56} unoptimized className="ida-splash-logo" />
        <div className="ida-splash-copy">
          <h1>{title || 'Infrastructure Dependency Assessment'}</h1>
          <p>{subtitle || 'Cybersecurity and Infrastructure Security Agency'}</p>
        </div>
      </div>
    );
  }

  // Page header variant aligned with agency shell.
  return (
    <nav className="ida-shell-header" aria-label="Infrastructure Dependency Assessment shell">
      <div className="ida-shell-header-inner">
        <Image src={LOGO_SRC} alt="PSA Toolbox" width={220} height={56} unoptimized className="ida-shell-logo" />
        <div className="ida-shell-title-wrap">
          <h1 className="ida-shell-title">{title || 'Infrastructure Dependency Assessment'}</h1>
          {(subtitle || 'Cybersecurity and Infrastructure Security Agency') && (
            <p className="ida-shell-subtitle">{subtitle || 'Cybersecurity and Infrastructure Security Agency'}</p>
          )}
        </div>
      </div>
    </nav>
  );
}

export default IdaHeader;
