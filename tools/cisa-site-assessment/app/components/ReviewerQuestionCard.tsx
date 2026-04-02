'use client';

import { useState } from 'react';
import IntentPanel from './IntentPanel';
import type { SubtypeGuidance } from '@/app/lib/types/baseline';

interface ReviewerQuestion {
  canon_id: string;
  question_text: string;
  discipline_code?: string;
  subtype_code?: string;
  discipline_subtype_id?: string | null; // Gating: only signal for Help (IntentPanel)
  subtype_guidance?: SubtypeGuidance | null;
  depth?: number;
}

interface ReviewerQuestionCardProps {
  question: ReviewerQuestion;
  response?: {
    response_enum_value: 'YES' | 'NO' | 'N_A';
  };
  defaultOpenIntent?: boolean;
}

/**
 * ReviewerQuestionCard Component
 * 
 * Displays a question in reviewer mode:
 * - Question text
 * - Selected answer (if present)
 * - Intent panel (always available)
 * Does NOT show scoring, weights, or analytics.
 */
export default function ReviewerQuestionCard({
  question,
  response,
  defaultOpenIntent = false,
}: ReviewerQuestionCardProps) {
  const [_isIntentOpen, _setIsIntentOpen] = useState(defaultOpenIntent);
  void _isIntentOpen;
  void _setIsIntentOpen;

  const responseValue = response?.response_enum_value === 'N_A' ? 'N/A' : response?.response_enum_value;

  // Get discipline/subtype display
  const disciplineDisplay = question.discipline_code || 'Unknown';
  const subtypeDisplay = question.subtype_code || (question.depth === 1 ? 'Discipline-level' : 'Unknown');

  return (
    <div
      style={{
        border: '1px solid var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-md)',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--spacing-sm)',
          paddingBottom: 'var(--spacing-sm)',
          borderBottom: '1px solid var(--cisa-gray-light)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--cisa-gray)',
              marginBottom: '0.25rem',
            }}
          >
            <span style={{ fontFamily: 'monospace' }}>{question.canon_id}</span>
            {' • '}
            <span>{disciplineDisplay}</span>
            {question.subtype_code && (
              <>
                {' • '}
                <span>{subtypeDisplay}</span>
              </>
            )}
            {question.depth && (
              <>
                {' • '}
                <span>Depth {question.depth}</span>
              </>
            )}
          </div>
        </div>
        {responseValue && (
          <div
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              backgroundColor:
                responseValue === 'YES'
                  ? '#d1fae5'
                  : responseValue === 'NO'
                  ? '#fee2e2'
                  : '#f3f4f6',
              color:
                responseValue === 'YES'
                  ? '#065f46'
                  : responseValue === 'NO'
                  ? '#991b1b'
                  : '#374151',
              border: `1px solid ${
                responseValue === 'YES'
                  ? '#6ee7b7'
                  : responseValue === 'NO'
                  ? '#fca5a5'
                  : '#d1d5db'
              }`,
              flexShrink: 0,
            }}
          >
            {responseValue}
          </div>
        )}
      </div>

      {/* Question Text */}
      <div
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--cisa-gray-dark)',
          lineHeight: 1.6,
          marginBottom: 'var(--spacing-md)',
          fontWeight: 500,
        }}
      >
        {question.question_text}
      </div>

      {/* Help: only when discipline_subtype_id is present. IntentPanel uses Reference Impl then Subtype Overview. */}
      {Boolean(question.discipline_subtype_id) ? (
        <IntentPanel
          defaultOpen={defaultOpenIntent}
          disciplineSubtypeId={question.discipline_subtype_id ?? null}
          subtypeCode={question.subtype_code}
          subtypeGuidance={question.subtype_guidance || null}
        />
      ) : (
        <div
          style={{
            padding: 'var(--spacing-sm)',
            backgroundColor: '#f9fafb',
            border: '1px solid var(--cisa-gray-light)',
            borderRadius: 'var(--border-radius)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--cisa-gray)',
            fontStyle: 'italic',
          }}
        >
          No subtype is assigned to this question.
        </div>
      )}
    </div>
  );
}
