"use client";

import { useState, useEffect } from 'react';

interface ModuleOfc {
  id: string;
  ofc_text: string;
  title: string | null;
  status: string;
  discipline_subtype_id: string | null;
  discipline_id: string | null;
  discipline: string | null;
  subtype: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  ofc_class?: 'FOUNDATIONAL' | 'OPERATIONAL' | 'PHYSICAL';
}

interface Discipline {
  id: string;
  name: string;
  code: string;
  discipline_subtypes: Array<{
    id: string;
    name: string;
    code: string;
    is_active?: boolean;
  }>;
}

export default function ModuleDataManagementPage() {
  const [ofcs, setOfcs] = useState<ModuleOfc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('');
  
  // Create/edit modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    ofc_text: '',
    title: '',
    discipline_subtype_id: '',
    status: 'PENDING',
    ofc_class: 'FOUNDATIONAL' as 'FOUNDATIONAL' | 'OPERATIONAL' | 'PHYSICAL'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDisciplines();
    loadModuleOfcs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when filters change
  }, [statusFilter, searchFilter, selectedDiscipline, selectedSubtype]);

  const loadDisciplines = async () => {
    try {
      const response = await fetch('/api/reference/disciplines?active=true', {
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        setDisciplines(data.disciplines || []);
      }
    } catch (err) {
      console.error('Error loading disciplines:', err);
    }
  };

  const loadModuleOfcs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (searchFilter) {
        params.append('search', searchFilter);
      }
      if (selectedDiscipline) {
        params.append('discipline_id', selectedDiscipline);
      }
      if (selectedSubtype) {
        params.append('subtype_id', selectedSubtype);
      }
      
      // Add timestamp to bust cache
      const cacheBuster = `_t=${Date.now()}`;
      const url = `/api/admin/module-ofcs/list?${params.toString()}${params.toString() ? '&' : ''}${cacheBuster}`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to load MODULE OFCs');
      }
      
      if (data.success && data.ofcs) {
        setOfcs(data.ofcs);
      } else {
        setOfcs([]);
      }
    } catch (err) {
      console.error('Error loading MODULE OFCs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load MODULE OFCs');
      setOfcs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      ofc_text: '',
      title: '',
      discipline_subtype_id: '',
      status: 'PENDING',
      ofc_class: 'FOUNDATIONAL'
    });
    setShowCreateModal(true);
  };

  const handleEdit = (ofc: ModuleOfc) => {
    setEditingId(ofc.id);
    setFormData({
      ofc_text: ofc.ofc_text,
      title: ofc.title || '',
      discipline_subtype_id: ofc.discipline_subtype_id || '',
      status: ofc.status,
      ofc_class: ofc.ofc_class ?? 'FOUNDATIONAL'
    });
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formData.ofc_text.trim()) {
      setError('OFC text is required');
      return;
    }
    
    if (!formData.discipline_subtype_id) {
      setError('Discipline subtype is required');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const url = editingId 
        ? `/api/admin/module-ofcs/update/${editingId}`
        : '/api/admin/module-ofcs/create';
      
      const method = editingId ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to save MODULE OFC');
      }
      
      setShowCreateModal(false);
      loadModuleOfcs();
    } catch (err) {
      console.error('Error saving MODULE OFC:', err);
      setError(err instanceof Error ? err.message : 'Failed to save MODULE OFC');
    } finally {
      setSaving(false);
    }
  };

  const availableSubtypes = selectedDiscipline
    ? disciplines
        .find((d) => d.id === selectedDiscipline)
        ?.discipline_subtypes?.filter((st) => st.is_active !== false) || []
    : [];

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
      case 'REVIEWED':
        return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'PROMOTED':
        return { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' };
      case 'REJECTED':
        return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>
          Module Data Management
        </h1>
        <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
          MODULE OFC candidate queue (ofc_candidate_queue, ofc_origin=MODULE). These are separate from CORPUS OFCs.
        </p>
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 'var(--border-radius)',
            fontSize: 'var(--font-size-sm)',
            color: '#92400e',
          }}
        >
          <strong>This list is global and not scoped by module.</strong> OFCs in a module&apos;s Overview (from import or &quot;Add OFC&quot;) live in <em>module_ofcs</em> and do <strong>not</strong> appear here. To add OFCs to a specific module and keep them scoped, use that module&apos;s Overview tab and click <strong>Add OFC</strong>. Module OFCs can be registered into this queue using the <strong>Register in Module Data queue</strong> action on a module&apos;s Overview (explicit, not automatic). Creating here does not attach the OFC to any module.
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--border-radius)',
        marginBottom: 'var(--spacing-md)',
        border: '1px solid var(--cisa-gray-light)'
      }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              Search
            </label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search OFC text..."
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)'
              }}
            />
          </div>
          
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)'
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="REVIEWED">REVIEWED</option>
              <option value="PROMOTED">PROMOTED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              Discipline
            </label>
            <select
              value={selectedDiscipline}
              onChange={(e) => {
                setSelectedDiscipline(e.target.value);
                setSelectedSubtype('');
              }}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)'
              }}
            >
              <option value="">All Disciplines</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              Subtype
            </label>
            <select
              value={selectedSubtype}
              onChange={(e) => setSelectedSubtype(e.target.value)}
              disabled={!selectedDiscipline}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                opacity: selectedDiscipline ? 1 : 0.5
              }}
            >
              <option value="">All Subtypes</option>
              {availableSubtypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleCreate}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--cisa-blue)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            + Create MODULE OFC
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--border-radius)',
          marginBottom: 'var(--spacing-md)',
          border: '1px solid #fca5a5'
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          Loading MODULE OFCs...
        </div>
      )}

      {/* OFC List */}
      {!loading && (
        <div>
          {ofcs.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '1px solid var(--cisa-gray-light)'
            }}>
              <p style={{ color: 'var(--cisa-gray)', marginBottom: 'var(--spacing-md)' }}>
                No MODULE OFCs found.
              </p>
              <button
                onClick={handleCreate}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'var(--cisa-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Create First MODULE OFC
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {ofcs.map((ofc) => {
                const statusColors = getStatusBadgeColor(ofc.status);
                return (
                  <div
                    key={ofc.id}
                    style={{
                      backgroundColor: '#ffffff',
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--cisa-gray-light)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            backgroundColor: statusColors.bg,
                            color: statusColors.color,
                            border: `1px solid ${statusColors.border}`
                          }}>
                            {ofc.status}
                          </span>
                          {ofc.discipline && ofc.subtype && (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)' }}>
                              {ofc.discipline} → {ofc.subtype}
                            </span>
                          )}
                        </div>
                        {ofc.title && (
                          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                            {ofc.title}
                          </h3>
                        )}
                        <p style={{ color: 'var(--cisa-gray-dark)', lineHeight: 1.6 }}>
                          {ofc.ofc_text}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit(ofc)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          backgroundColor: 'transparent',
                          color: 'var(--cisa-blue)',
                          border: '1px solid var(--cisa-blue)',
                          borderRadius: 'var(--border-radius)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-sm)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-sm)' }}>
                      Created: {formatDate(ofc.created_at)}
                      {ofc.reviewed_at && ` • Reviewed: ${formatDate(ofc.reviewed_at)}`}
                      {ofc.reviewed_by && ` by ${ofc.reviewed_by}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--border-radius)',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
              {editingId ? 'Edit MODULE OFC' : 'Create MODULE OFC'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  OFC Text *
                </label>
                <textarea
                  value={formData.ofc_text}
                  onChange={(e) => setFormData({ ...formData, ofc_text: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Enter the OFC text..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)'
                  }}
                  placeholder="Enter a title..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  Discipline *
                </label>
                <select
                  value={disciplines.find(d => d.discipline_subtypes.some(st => st.id === formData.discipline_subtype_id))?.id || ''}
                  onChange={(e) => {
                    const discId = e.target.value;
                    // Find first subtype of selected discipline
                    const disc = disciplines.find(d => d.id === discId);
                    if (disc && disc.discipline_subtypes.length > 0) {
                      setFormData({ ...formData, discipline_subtype_id: disc.discipline_subtypes[0].id });
                    } else {
                      setFormData({ ...formData, discipline_subtype_id: '' });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <option value="">Select Discipline</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  Subtype *
                </label>
                <select
                  value={formData.discipline_subtype_id}
                  onChange={(e) => setFormData({ ...formData, discipline_subtype_id: e.target.value })}
                  disabled={!disciplines.find(d => d.discipline_subtypes.some(st => st.id === formData.discipline_subtype_id))}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)',
                    opacity: disciplines.find(d => d.discipline_subtypes.some(st => st.id === formData.discipline_subtype_id)) ? 1 : 0.5
                  }}
                >
                  <option value="">Select Subtype</option>
                  {disciplines
                    .find(d => d.discipline_subtypes.some(st => st.id === formData.discipline_subtype_id))
                    ?.discipline_subtypes
                    .filter(st => st.is_active !== false)
                    .map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  OFC Class *
                </label>
                <select
                  value={formData.ofc_class}
                  onChange={(e) => setFormData({ ...formData, ofc_class: e.target.value as 'FOUNDATIONAL' | 'OPERATIONAL' | 'PHYSICAL' })}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <option value="FOUNDATIONAL">FOUNDATIONAL (governance/plans/procedures/training)</option>
                  <option value="OPERATIONAL">OPERATIONAL (processes/assurance/drills/inspections)</option>
                  <option value="PHYSICAL">PHYSICAL (physical controls)</option>
                </select>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
                  Used for ranking: foundational OFCs are preferred first (not cost-based).
                </p>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-sm)',
                    border: '1px solid var(--cisa-gray-light)',
                    borderRadius: 'var(--border-radius)'
                  }}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="REVIEWED">REVIEWED</option>
                  <option value="PROMOTED">PROMOTED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--cisa-gray-dark)',
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  backgroundColor: 'var(--cisa-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
