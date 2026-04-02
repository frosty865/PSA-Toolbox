'use client';

import React from 'react';
import Link from '@/components/FieldLink';
import { usePathname } from 'next/navigation';
import { PraSlaToggle } from './PraSlaToggle';
import { CrossDependencyToggle } from './CrossDependencyToggle';

export function AssessmentChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCategories = pathname?.includes('/categories');
  const isNew = pathname?.includes('/new');
  const isReview = pathname?.includes('/review');
  const isReport = pathname?.includes('/report');

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 0',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--cisa-gray-light)',
        }}
      >
        <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/" className="btn btn-outline-secondary btn-sm">
            ← Home
          </Link>
          <Link
            href="/assessment/categories/"
            className={isCategories ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'}
          >
            Category data
          </Link>
          <Link
            href="/assessment/new/"
            className={isNew ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'}
          >
            Export / Import
          </Link>
          <Link
            href="/assessment/review/"
            className={isReview ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'}
          >
            Review &amp; Export
          </Link>
          <Link
            href="/assessment/report/"
            className={isReport ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'}
          >
            Report
          </Link>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <PraSlaToggle />
          <CrossDependencyToggle />
        </div>
      </div>
      {children}
    </>
  );
}
