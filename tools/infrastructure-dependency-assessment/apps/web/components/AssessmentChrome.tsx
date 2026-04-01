'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PraSlaToggle } from './PraSlaToggle';
import { CrossDependencyToggle } from './CrossDependencyToggle';

export function AssessmentChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCategories = pathname?.includes('/categories');
  const isNew = pathname?.includes('/new');
  const isReview = pathname?.includes('/review');
  const isReport = pathname?.includes('/report');
  const currentWorkspace = isCategories
    ? 'Category data workspace'
    : isNew
      ? 'Revision export and restore workspace'
      : isReview
        ? 'Review and export workspace'
        : isReport
          ? 'Printable report workspace'
          : 'Assessment workspace';

  return (
    <div className="ida-workspace-shell">
      <div className="ida-workspace-topbar">
        <div className="ida-workspace-context">
          <p className="ida-workspace-eyebrow">Operator Workspace</p>
          <h2 className="ida-workspace-title">{currentWorkspace}</h2>
        </div>
        <nav className="ida-workspace-nav" aria-label="Assessment workspace navigation">
          <Link href="/" className="ida-btn ida-btn-outline-secondary ida-btn-sm">
            ← Home
          </Link>
          <Link
            href="/assessment/categories/"
            className={isCategories ? 'ida-btn ida-btn-primary ida-btn-sm' : 'ida-btn ida-btn-outline-secondary ida-btn-sm'}
          >
            Category workspace
          </Link>
          <Link
            href="/assessment/new/"
            className={isNew ? 'ida-btn ida-btn-primary ida-btn-sm' : 'ida-btn ida-btn-outline-secondary ida-btn-sm'}
          >
            Revision exports
          </Link>
          <Link
            href="/assessment/review/"
            className={isReview ? 'ida-btn ida-btn-primary ida-btn-sm' : 'ida-btn ida-btn-outline-secondary ida-btn-sm'}
          >
            Review and export
          </Link>
          <Link
            href="/assessment/report/"
            className={isReport ? 'ida-btn ida-btn-primary ida-btn-sm' : 'ida-btn ida-btn-outline-secondary ida-btn-sm'}
          >
            Printable report
          </Link>
        </nav>
        <div className="ida-workspace-toggles">
          <PraSlaToggle />
          <CrossDependencyToggle />
        </div>
      </div>
      <p className="ida-workspace-note">
        Progress saves locally while you navigate tabs, review dependencies, and generate exports.
      </p>
      {children}
    </div>
  );
}
