"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CanonicalOFC {
  canonical_ofc_id: string;
  canonical_code: string;
  title: string;
  ofc_text: string;
  discipline_id: string;
  discipline_subtype_id: string;
  status: string;
  version_major: number;
  version_minor: number;
  created_at: string;
  created_by: string;
  approved_at: string;
  approved_by: string;
  discipline_name?: string;
  discipline_code?: string;
  subtype_name?: string;
  subtype_code?: string;
  citation_count: number;
}

interface Discipline {
  id: string;
  name: string;
  code: string;
  discipline_subtypes?: Array<{ id: string; name: string; code: string }>;
}

interface OfcCitation {
  citation_id: string;
  page?: string | number | null;
  excerpt?: string | null;
  source_publisher?: string | null;
  source_title?: string | null;
  source_key?: string | null;
  source_tier?: string | null;
  source_label?: string | null;
}

export default function CanonicalOFCLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [ofcs, setOfcs] = useState<CanonicalOFC[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string>('');
  const [selectedOfc, setSelectedOfc] = useState<CanonicalOFC | null>(null);
  const [citations, setCitations] = useState<OfcCitation[]>([]);
  const [loadingCitations, setLoadingCitations] = useState(false);

  useEffect(() => {
    loadDisciplines();
    loadOFCs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when filters change
  }, [selectedDisciplineId, selectedSubtypeId]);

  const loadDisciplines = async () => {
    try {
      const response = await fetch('/api/reference/disciplines?active=true');
      const data = await response.json();
      if (data.success && data.disciplines) {
        setDisciplines(data.disciplines);
      }
    } catch (err) {
      console.error('Failed to load disciplines:', err);
    }
  };

  const loadOFCs = async () => {
    setLoading(true);
    try {
      let url = '/api/ofc/canonical?status=ACTIVE';
      if (selectedDisciplineId) {
        url += `&discipline_id=${selectedDisciplineId}`;
      }
      if (selectedSubtypeId) {
        url += `&discipline_subtype_id=${selectedSubtypeId}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setOfcs(data.canonical_ofcs || []);
      }
    } catch (err) {
      console.error('Failed to load canonical OFCs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCitations = async (canonicalOfcId: string) => {
    setLoadingCitations(true);
    try {
      const response = await fetch(`/api/ofc/canonical/${canonicalOfcId}`);
      const data = await response.json();
      if (data.success && data.canonical_ofc) {
        setCitations((Array.isArray(data.canonical_ofc.citations) ? data.canonical_ofc.citations : []).map((c: Record<string, unknown>, idx: number) => ({
          citation_id: typeof c.citation_id === "string" ? c.citation_id : `citation-${idx}`,
          page: c.page as string | number | null | undefined,
          excerpt: typeof c.excerpt === "string" ? c.excerpt : null,
          source_publisher: typeof c.source_publisher === "string" ? c.source_publisher : null,
          source_title: typeof c.source_title === "string" ? c.source_title : null,
          source_key: typeof c.source_key === "string" ? c.source_key : null,
          source_tier: typeof c.source_tier === "string" ? c.source_tier : null,
          source_label: typeof c.source_label === "string" ? c.source_label : null,
        })));
      }
    } catch (err) {
      console.error('Failed to load citations:', err);
    } finally {
      setLoadingCitations(false);
    }
  };

  const handleSelectOfc = (ofc: CanonicalOFC) => {
    setSelectedOfc(ofc);
    loadCitations(ofc.canonical_ofc_id);
  };

  const selectedDiscipline = disciplines.find(d => d.id === selectedDisciplineId);
  const subtypes = selectedDiscipline?.discipline_subtypes || [];

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Canonical OFC Library</h1>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
        Browse approved canonical Operational Functional Capabilities. Canonical OFCs are immutable and versioned.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Discipline
          </label>
          <select
            value={selectedDisciplineId}
            onChange={(e) => {
              setSelectedDisciplineId(e.target.value);
              setSelectedSubtypeId('');
            }}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          >
            <option value="">All Disciplines</option>
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Subtype
          </label>
          <select
            value={selectedSubtypeId}
            onChange={(e) => setSelectedSubtypeId(e.target.value)}
            disabled={!selectedDisciplineId}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)',
              opacity: selectedDisciplineId ? 1 : 0.6
            }}
          >
            <option value="">All Subtypes</option>
            {subtypes.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Link
            href="/ofcs/nominate"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius)',
              fontWeight: 600
            }}
          >
            Nominate New OFC
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <p>Loading canonical OFCs...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
          {/* OFCs List */}
          <div>
            <h2>Canonical OFCs ({ofcs.length})</h2>
            {ofcs.length === 0 ? (
              <p style={{ color: 'var(--cisa-gray)' }}>No canonical OFCs found matching filters.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {ofcs.map(ofc => (
                  <div
                    key={ofc.canonical_ofc_id}
                    onClick={() => handleSelectOfc(ofc)}
                    style={{
                      padding: 'var(--spacing-md)',
                      border: '1px solid #d1d5db',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      backgroundColor: selectedOfc?.canonical_ofc_id === ofc.canonical_ofc_id ? '#eff6ff' : 'white',
                      borderColor: selectedOfc?.canonical_ofc_id === ofc.canonical_ofc_id ? '#3b82f6' : '#d1d5db'
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                      {ofc.title}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-xs)' }}>
                      {ofc.canonical_code}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                      {ofc.discipline_name} {ofc.subtype_name && `| ${ofc.subtype_name}`}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                      Citations: {ofc.citation_count} | Version: {ofc.version_major}.{ofc.version_minor}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div>
            {selectedOfc ? (
              <div style={{
                padding: 'var(--spacing-lg)',
                border: '1px solid #d1d5db',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'white'
              }}>
                <h2>Canonical OFC Details</h2>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Title:</strong> {selectedOfc.title}
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Canonical Code:</strong>
                  <div style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: '#f9fafb',
                    borderRadius: 'var(--border-radius)',
                    marginTop: 'var(--spacing-xs)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-sm)'
                  }}>
                    {selectedOfc.canonical_code}
                  </div>
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>OFC Text:</strong>
                  <div style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: '#f9fafb',
                    borderRadius: 'var(--border-radius)',
                    marginTop: 'var(--spacing-xs)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedOfc.ofc_text}
                  </div>
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Discipline:</strong> {selectedOfc.discipline_name || 'N/A'}
                  {selectedOfc.subtype_name && (
                    <> | <strong>Subtype:</strong> {selectedOfc.subtype_name}</>
                  )}
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Version:</strong> {selectedOfc.version_major}.{selectedOfc.version_minor} | 
                  <strong> Status:</strong> {selectedOfc.status}
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Created:</strong> {new Date(selectedOfc.created_at).toLocaleString()} by {selectedOfc.created_by}
                  <br />
                  <strong>Approved:</strong> {new Date(selectedOfc.approved_at).toLocaleString()} by {selectedOfc.approved_by}
                </div>

                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <strong>Citations ({selectedOfc.citation_count}):</strong>
                  {loadingCitations ? (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>Loading citations...</p>
                  ) : citations.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>No citations available.</p>
                  ) : (
                    <div style={{ marginTop: 'var(--spacing-sm)' }}>
                      {citations.map((citation, idx) => (
                        <div
                          key={citation.citation_id || `citation-${idx}`}
                          style={{
                            padding: 'var(--spacing-sm)',
                            backgroundColor: '#f9fafb',
                            borderRadius: 'var(--border-radius)',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-sm)'
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                            Citation {idx + 1}
                             {citation.page != null && ` (Page ${String(citation.page)})`}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--spacing-xs)' }}>
                            {citation.excerpt}
                          </div>
                          {/* Source Provenance: Display publisher, title, source_key, and authority tier */}
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                            {citation.source_publisher && (
                              <div><strong>Publisher:</strong> {citation.source_publisher}</div>
                            )}
                            {citation.source_title && (
                              <div><strong>Title:</strong> {citation.source_title}</div>
                            )}
                            {citation.source_key && (
                              <div><strong>Source Key:</strong> <code style={{ fontSize: '0.85em' }}>{citation.source_key}</code></div>
                            )}
                            {citation.source_tier && (
                              <div><strong>Authority Tier:</strong> {citation.source_tier}</div>
                            )}
                            {/* Fallback to legacy source_label if new fields not available */}
                            {!citation.source_publisher && !citation.source_title && citation.source_label && (
                              <div><strong>Source:</strong> {citation.source_label}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: 'var(--border-radius)',
                  color: '#92400e',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  <strong>Note:</strong> Canonical OFCs are immutable. To update, create a new version or deprecate this OFC.
                </div>
              </div>
            ) : (
              <div style={{
                padding: 'var(--spacing-lg)',
                border: '1px solid #d1d5db',
                borderRadius: 'var(--border-radius)',
                backgroundColor: '#f9fafb',
                textAlign: 'center',
                color: 'var(--cisa-gray)'
              }}>
                Select a canonical OFC to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
