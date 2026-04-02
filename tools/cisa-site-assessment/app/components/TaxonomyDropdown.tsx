"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function TaxonomyDropdown() {
  const pathname = usePathname();
  const [showTaxonomyDropdown, setShowTaxonomyDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTaxonomyDropdown && !(event.target as Element)?.closest('[data-dropdown="taxonomy"]')) {
        setShowTaxonomyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTaxonomyDropdown]);

  return (
    <div className="nav-dropdown" data-dropdown="taxonomy">
      <button
        onClick={() => setShowTaxonomyDropdown(!showTaxonomyDropdown)}
        className={`nav-dropdown-button ${(pathname === '/reference/sectors' || pathname === '/reference/disciplines' || pathname === '/reference/baseline-questions' || pathname?.startsWith('/reference/baseline-questions/') || pathname?.startsWith('/reference/question-focus')) ? 'active' : ''}`}
        style={{ fontSize: '0.875rem', opacity: 0.8 }}
      >
        Reference
        <span style={{ fontSize: 'var(--font-size-xs)' }}>
          {showTaxonomyDropdown ? '▲' : '▼'}
        </span>
      </button>
      
      {showTaxonomyDropdown && (
        <div className="nav-dropdown-menu">
          <Link
            href="/reference/baseline-questions/"
            className={`nav-dropdown-item ${pathname === '/reference/baseline-questions' || pathname?.startsWith('/reference/baseline-questions/') ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowTaxonomyDropdown(false); }}
          >
            Coverage
          </Link>
          <Link
            href="/reference/sectors"
            className={`nav-dropdown-item ${pathname === '/reference/sectors' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowTaxonomyDropdown(false); }}
          >
            Sectors
          </Link>
          <Link
            href="/reference/disciplines"
            className={`nav-dropdown-item ${pathname === '/reference/disciplines' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowTaxonomyDropdown(false); }}
          >
            Disciplines
          </Link>
          <Link
            href="/reference/question-focus"
            className={`nav-dropdown-item ${pathname?.startsWith('/reference/question-focus') ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowTaxonomyDropdown(false); }}
          >
            Question Focus
          </Link>
        </div>
      )}
    </div>
  );
}

