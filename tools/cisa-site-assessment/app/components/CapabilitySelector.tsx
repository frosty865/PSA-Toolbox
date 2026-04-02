'use client';

import React from 'react';

interface CapabilityItem {
  subtype_code: string;
  label: string;
  description?: string;
}

interface CapabilitySelectorProps {
  disciplineCode: string;
  items: CapabilityItem[];
  selectedSubtypeCodes: string[];
  onToggleSubtype: (subtype_code: string, nextSelected: boolean) => void;
}

/**
 * CapabilitySelector Component
 * 
 * Renders a checkbox list of capabilities (subtypes) for a discipline.
 * Used for technology-heavy disciplines where subtype spines are hidden.
 */
export default function CapabilitySelector({
  disciplineCode,
  items,
  selectedSubtypeCodes,
  onToggleSubtype,
}: CapabilitySelectorProps) {
  void disciplineCode; // reserved for future filtering
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
        Select applicable capabilities
      </h4>
      <p
        style={{
          margin: '0 0 var(--spacing-md) 0',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--cisa-gray)',
          fontStyle: 'italic',
        }}
      >
        Select the capabilities that are implemented. Follow-on questions will appear based on your selections.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {items.map((item) => {
          const isSelected = selectedSubtypeCodes.includes(item.subtype_code);
          return (
            <label
              key={item.subtype_code}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#e7f3f8' : 'transparent',
                border: isSelected ? '1px solid #005ea2' : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onToggleSubtype(item.subtype_code, e.target.checked)}
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
                    fontWeight: isSelected ? 600 : 400,
                    color: 'var(--cisa-gray-dark)',
                    marginBottom: item.description ? '0.25rem' : 0,
                  }}
                >
                  {item.label}
                </div>
                {item.description && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--cisa-gray)',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
