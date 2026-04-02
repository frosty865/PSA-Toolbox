"use client";

import { useState, useEffect } from 'react';

interface Vulnerability {
  id: string;
  discipline: string;
  discipline_subtype: string;
  canonical_title: string;
  canonical_description: string;
  status: string;
  created_at: string;
  updated_at: string;
  evidence_count: number;
}

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

type SortField = string;
type SortOrder = 'ASC' | 'DESC';
type ViewMode = 'vulnerabilities' | 'ofcs' | 'both';

export default function OFCAndVulnerabilitiesPage() {
  const [loading, setLoading] = useState(true);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [ofcs, setOfcs] = useState<CanonicalOFC[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  
  // Filters
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Sorting
  const [vulnSortField, setVulnSortField] = useState<SortField>('created_at');
  const [vulnSortOrder, setVulnSortOrder] = useState<SortOrder>('DESC');
  const [ofcSortField, setOfcSortField] = useState<SortField>('created_at');
  const [ofcSortOrder, setOfcSortOrder] = useState<SortOrder>('DESC');

  useEffect(() => {
    loadDisciplines();
  }, []);

  useEffect(() => {
    if (viewMode === 'vulnerabilities' || viewMode === 'both') {
      loadVulnerabilities();
    }
    if (viewMode === 'ofcs' || viewMode === 'both') {
      loadOFCs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run when filters/sort change; loaders are stable
  }, [viewMode, selectedDisciplineId, selectedSubtypeId, statusFilter, vulnSortField, vulnSortOrder, ofcSortField, ofcSortOrder]);

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

  const loadVulnerabilities = async () => {
    setLoading(true);
    try {
      let url = `/api/vulnerabilities?sort_by=${vulnSortField}&sort_order=${vulnSortOrder}`;
      
      if (selectedDisciplineId) {
        const discipline = disciplines.find(d => d.id === selectedDisciplineId);
        if (discipline) {
          url += `&discipline=${encodeURIComponent(discipline.name)}`;
        }
      }
      
      if (selectedSubtypeId) {
        const discipline = disciplines.find(d => d.id === selectedDisciplineId);
        const subtype = discipline?.discipline_subtypes?.find(st => st.id === selectedSubtypeId);
        if (subtype) {
          url += `&discipline_subtype=${encodeURIComponent(subtype.name)}`;
        }
      }
      
      if (statusFilter) {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setVulnerabilities(data.vulnerabilities || []);
        if (data.message) {
          console.warn('Vulnerabilities API message:', data.message);
        }
      }
    } catch (err) {
      console.error('Failed to load vulnerabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOFCs = async () => {
    setLoading(true);
    try {
      let url = `/api/ofc/canonical?status=ACTIVE&sort_by=${ofcSortField}&sort_order=${ofcSortOrder}`;
      
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

  const handleVulnSort = (field: SortField) => {
    if (vulnSortField === field) {
      setVulnSortOrder(vulnSortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setVulnSortField(field);
      setVulnSortOrder('DESC');
    }
  };

  const handleOfcSort = (field: SortField) => {
    if (ofcSortField === field) {
      setOfcSortOrder(ofcSortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setOfcSortField(field);
      setOfcSortOrder('DESC');
    }
  };

  const SortIndicator = ({ currentField, sortField, sortOrder }: { currentField: string; sortField: string; sortOrder: SortOrder }) => {
    if (currentField !== sortField) return null;
    return <span>{sortOrder === 'ASC' ? ' ↑' : ' ↓'}</span>;
  };

  const selectedDiscipline = disciplines.find(d => d.id === selectedDisciplineId);
  const subtypes = selectedDiscipline?.discipline_subtypes || [];

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1600px', margin: '0 auto' }}>
      <h1>Vulnerabilities & Options for Consideration</h1>
      <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
        Browse normalized vulnerabilities and canonical OFCs with advanced sorting and filtering.
      </p>

      {/* View Mode Toggle */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
        <button
          onClick={() => setViewMode('both')}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: viewMode === 'both' ? '#3b82f6' : '#e5e7eb',
            color: viewMode === 'both' ? '#ffffff' : '#1b1b1b',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Both
        </button>
        <button
          onClick={() => setViewMode('vulnerabilities')}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: viewMode === 'vulnerabilities' ? '#3b82f6' : '#e5e7eb',
            color: viewMode === 'vulnerabilities' ? '#ffffff' : '#1b1b1b',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Vulnerabilities Only
        </button>
        <button
          onClick={() => setViewMode('ofcs')}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: viewMode === 'ofcs' ? '#3b82f6' : '#e5e7eb',
            color: viewMode === 'ofcs' ? '#ffffff' : '#1b1b1b',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          OFCs Only
        </button>
      </div>

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

        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
            Status (Vulnerabilities)
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid #d1d5db',
              borderRadius: 'var(--border-radius)'
            }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          {/* Vulnerabilities Table */}
          {(viewMode === 'vulnerabilities' || viewMode === 'both') && (
            <div>
              <h2>Vulnerabilities ({vulnerabilities.length})</h2>
              {vulnerabilities.length === 0 ? (
                <div style={{ padding: 'var(--spacing-md)', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--border-radius)', color: '#92400e' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>No vulnerabilities found.</p>
                  <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)' }}>
                    If this is unexpected, ensure the migration <code>20251218_add_normalized_libraries.sql</code> has been run.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('canonical_title')}
                        >
                          Title <SortIndicator currentField="canonical_title" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('discipline')}
                        >
                          Discipline <SortIndicator currentField="discipline" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('discipline_subtype')}
                        >
                          Subtype <SortIndicator currentField="discipline_subtype" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('status')}
                        >
                          Status <SortIndicator currentField="status" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('created_at')}
                        >
                          Created <SortIndicator currentField="created_at" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleVulnSort('updated_at')}
                        >
                          Updated <SortIndicator currentField="updated_at" sortField={vulnSortField} sortOrder={vulnSortOrder} />
                        </th>
                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db' }}>
                          Evidence Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vulnerabilities.map((vuln) => (
                        <tr key={vuln.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>
                            <div style={{ fontWeight: 600 }}>{vuln.canonical_title}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                              {vuln.canonical_description.substring(0, 100)}...
                            </div>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>{vuln.discipline}</td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>{vuln.discipline_subtype}</td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: 'var(--font-size-xs)',
                              backgroundColor: vuln.status === 'approved' ? '#d1fae5' : vuln.status === 'deprecated' ? '#fee2e2' : '#fef3c7',
                              color: vuln.status === 'approved' ? '#065f46' : vuln.status === 'deprecated' ? '#991b1b' : '#92400e'
                            }}>
                              {vuln.status}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', fontSize: 'var(--font-size-sm)' }}>
                            {new Date(vuln.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', fontSize: 'var(--font-size-sm)' }}>
                            {new Date(vuln.updated_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', textAlign: 'center' }}>
                            {vuln.evidence_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OFCs Table */}
          {(viewMode === 'ofcs' || viewMode === 'both') && (
            <div>
              <h2>Canonical OFCs ({ofcs.length})</h2>
              {ofcs.length === 0 ? (
                <p style={{ color: 'var(--cisa-gray)' }}>No canonical OFCs found matching filters.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('title')}
                        >
                          Title <SortIndicator currentField="title" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('canonical_code')}
                        >
                          Code <SortIndicator currentField="canonical_code" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('discipline_name')}
                        >
                          Discipline <SortIndicator currentField="discipline_name" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('subtype_name')}
                        >
                          Subtype <SortIndicator currentField="subtype_name" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('version_major')}
                        >
                          Version <SortIndicator currentField="version_major" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('created_at')}
                        >
                          Created <SortIndicator currentField="created_at" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th 
                          style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db', cursor: 'pointer' }}
                          onClick={() => handleOfcSort('approved_at')}
                        >
                          Approved <SortIndicator currentField="approved_at" sortField={ofcSortField} sortOrder={ofcSortOrder} />
                        </th>
                        <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', border: '1px solid #d1d5db' }}>
                          Citations
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ofcs.map((ofc) => (
                        <tr key={ofc.canonical_ofc_id} style={{ borderBottom: '1px solid #d1d5db' }}>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>
                            <div style={{ fontWeight: 600 }}>{ofc.title}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                              {ofc.ofc_text.substring(0, 100)}...
                            </div>
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                            {ofc.canonical_code}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>{ofc.discipline_name || 'N/A'}</td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>{ofc.subtype_name || 'N/A'}</td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db' }}>
                            {ofc.version_major}.{ofc.version_minor}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', fontSize: 'var(--font-size-sm)' }}>
                            {new Date(ofc.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', fontSize: 'var(--font-size-sm)' }}>
                            {new Date(ofc.approved_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 'var(--spacing-sm)', border: '1px solid #d1d5db', textAlign: 'center' }}>
                            {ofc.citation_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

