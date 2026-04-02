"use client";

import { useSecurityMode } from '../contexts/SecurityModeContext';

export default function SecurityModeBanner() {
  const { mode, loading } = useSecurityMode();

  if (loading) {
    return null; // Don't show banner while loading
  }

  let bannerStyle: React.CSSProperties;
  let icon: string;
  let message: string;

  switch (mode) {
    case 'DISABLED':
      bannerStyle = {
        backgroundColor: '#fef3c7',
        borderBottom: '2px solid #f59e0b',
        color: '#92400e',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 'var(--font-size-sm)',
      };
      icon = '⚠';
      message = 'Security Enforcement DISABLED — Design/Test Mode';
      break;
    
    case 'ENGINEERING':
      bannerStyle = {
        backgroundColor: '#dbeafe',
        borderBottom: '2px solid #3b82f6',
        color: '#1e40af',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 'var(--font-size-sm)',
      };
      icon = '🔧';
      message = 'Engineering-Only Review Mode';
      break;
    
    case 'ENFORCED':
      bannerStyle = {
        backgroundColor: '#fef2f2',
        borderBottom: '2px solid #ef4444',
        color: '#991b1b',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 'var(--font-size-sm)',
      };
      icon = '🔒';
      message = 'Security Enforcement Enabled';
      break;
    
    default:
      return null;
  }

  return (
    <div style={bannerStyle}>
      <strong>{icon} {message}</strong>
    </div>
  );
}

