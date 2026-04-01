'use client';

import React from 'react';

const badgeBase = 'px-3 py-2 text-xs font-bold tracking-wide';

export function SlaMttrBadge(props: {
  enabled: boolean;
  mttrMaxHours: number | null;
  /** When false, show "SLA not assessed" only; do not imply absence of SLA. */
  slaAssessed?: boolean;
  /** When true, use inline layout instead of absolute overlay (avoids overlapping content). */
  inline?: boolean;
}) {
  const { enabled, mttrMaxHours, slaAssessed = true, inline = false } = props;
  const positionStyle = inline ? {} : { position: 'absolute' as const, top: '0.5rem', right: '0.5rem', zIndex: 10 };

  const baseStyle = { flexShrink: 0 as const, ...positionStyle };

  if (slaAssessed === false) {
    return (
      <div className={badgeBase} style={{ ...baseStyle, background: 'var(--cisa-gray-lighter)', color: 'var(--cisa-gray-dark)', border: '1px solid var(--cisa-gray-light)' }}>
        <div>SLA NOT ASSESSED</div>
      </div>
    );
  }

  if (enabled && (mttrMaxHours === null || !Number.isFinite(mttrMaxHours))) {
    return (
      <div className={badgeBase} style={{ ...baseStyle, background: 'white', color: 'black', border: '2px solid black' }}>
        <div>SLA DOCUMENTED</div>
        <div className="mt-1 border-t border-black pt-1">MTTR-MAX NOT CAPTURED</div>
      </div>
    );
  }

  if (enabled && mttrMaxHours !== null && Number.isFinite(mttrMaxHours)) {
    return (
      <div className={badgeBase} style={{ ...baseStyle, background: 'black', color: 'white' }}>
        <div>SLA DOCUMENTED</div>
        <div className="mt-1 border-t border-white pt-1">MTTR-MAX: {mttrMaxHours} HOURS</div>
      </div>
    );
  }

  return (
    <div className={badgeBase} style={{ ...baseStyle, background: 'white', color: 'black', border: '2px solid black' }}>
      <div>NO SLA DOCUMENTED</div>
    </div>
  );
}
