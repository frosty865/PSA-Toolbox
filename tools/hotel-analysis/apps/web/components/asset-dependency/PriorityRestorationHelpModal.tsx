'use client';

import React from 'react';
import { PriorityRestorationHelpPanel } from './PriorityRestorationHelpPanel';
import type { PriorityRestorationTopic, PriorityRestorationTopicKey } from '@/app/lib/asset-dependency/priorityRestorationSchema';

export type PriorityRestorationHelpModalProps = {
  topicKey: PriorityRestorationTopicKey;
  value: PriorityRestorationTopic;
  onChange: (next: PriorityRestorationTopic) => void;
  onClose: () => void;
  showNotes?: boolean;
  warningText?: string;
};

export function PriorityRestorationHelpModal(props: PriorityRestorationHelpModalProps) {
  const { onClose } = props;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Priority Restoration and Service Level Agreement"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--background, #fff)',
          borderRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: '42rem',
          width: '100%',
          marginBottom: '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border, #eee)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ float: 'right' }}
          >
            Close
          </button>
          <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
            Priority Restoration and Service Level Agreement
          </span>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <PriorityRestorationHelpPanel
            topicKey={props.topicKey}
            value={props.value}
            onChange={props.onChange}
            showNotes={props.showNotes}
            warningText={props.warningText}
          />
        </div>
      </div>
    </div>
  );
}
