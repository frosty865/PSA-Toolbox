"use client";

import { useState } from 'react';
import { useSecurityMode } from '../contexts/SecurityModeContext';

export default function TestingMenu() {
  const { mode, mutable, allowed_modes, setMode, error } = useSecurityMode();
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // Only show menu if mutable
  if (!mutable) {
    return null;
  }

  const handleModeChange = async (newMode: string) => {
    setChanging(true);
    const success = await setMode(newMode, 'testing-ui');
    setChanging(false);
    
    if (success) {
      setShowConfirm(null);
      setShowMenu(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          fontSize: 'var(--font-size-sm)',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 'var(--border-radius)',
          cursor: 'pointer',
        }}
      >
        🧪 Testing
      </button>

      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 'var(--spacing-xs)',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: 'var(--border-radius)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            padding: 'var(--spacing-md)',
            minWidth: '300px',
            zIndex: 1000,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
            Security Enforcement Mode
          </h3>
          
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
            Current: <strong>{mode}</strong>
          </p>

          {error && (
            <div style={{
              padding: 'var(--spacing-sm)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--border-radius)',
              color: '#991b1b',
              fontSize: 'var(--font-size-xs)',
              marginBottom: 'var(--spacing-md)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {allowed_modes.map((allowedMode) => (
              <button
                key={allowedMode}
                onClick={() => setShowConfirm(allowedMode)}
                disabled={changing || allowedMode === mode}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  fontSize: 'var(--font-size-sm)',
                  backgroundColor: allowedMode === mode ? '#e5e7eb' : '#3b82f6',
                  color: allowedMode === mode ? '#6b7280' : '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: allowedMode === mode ? 'not-allowed' : 'pointer',
                  opacity: changing ? 0.6 : 1,
                }}
              >
                Switch to {allowedMode}
                {allowedMode === mode && ' (current)'}
              </button>
            ))}
          </div>

          {showConfirm && (
            <div style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--border-radius)',
            }}>
              <p style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--font-size-sm)' }}>
                Confirm: Switch to <strong>{showConfirm}</strong>?
              </p>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <button
                  onClick={() => handleModeChange(showConfirm)}
                  disabled={changing}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--border-radius)',
                    cursor: changing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {changing ? 'Changing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  disabled={changing}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 'var(--border-radius)',
                    cursor: changing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

