"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DefineStep from './steps/DefineStep';
import SourcesStep from './steps/SourcesStep';
import GenerateStep from './steps/GenerateStep';
import ReviewStep from './steps/ReviewStep';
import PublishStep from './steps/PublishStep';

export type WizardStep = 'define' | 'sources' | 'generate' | 'review' | 'publish';

export interface WizardState {
  module_code?: string;
  title?: string;
  description?: string;
  sources?: Array<{
    id: string;
    url?: string;
    label?: string;
    upload_path?: string;
    corpus_source_id?: string;
  }>;
  generated_content?: {
    questions: Array<{
      criterion_key: string;
      question_text: string;
      discipline_subtype_id: string;
      asset_or_location: string;
      event_trigger?: string;
      order_index: number;
    }>;
    ofcs: Array<{
      criterion_key: string;
      ofc_id: string;
      ofc_text: string;
      order_index: number;
    }>;
  };
  reviewed_content?: {
    questions: Array<{
      criterion_key: string;
      question_text: string;
      discipline_subtype_id: string;
      asset_or_location: string;
      event_trigger?: string;
      order_index: number;
    }>;
    ofcs: Array<{
      criterion_key: string;
      ofc_id: string;
      ofc_text: string;
      order_index: number;
    }>;
  };
}

const STEPS: WizardStep[] = ['define', 'sources', 'generate', 'review', 'publish'];
const STEP_NAMES: Record<WizardStep, string> = {
  define: 'Define Module',
  sources: 'Add Sources',
  generate: 'Generate Content',
  review: 'Review & Edit',
  publish: 'Publish'
};

function ModuleWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get('step') as WizardStep | null;
  const draftIdParam = searchParams.get('draftId');
  
  const [currentStep, setCurrentStep] = useState<WizardStep>(stepParam && STEPS.includes(stepParam) ? stepParam : 'define');
  const [wizardState, setWizardState] = useState<WizardState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load state from localStorage or draft; reset when starting a new module
  useEffect(() => {
    // First try to load from draft if draftId is provided
    if (draftIdParam) {
      setLoading(true);
      fetch(`/api/admin/module-drafts/${draftIdParam}`)
        .then(r => r.json())
        .then(data => {
          if (data.draft) {
            const draft = data.draft;
            const draftSources = (data.sources || []).map((s: Record<string, unknown>) => ({
              id: String(s.source_id ?? ''),
              url: String(s.source_url ?? ''),
              label: String(s.source_label ?? '')
            }));
            
            // Convert draft questions to wizard format
            const questions = (data.questions || []).map((q: Record<string, unknown>, idx: number) => ({
              criterion_key: `Q${(idx + 1).toString().padStart(3, '0')}`,
              question_text: String(q.question_text ?? ''),
              discipline_subtype_id: String(q.discipline_subtype_id ?? ''),
              asset_or_location: 'Module Asset',
              event_trigger: 'TAMPERING',
              order_index: idx + 1
            }));

            const loadedState: WizardState = {
              module_code: draft.module_code || undefined,
              title: draft.title || undefined,
              description: draft.summary || undefined,
              sources: draftSources,
              generated_content: {
                questions: questions,
                ofcs: [] // OFCs not stored in drafts yet
              }
            };

            setWizardState(loadedState);
            localStorage.setItem('module_wizard_state', JSON.stringify(loadedState));
            
            // Determine appropriate step based on draft state
            if (questions.length > 0) {
              setCurrentStep(stepParam || 'review');
            } else if (draftSources.length > 0) {
              setCurrentStep(stepParam || 'generate');
            } else if (draft.module_code) {
              setCurrentStep(stepParam || 'sources');
            }
          }
        })
        .catch(err => {
          console.error('Failed to load draft:', err);
          setError('Failed to load draft');
        })
        .finally(() => setLoading(false));
    } else {
      // No draft: landing with no step = "New module" — reset tabs and state
      const isStartingNew = !stepParam;
      if (isStartingNew) {
        setWizardState({});
        setCurrentStep('define');
        localStorage.removeItem('module_wizard_state');
        router.replace('/admin/modules/new?step=define');
      } else {
        // Resuming a previous session (e.g. step=sources) — load from localStorage
        const saved = localStorage.getItem('module_wizard_state');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setWizardState(parsed);
            if (parsed.module_code && stepParam) {
              setCurrentStep(stepParam);
            } else if (parsed.generated_content?.questions?.length > 0) {
              setCurrentStep('review');
            } else if (parsed.sources?.length > 0) {
              setCurrentStep('generate');
            } else if (parsed.module_code) {
              setCurrentStep('sources');
            }
          } catch (e) {
            console.error('Failed to load wizard state:', e);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  // Save state to localStorage
  const saveState = (updates: Partial<WizardState>) => {
    const newState = { ...wizardState, ...updates };
    setWizardState(newState);
    localStorage.setItem('module_wizard_state', JSON.stringify(newState));
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      setCurrentStep(nextStep);
      router.push(`/admin/modules/new?step=${nextStep}`);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1];
      setCurrentStep(prevStep);
      router.push(`/admin/modules/new?step=${prevStep}`);
    }
  };

  const handleStepChange = (step: WizardStep) => {
    setCurrentStep(step);
    router.push(`/admin/modules/new?step=${step}`);
  };

  const getStepIndex = (step: WizardStep): number => {
    return STEPS.indexOf(step);
  };

  const isStepComplete = (step: WizardStep): boolean => {
    switch (step) {
      case 'define':
        return !!wizardState.module_code && !!wizardState.title;
      case 'sources':
        return !!(wizardState.sources && wizardState.sources.length > 0);
      case 'generate':
        return !!(wizardState.generated_content && wizardState.generated_content.questions.length > 0);
      case 'review':
        return !!(wizardState.reviewed_content || wizardState.generated_content);
      case 'publish':
        return false; // Publish is never "complete" until actually published
      default:
        return false;
    }
  };

  const canAccessStep = (step: WizardStep): boolean => {
    const stepIndex = getStepIndex(step);
    const currentIndex = getStepIndex(currentStep);
    
    // Can always access current step
    if (stepIndex === currentIndex) return true;
    
    // Can access previous steps if they're complete
    if (stepIndex < currentIndex) return true;
    
    // Can access next step only if current step is complete
    if (stepIndex === currentIndex + 1) {
      return isStepComplete(currentStep);
    }
    
    // Can't access steps beyond next
    return false;
  };

  return (
    <section className="section active">
      <div className="section-header">
        <h1 className="section-title">Module Wizard</h1>
        <p style={{ 
          fontSize: 'var(--font-size-base)', 
          color: 'var(--cisa-gray)', 
          lineHeight: 1.6, 
          marginTop: 'var(--spacing-md)',
          maxWidth: '800px'
        }}>
          Create a new module through a guided, source-driven workflow. Add sources, generate questions and OFCs, review, and publish.
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--spacing-sm)', 
        marginBottom: 'var(--spacing-lg)',
        flexWrap: 'wrap'
      }}>
        {STEPS.map((step, index) => {
          const isComplete = isStepComplete(step);
          const isCurrent = step === currentStep;
          const canAccess = canAccessStep(step);
          
          return (
            <button
              key={step}
              onClick={() => canAccess && handleStepChange(step)}
              disabled={!canAccess}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: isComplete ? '#4caf50' : isCurrent ? 'var(--cisa-blue)' : 'var(--cisa-gray-light)',
                color: isComplete || isCurrent ? 'white' : 'var(--cisa-gray)',
                border: 'none',
                borderRadius: '4px',
                cursor: canAccess ? 'pointer' : 'not-allowed',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isCurrent ? 'bold' : 'normal',
                opacity: canAccess ? 1 : 0.6,
                position: 'relative'
              }}
              title={!canAccess ? 'Complete previous steps first' : isComplete ? 'Step completed' : ''}
            >
              {index + 1}. {STEP_NAMES[step]}
              {isComplete && !isCurrent && ' ✓'}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="card" style={{ 
          backgroundColor: '#fee', 
          borderColor: '#fcc', 
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step Content */}
      <div>
        {currentStep === 'define' && (
          <DefineStep
            state={wizardState}
            onUpdate={saveState}
            onNext={handleNext}
            onError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        {currentStep === 'sources' && (
          <SourcesStep
            state={wizardState}
            onUpdate={saveState}
            onNext={handleNext}
            onBack={handleBack}
            onError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        {currentStep === 'generate' && (
          <GenerateStep
            state={wizardState}
            onUpdate={saveState}
            onNext={handleNext}
            onBack={handleBack}
            onError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            key={wizardState.generated_content ? `review-${wizardState.generated_content.questions?.length ?? 0}-${wizardState.generated_content.ofcs?.length ?? 0}` : 'review-empty'}
            state={wizardState}
            onUpdate={saveState}
            onNext={handleNext}
            onBack={handleBack}
            onError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        {currentStep === 'publish' && (
          <PublishStep
            state={wizardState}
            onBack={handleBack}
            onError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}
      </div>
    </section>
  );
}

export default function ModuleWizardPage() {
  return (
    <Suspense fallback={<div className="section active"><p>Loading wizard…</p></div>}>
      <ModuleWizardContent />
    </Suspense>
  );
}
