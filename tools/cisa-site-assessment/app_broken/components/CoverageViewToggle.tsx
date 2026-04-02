"use client";

interface CoverageViewToggleProps {
  showRaw: boolean;
  onToggle: (showRaw: boolean) => void;
}

export default function CoverageViewToggle({ showRaw, onToggle }: CoverageViewToggleProps) {
  return (
    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--cisa-gray-lighter)', borderRadius: '4px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={showRaw}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ fontWeight: 500 }}>Raw Phase 2 View</span>
      </label>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--cisa-gray)' }}>
        {showRaw 
          ? 'Showing raw Phase 2 v1 data exactly as stored in database'
          : 'Showing Phase 2.5 quality-controlled view (primary/reference evidence separated)'}
      </div>
    </div>
  );
}

