"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function QuestionFocusSubtypePage() {
  const params = useParams();
  const discipline = (params?.discipline as string) ?? '';
  const subtype = (params?.subtype as string) ?? '';

  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplineName, setDisciplineName] = useState<string>('');
  const [subtypeName, setSubtypeName] = useState<string>('');

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/reference/question-focus/${discipline}/${subtype}`,
          { cache: 'no-store' }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
          const errorMsg = data.error || 'Failed to load question focus page';
          const debugInfo = data.debug ? `\n\nDebug info: ${JSON.stringify(data.debug, null, 2)}` : '';
          throw new Error(errorMsg + debugInfo);
        }
        
        setContent(data.content || '');
        setError(null);
      } catch (err: unknown) {
        console.error('Error loading question focus page:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load question focus page';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (discipline && subtype) {
      loadContent();
    }
  }, [discipline, subtype]);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const disciplinesResponse = await fetch('/api/reference/disciplines?active=true', { cache: 'no-store' });
        if (disciplinesResponse.ok) {
          const disciplinesData = await disciplinesResponse.json();
          const allDisciplines = disciplinesData.disciplines || [];
          const matchingDiscipline = allDisciplines.find((d: { code?: string }) =>
            d.code?.toUpperCase() === discipline.toUpperCase()
          );
          if (matchingDiscipline) {
            setDisciplineName((matchingDiscipline as { name?: string }).name || discipline);
            const subtypes = (matchingDiscipline as { discipline_subtypes?: Array<{ code?: string; name?: string }> }).discipline_subtypes || [];
            const matchingSubtype = subtypes.find((st: { code?: string }) =>
              st.code?.toUpperCase() === subtype.toUpperCase()
            );
            setSubtypeName(matchingSubtype ? matchingSubtype.name || subtype : subtype);
          } else {
            setDisciplineName(discipline);
            setSubtypeName(subtype);
          }
        }
      } catch (err) {
        console.error('Error fetching discipline/subtype names:', err);
        setDisciplineName(discipline);
        setSubtypeName(subtype);
      }
    };
    if (discipline && subtype) fetchNames();
  }, [discipline, subtype]);

  if (loading) {
    return (
      <section className="section active">
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" style={{ margin: '0 auto var(--spacing-md)' }}></div>
            <p>Loading question focus page...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section active">
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="card" style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--border-radius)',
            color: '#991b1b'
          }}>
            <h2 style={{ marginTop: 0 }}>Error</h2>
            <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{error}</p>
            <details style={{ marginTop: 'var(--spacing-md)' }}>
              <summary style={{ cursor: 'pointer', color: '#1e40af' }}>Debug Information</summary>
              <pre style={{ 
                marginTop: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm)',
                backgroundColor: '#f3f4f6',
                borderRadius: 'var(--border-radius)',
                overflow: 'auto',
                fontSize: 'var(--font-size-sm)'
              }}>
                Discipline: {discipline}
                Subtype: {subtype}
              </pre>
            </details>
            <Link
              href="/reference/question-focus"
              style={{
                color: '#1e40af',
                textDecoration: 'underline',
                marginTop: 'var(--spacing-md)',
                display: 'inline-block'
              }}
            >
              ← Back to Question Focus Pages
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <Link
            href="/reference/question-focus"
            style={{
              color: '#1e40af',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--spacing-md)',
              display: 'inline-block'
            }}
          >
            ← Back to Question Focus Pages
          </Link>
        </div>

        {/* Header with Baseline Reference Badge */}
        <div style={{
          marginBottom: 'var(--spacing-lg)',
          paddingBottom: 'var(--spacing-md)',
          borderBottom: '2px solid var(--cisa-gray-light)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-sm)',
            flexWrap: 'wrap'
          }}>
            <h1 style={{
              fontSize: 'var(--font-size-xxl)',
              fontWeight: 700,
              color: 'var(--cisa-blue)',
              margin: 0,
              flex: 1
            }}>
              {subtypeName || subtype}
            </h1>
            <div style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 'var(--border-radius)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: '#0369a1',
              whiteSpace: 'nowrap'
            }}>
              Baseline Reference
            </div>
          </div>
          
          {disciplineName && (
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--cisa-gray)',
              margin: 0,
              marginBottom: 'var(--spacing-xs)'
            }}>
              Discipline: <strong>{disciplineName}</strong>
            </p>
          )}
          
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--cisa-gray)',
            margin: 0,
            fontStyle: 'italic'
          }}>
            This page explains the focus of baseline questions. It does not affect scoring.
          </p>
        </div>

        {/* Content */}
        <div
          className="card"
          style={{
            padding: 'var(--spacing-xl)'
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  );
}
