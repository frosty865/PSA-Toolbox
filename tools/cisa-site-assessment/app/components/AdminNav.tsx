"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/assessments', label: 'Assessment Management', icon: '📝' },
    { href: '/admin/module-management', label: 'Module Management', icon: '📦' },
    { href: '/admin/source-registry', label: 'Source Registry', icon: '📚' },
    { href: '/admin/problem-candidates', label: 'Problem Candidates', icon: '📋' },
    { href: '/admin/reports/subtype-coverage', label: 'Subtype Coverage', icon: '📋' },
    { href: '/admin/server-tools', label: 'Server Tools', icon: '🔧' },
  ];

  return (
    <nav style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--cisa-gray-light)',
      padding: 'var(--spacing-md) 0',
      marginBottom: 'var(--spacing-lg)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 var(--spacing-lg)',
        display: 'flex',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap'
      }}>
        {navItems.map((item) => {
          let isActive: boolean;
          if (item.href === '/admin/module-management') {
            isActive = pathname === '/admin/module-management' || pathname?.startsWith('/admin/modules') || pathname?.startsWith('/admin/module-data') || pathname?.startsWith('/admin/module-drafts');
          } else if (item.href === '/admin/assessments') {
            isActive = pathname === '/admin/assessments';
          } else {
            isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href.split('?')[0]));
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: isActive ? 'var(--cisa-blue)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--cisa-gray-dark)',
                textDecoration: 'none',
                borderRadius: 'var(--border-radius)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? 'var(--cisa-blue)' : 'var(--cisa-gray-light)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
