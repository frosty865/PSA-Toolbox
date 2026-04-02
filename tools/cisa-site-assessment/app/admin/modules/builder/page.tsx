"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { shouldShowLegacyBuilder } from '@/app/lib/modules/module_workflow_flags';

interface AvailableQuestion {
  canon_id: string;
  question_text: string;
  discipline_code: string;
  subtype_code: string | null;
}

interface StepProps {
  step: number;
  currentStep: number;
  title: string;
  children: React.ReactNode;
}

function Step({ step, currentStep, title, children }: StepProps) {
  const isActive = step === currentStep;
  const isComplete = step < currentStep;

  return (
    <div style={{
      display: isActive ? 'block' : 'none',
      padding: 'var(--spacing-lg)',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: isActive ? '2px solid var(--cisa-blue)' : '1px solid var(--cisa-gray-light)',
      marginBottom: 'var(--spacing-lg)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 'var(--spacing-md)',
        paddingBottom: 'var(--spacing-md)',
        borderBottom: '1px solid var(--cisa-gray-light)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: isComplete ? '#4caf50' : isActive ? 'var(--cisa-blue)' : 'var(--cisa-gray-light)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          marginRight: 'var(--spacing-md)'
        }}>
          {isComplete ? '✓' : step}
        </div>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function ModuleBuilderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Module metadata
  const [moduleCode, setModuleCode] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Questions
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentStep === 2) {
      fetchAvailableQuestions();
    }
  }, [currentStep]);

  const fetchAvailableQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/runtime/questions?universe=BASE');
      if (!response.ok) {
        throw new Error('Failed to fetch available questions');
      }
      const data = await response.json();
      
      const questions: AvailableQuestion[] = (data.base_questions || []).map((q: Record<string, unknown>) => ({
        canon_id: String(q.question_code ?? ''),
        question_text: String(q.question_text ?? ''),
        discipline_code: String(q.discipline_code ?? 'N/A'),
        subtype_code: q.subtype_code != null ? String(q.subtype_code) : null
      }));

      setAvailableQuestions(questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
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

  const handleNext = () => {
    if (currentStep === 1) {
      if (!moduleCode.trim() || !moduleName.trim()) {
        setError('Module code and name are required');
        return;
      }
      if (!moduleCode.startsWith('MODULE_')) {
        setError('Module code must start with "MODULE_"');
        return;
      }
      setError(null);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedQuestionIds.size === 0) {
        setError('Please select at least one question');
        return;
      }
      setError(null);
      setCurrentStep(3);
    } else if (currentStep === 3) {
      handleSave();
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const moduleTemplate = {
        module_code: moduleCode.toUpperCase(),
        module_name: moduleName.trim(),
        description: description.trim() || undefined,
        questions: Array.from(selectedQuestionIds)
      };

      const response = await fetch('/api/admin/modules/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(moduleTemplate)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save module');
      }

      // Success - move to step 4
      setCurrentStep(4);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save module');
    } finally {
      setLoading(false);
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

  if (!shouldShowLegacyBuilder()) {
    return (
      <section className="section active">
        <div className="card" style={{ 
          backgroundColor: '#fff3cd', 
          borderColor: '#ffc107',
          padding: 'var(--spacing-lg)'
        }}>
          <h2 style={{ marginTop: 0, color: '#856404' }}>Module Builder Deprecated</h2>
          <p style={{ color: '#856404', marginBottom: 'var(--spacing-md)' }}>
            The legacy module builder has been replaced with the new Module Wizard, which provides
            a guided, source-driven workflow for creating modules.
          </p>
          <Link 
            href="/admin/modules/new"
            style={{
              display: 'inline-block',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--cisa-blue)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Go to Module Wizard →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Module Builder</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Create a new assessment module in 4 steps: metadata, questions, save, and enable for assessments.
        </p>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: '#fee', borderColor: '#fcc', marginBottom: 'var(--spacing-lg)' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1: Create Module Metadata */}
      <Step step={1} currentStep={currentStep} title="Step 1: Create Module Metadata">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
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
              Must start with &quot;MODULE_&quot; and contain only uppercase letters, numbers, and underscores
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
              Module Name *
            </label>
            <input
              type="text"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="Public Venue Crowd Management"
              required
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-base)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }}>
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and scope of this module..."
              rows={4}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-base)',
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: '4px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
            <button
              type="button"
              onClick={() => router.push('/admin/modules')}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                backgroundColor: 'var(--cisa-gray-light)',
                border: '1px solid var(--cisa-gray)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!moduleCode.trim() || !moduleName.trim()}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                backgroundColor: (!moduleCode.trim() || !moduleName.trim()) ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (!moduleCode.trim() || !moduleName.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              Next: Attach Questions
            </button>
          </div>
        </div>
      </Step>

      {/* Step 2: Attach Questions */}
      <Step step={2} currentStep={currentStep} title="Step 2: Attach Questions">
        {loading ? (
          <p>Loading questions...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                <label style={{ fontWeight: 'bold' }}>
                  Selected Questions ({selectedQuestionIds.size})
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
              
              {selectedQuestionIds.size > 0 && (
                <div style={{ 
                  padding: 'var(--spacing-md)',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  marginBottom: 'var(--spacing-md)',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {Array.from(selectedQuestionIds).map(canonId => {
                    const question = availableQuestions.find(q => q.canon_id === canonId);
                    return (
                      <div key={canonId} style={{ marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                        <code>{canonId}</code> - {question?.question_text || 'Question not found'}
                      </div>
                    );
                  })}
                </div>
              )}
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

            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  backgroundColor: 'var(--cisa-gray-light)',
                  border: '1px solid var(--cisa-gray)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedQuestionIds.size === 0}
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  backgroundColor: selectedQuestionIds.size === 0 ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedQuestionIds.size === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Next: Save to Library
              </button>
            </div>
          </div>
        )}
      </Step>

      {/* Step 3: Save to Library */}
      <Step step={3} currentStep={currentStep} title="Step 3: Save to Library">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>Module Summary</h3>
            <p><strong>Code:</strong> <code>{moduleCode}</code></p>
            <p><strong>Name:</strong> {moduleName}</p>
            {description && <p><strong>Description:</strong> {description}</p>}
            <p><strong>Questions:</strong> {selectedQuestionIds.size}</p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                backgroundColor: 'var(--cisa-gray-light)',
                border: '1px solid var(--cisa-gray)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                backgroundColor: loading ? 'var(--cisa-gray-light)' : 'var(--cisa-blue)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Saving...' : 'Save Module'}
            </button>
          </div>
        </div>
      </Step>

      {/* Step 4: Assessment Toggles */}
      <Step step={4} currentStep={currentStep} title="Step 4: Module Ready">
        <div style={{ padding: 'var(--spacing-md)', backgroundColor: '#d4edda', borderRadius: '4px', marginBottom: 'var(--spacing-md)' }}>
          <h3 style={{ marginTop: 0, color: '#155724' }}>✓ Module Created Successfully!</h3>
          <p style={{ color: '#155724' }}>
            Module <code>{moduleCode}</code> has been saved to the library and is ready to be enabled for assessments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <button
            type="button"
            onClick={() => router.push('/admin/modules')}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--cisa-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View Module Library
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentStep(1);
              setModuleCode('');
              setModuleName('');
              setDescription('');
              setSelectedQuestionIds(new Set());
              setError(null);
            }}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--cisa-gray-light)',
              border: '1px solid var(--cisa-gray)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create Another Module
          </button>
        </div>
      </Step>
    </section>
  );
}
