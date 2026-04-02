"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AvailableQuestion {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string | null;
}

interface ModuleIndex {
  layer: string;
  questions_by_module: Record<string, string[]>;
}

export default function AuthorModulePage() {
  const router = useRouter();
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [moduleCode, setModuleCode] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [existingModules, setExistingModules] = useState<ModuleIndex | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAvailableQuestions();
    fetchExistingModules();
  }, []);

  const fetchAvailableQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/runtime/questions?universe=BASE');
      if (!response.ok) {
        throw new Error('Failed to fetch available questions');
      }
      const data = await response.json();
      
      // Get baseline questions (modules typically use baseline questions)
      const allQuestions: AvailableQuestion[] = (data.base_questions || []).map((q: Record<string, unknown>) => ({
        canon_id: String(q.question_code ?? ''),
        question_text: String(q.question_text ?? ''),
        discipline_code: String(q.discipline_code ?? 'N/A'),
        subtype_code: q.subtype_code != null ? String(q.subtype_code) : null
      }));

      setAvailableQuestions(allQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingModules = async () => {
    try {
      const response = await fetch('/api/admin/modules');
      if (response.ok) {
        const data = await response.json();
        setExistingModules(data);
      }
    } catch (err) {
      console.error('Failed to fetch existing modules:', err);
    }
  };

  const handleQuestionToggle = (canonId: string) => {
    const newSelected = new Set(selectedQuestionIds);
    if (newSelected.has(canonId)) {
      newSelected.delete(canonId);
    } else {
      newSelected.add(canonId);
    }
    setSelectedQuestionIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!moduleCode.trim()) {
      setError('Module code is required');
      return;
    }

    if (!moduleCode.startsWith('MODULE_')) {
      setError('Module code must start with "MODULE_"');
      return;
    }

    if (selectedQuestionIds.size === 0) {
      setError('Please select at least one question');
      return;
    }

    // Check if module already exists
    if (existingModules?.questions_by_module[moduleCode]) {
      if (!confirm(`Module ${moduleCode} already exists. Do you want to replace it?`)) {
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Build updated module index
      const updatedModules = {
        layer: 'MODULE',
        questions_by_module: {
          ...(existingModules?.questions_by_module || {}),
          [moduleCode]: Array.from(selectedQuestionIds)
        }
      };

      const response = await fetch('/api/admin/modules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedModules)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save module');
      }

      setSuccess(`Module ${moduleCode} created successfully!`);
      
      // Reset form
      setModuleCode('');
      setSelectedQuestionIds(new Set());
      
      // Refresh existing modules
      await fetchExistingModules();
      
      // Redirect after a delay
      setTimeout(() => {
        router.push('/admin/modules');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save module');
    } finally {
      setSaving(false);
    }
  };

  const filteredQuestions = availableQuestions.filter(q => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return q.canon_id.toLowerCase().includes(term) ||
           q.question_text.toLowerCase().includes(term) ||
           q.discipline_code.toLowerCase().includes(term) ||
           (q.subtype_code && q.subtype_code.toLowerCase().includes(term));
  });

  if (loading) {
    return (
      <section className="section active">
        <div className="card">
          <p>Loading available questions...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Author New Module</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Create a new module by selecting questions from the available question set.
        </p>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: '#fee', borderColor: '#fcc', marginBottom: 'var(--spacing-lg)' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="card" style={{ backgroundColor: '#dfd', borderColor: '#afa', marginBottom: 'var(--spacing-lg)' }}>
          <strong>Success:</strong> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
            Module Code *
          </label>
          <input
            type="text"
            value={moduleCode}
            onChange={(e) => setModuleCode(e.target.value.toUpperCase())}
            placeholder="MODULE_EXAMPLE_NAME"
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-base)',
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: '4px'
            }}
          />
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--cisa-gray)', marginTop: 'var(--spacing-xs)' }}>
            Must start with &quot;MODULE_&quot; (e.g., MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT)
          </p>
        </div>

        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
            Selected Questions ({selectedQuestionIds.size})
          </label>
          {selectedQuestionIds.size === 0 ? (
            <p style={{ color: 'var(--cisa-gray)', fontStyle: 'italic' }}>
              No questions selected. Select questions from the list below.
            </p>
          ) : (
            <div style={{ 
              padding: 'var(--spacing-md)',
              backgroundColor: '#f9fafb',
              borderRadius: '4px',
              marginBottom: 'var(--spacing-md)'
            }}>
              {Array.from(selectedQuestionIds).map(canonId => {
                const question = availableQuestions.find(q => q.canon_id === canonId);
                return (
                  <div key={canonId} style={{ marginBottom: 'var(--spacing-xs)' }}>
                    <code>{canonId}</code> - {question?.question_text || 'Question not found'}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
            <label style={{ fontWeight: 'bold' }}>
              Available Questions ({availableQuestions.length})
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                fontSize: 'var(--font-size-sm)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px',
                width: '250px'
              }}
            />
          </div>
          <div style={{ 
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid var(--cisa-gray-light)',
            borderRadius: '4px',
            padding: 'var(--spacing-sm)'
          }}>
            {filteredQuestions.length === 0 ? (
              <p style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--cisa-gray)' }}>
                No questions match your search.
              </p>
            ) : (
              filteredQuestions.map((question) => (
              <div 
                key={question.canon_id}
                style={{
                  padding: 'var(--spacing-sm)',
                  marginBottom: 'var(--spacing-xs)',
                  backgroundColor: selectedQuestionIds.has(question.canon_id) ? '#e3f2fd' : 'transparent',
                  border: selectedQuestionIds.has(question.canon_id) ? '2px solid var(--cisa-blue)' : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => handleQuestionToggle(question.canon_id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.has(question.canon_id)}
                    onChange={() => handleQuestionToggle(question.canon_id)}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }}>
                      <code>{question.canon_id}</code>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      {question.question_text}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--cisa-gray)' }}>
                      Discipline: {question.discipline_code}
                      {question.subtype_code && ` | Subtype: ${question.subtype_code}`}
                    </div>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <button
            type="submit"
            disabled={saving || !moduleCode.trim() || selectedQuestionIds.size === 0}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: saving ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-base)'
            }}
          >
            {saving ? 'Saving...' : 'Create Module'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/modules')}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--cisa-gray-light)',
              border: '1px solid var(--cisa-gray)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
