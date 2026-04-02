"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function QuestionFocusSubtypePage() {
  const params = useParams();
  const discipline = params.discipline as string;
  const subtype = params.subtype as string;
  
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        console.error('Error loading question focus page:', err);
        const errorMessage = err.message || 'Failed to load question focus page';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (discipline && subtype) {
      loadContent();
    }
  }, [discipline, subtype]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
          <p>Loading question focus page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
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
              borderRadius: '4px',
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
    );
  }

  // Extract discipline and subtype names from content or use params
  const [disciplineName, setDisciplineName] = useState<string>('');
  const [subtypeName, setSubtypeName] = useState<string>('');

  useEffect(() => {
    // Fetch discipline and subtype names from API
    const fetchNames = async () => {
      try {
        const disciplinesResponse = await fetch('/api/reference/disciplines?active=true', { cache: 'no-store' });
        if (disciplinesResponse.ok) {
          const disciplinesData = await disciplinesResponse.json();
          const allDisciplines = disciplinesData.disciplines || [];
          
          // Find matching discipline by code
          const matchingDiscipline = allDisciplines.find((d: any) => 
            d.code?.toUpperCase() === discipline.toUpperCase()
          );
          
          if (matchingDiscipline) {
            setDisciplineName(matchingDiscipline.name || discipline);
            
            // Find matching subtype
            const subtypes = matchingDiscipline.discipline_subtypes || [];
            const matchingSubtype = subtypes.find((st: any) => 
              st.code?.toUpperCase() === subtype.toUpperCase()
            );
            
            if (matchingSubtype) {
              setSubtypeName(matchingSubtype.name || subtype);
            } else {
              setSubtypeName(subtype);
            }
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
    
    if (discipline && subtype) {
      fetchNames();
    }
  }, [discipline, subtype]);

  return (
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
        style={{
          backgroundColor: '#fff',
          padding: 'var(--spacing-xl)',
          borderRadius: '4px',
          border: '1px solid #e5e7eb'
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}

