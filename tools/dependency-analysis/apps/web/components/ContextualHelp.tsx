'use client';

import React, { useState } from 'react';

export interface ContextualHelpProps {
  /** Help text to display in tooltip/modal */
  helpText: string;
  /** Icon label for accessibility */
  ariaLabel?: string;
  /** Custom icon class or element */
  iconClass?: string;
}

/**
 * Displays a contextual help icon that shows help text on hover or click.
 * Used for detailed explanations of when/how to use N/A or other contextual guidance.
 */
export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  helpText,
  ariaLabel = 'Help',
  iconClass = 'text-blue-600 hover:text-blue-800 cursor-help',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border border-current font-bold text-xs ${iconClass}`}
        title={helpText}
        aria-label={ariaLabel}
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        ?
      </button>

      {showTooltip && (
        <div
          className="absolute z-50 left-0 top-0 mt-8 p-3 text-sm max-w-xs rounded"
          style={{
            maxWidth: '300px',
            backgroundColor: 'var(--cisa-white)',
            border: '1px solid var(--cisa-gray-light)',
            color: 'var(--cisa-gray)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {helpText}
          <div
            className="absolute left-2 w-0 h-0"
            style={{
              top: '-8px',
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '8px solid var(--cisa-gray-light)',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ContextualHelp;
