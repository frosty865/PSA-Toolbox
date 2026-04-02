'use client';

import { useEffect, useMemo, useState } from 'react';
import { ADMIN_COOKIE_NAME } from '@/app/lib/admin/constants';
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

function writeCookie(name: string, value: string) {
  const cookieParts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${ADMIN_COOKIE_MAX_AGE_SECONDS}`,
  ];

  if (window.location.protocol === 'https:') {
    cookieParts.push('Secure');
  }

  document.cookie = cookieParts.join('; ');
}

export default function AdminAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocalhost = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const host = window.location.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }, []);

  useEffect(() => {
    if (isLocalhost) {
      setSubmitted(true);
      return;
    }

    const existing = readCookie(ADMIN_COOKIE_NAME);
    if (existing) {
      setSubmitted(true);
    }
  }, [isLocalhost]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = token.trim();
    if (!trimmed) {
      setError('Enter the admin token to continue.');
      return;
    }

    writeCookie(ADMIN_COOKIE_NAME, trimmed);
    setError(null);
    setSubmitted(true);
    window.location.reload();
  };

  if (submitted) {
    return <>{children}</>;
  }

  return (
    <div style={{
      minHeight: '50vh',
      display: 'grid',
      placeItems: 'center',
      padding: '2rem 1rem',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(100%, 32rem)',
          border: '1px solid #dfe1e2',
          borderRadius: '0.75rem',
          background: '#fff',
          padding: '1.5rem',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1b1b1b' }}>
          Admin Access Required
        </h2>
        <p style={{ margin: '0.75rem 0 1rem', color: '#5b616b', lineHeight: 1.5 }}>
          Enter the PSA admin token to unlock this area. The token is stored in a browser cookie
          for 30 days and is sent automatically with same-origin admin API requests.
        </p>

        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }} htmlFor="admin-token">
          Admin token
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #b0b4b8',
            borderRadius: '0.375rem',
            padding: '0.75rem 0.875rem',
            fontSize: '1rem',
            marginBottom: '0.75rem',
          }}
        />

        {error ? (
          <div style={{ color: '#b00020', marginBottom: '0.75rem' }}>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            border: 0,
            borderRadius: '0.375rem',
            padding: '0.75rem 1rem',
            background: '#005ea2',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Unlock admin tools
        </button>
      </form>
    </div>
  );
}
