"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SecurityModeState {
  mode: 'DISABLED' | 'ENGINEERING' | 'ENFORCED';
  mutable: boolean;
  allowed_modes: string[];
  loading: boolean;
  error: string | null;
}

interface SecurityModeContextType extends SecurityModeState {
  refreshMode: () => Promise<void>;
  setMode: (newMode: string, requestedBy: string) => Promise<boolean>;
}

const SecurityModeContext = createContext<SecurityModeContextType | undefined>(undefined);

export function SecurityModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SecurityModeState>({
    mode: 'DISABLED',
    mutable: false,
    allowed_modes: ['DISABLED', 'ENGINEERING', 'ENFORCED'],
    loading: false, // Start as false so page doesn't block
    error: null,
  });

  const refreshMode = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Use a shorter timeout and make it non-blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch('/api/system/security-mode', {
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch security mode: ${response.status}`);
      }

      const data = await response.json();
      
      setState({
        mode: data.mode || 'DISABLED',
        mutable: data.mutable || false,
        allowed_modes: data.allowed_modes || ['DISABLED', 'ENGINEERING', 'ENFORCED'],
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      // Silently fail - use defaults so page still loads
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn('Security mode fetch failed, using defaults:', msg);
      setState(prev => ({
        ...prev,
        mode: 'DISABLED',
        mutable: false,
        allowed_modes: ['DISABLED', 'ENGINEERING', 'ENFORCED'],
        loading: false,
        error: null, // Don't show error, just use defaults
      }));
    }
  };

  const setMode = async (newMode: string, requestedBy: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/system/security-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requested_mode: newMode,
          requested_by: requestedBy,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to set security mode: ${response.status}`);
      }

      // Refresh mode from backend to get authoritative state
      await refreshMode();
      return true;
    } catch (err: unknown) {
      console.error('Error setting security mode:', err);
      const msg = err instanceof Error ? err.message : 'Failed to set security mode';
      setState(prev => ({
        ...prev,
        error: msg,
      }));
      return false;
    }
  };

  useEffect(() => {
    refreshMode();
  }, []);

  return (
    <SecurityModeContext.Provider value={{ ...state, refreshMode, setMode }}>
      {children}
    </SecurityModeContext.Provider>
  );
}

export function useSecurityMode() {
  const context = useContext(SecurityModeContext);
  if (context === undefined) {
    // Return default values during SSR or when provider is not available
    return {
      mode: 'DISABLED' as const,
      mutable: false,
      allowed_modes: ['DISABLED', 'ENGINEERING', 'ENFORCED'],
      loading: false,
      error: null,
      refreshMode: async () => {},
      setMode: async () => false,
    };
  }
  return context;
}

