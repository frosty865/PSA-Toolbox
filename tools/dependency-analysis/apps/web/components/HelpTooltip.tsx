'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface HelpTooltipProps {
  helpText: string;
  /** Optional positioning hint: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({ helpText, position = 'top' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current;
      const trigger = triggerRef.current;
      const rect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust position if tooltip would overflow viewport
      let newPosition = position;
      
      if (position === 'top' && rect.top - tooltipRect.height < 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && rect.bottom + tooltipRect.height > viewportHeight - 10) {
        newPosition = 'top';
      } else if (position === 'left' && rect.left - tooltipRect.width < 10) {
        newPosition = 'right';
      } else if (position === 'right' && rect.right + tooltipRect.width > viewportWidth - 10) {
        newPosition = 'left';
      }

      setAdjustedPosition(newPosition);
    }
  }, [visible, position]);

  const getTooltipStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '0.875rem',
      lineHeight: '1.4',
      maxWidth: '280px',
      width: 'max-content',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      pointerEvents: 'none',
    };

    switch (adjustedPosition) {
      case 'top':
        return {
          ...base,
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
        };
      case 'bottom':
        return {
          ...base,
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
        };
      case 'left':
        return {
          ...base,
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px',
        };
      case 'right':
        return {
          ...base,
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px',
        };
      default:
        return base;
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible(!visible);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'help',
          padding: '0 4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bs-info, #0dcaf0)',
        }}
        aria-label="Help information"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M8 11.5V11.5C8 11.2239 8.22386 11 8.5 11H8.5C8.77614 11 9 11.2239 9 11.5V11.5C9 11.7761 8.77614 12 8.5 12H8.5C8.22386 12 8 11.7761 8 11.5Z"
            fill="currentColor"
          />
          <path
            d="M8 9V8.5C8 7.67157 8.67157 7 9.5 7V7C10.3284 7 11 6.32843 11 5.5V5.5C11 4.67157 10.3284 4 9.5 4H8.5C7.67157 4 7 4.67157 7 5.5V5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {visible && (
        <div ref={tooltipRef} style={getTooltipStyles()}>
          {helpText}
        </div>
      )}
    </span>
  );
}
