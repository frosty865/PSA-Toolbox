'use client';

import { useMemo } from 'react';
import type { ChecklistItem } from '@/app/lib/types/checklist';

interface CapabilityChecklistProps {
  items: ChecklistItem[];
  selected: string[]; // selected tags
  onChange: (nextTags: string[]) => void;
}

/**
 * CapabilityChecklist Component
 * 
 * Renders a multi-select checklist where checking an item adds its tags to the selected set.
 */
export default function CapabilityChecklist({
  items,
  selected,
  onChange,
}: CapabilityChecklistProps) {
  const checkedItems = useMemo(() => {
    const checked = new Set<string>();
    for (const item of items) {
      if (item.tags.some(tag => selected.includes(tag))) checked.add(item.id);
    }
    return checked;
  }, [items, selected]);

  const handleItemToggle = (item: ChecklistItem, isChecked: boolean) => {
    const newChecked = new Set(checkedItems);
    if (isChecked) {
      newChecked.add(item.id);
    } else {
      newChecked.delete(item.id);
    }
    // Compute new selected tags
    const newSelectedTags = new Set<string>();
    for (const it of items) {
      if (newChecked.has(it.id)) {
        for (const tag of it.tags) {
          newSelectedTags.add(tag);
        }
      }
    }

    onChange(Array.from(newSelectedTags));
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        border: '1px solid var(--cisa-gray-light)',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--spacing-md)',
        marginTop: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-md)',
        backgroundColor: '#f9fafb',
      }}
    >
      <h4
        style={{
          margin: '0 0 var(--spacing-sm) 0',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--cisa-gray-dark)',
        }}
      >
        Capability Checklist
      </h4>
      <p
        style={{
          margin: '0 0 var(--spacing-md) 0',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--cisa-gray)',
          fontStyle: 'italic',
        }}
      >
        Select capabilities that apply. Follow-on questions will appear based on your selections.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {items.map((item) => {
          const isChecked = checkedItems.has(item.id);
          return (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                backgroundColor: isChecked ? '#e7f3f8' : 'transparent',
                border: isChecked ? '1px solid #005ea2' : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isChecked) {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isChecked) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => handleItemToggle(item, e.target.checked)}
                style={{
                  marginTop: '0.25rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: isChecked ? 600 : 400,
                    color: 'var(--cisa-gray-dark)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--cisa-gray)',
                    lineHeight: 1.4,
                  }}
                >
                  {item.description}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
