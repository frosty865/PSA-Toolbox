'use client';

import React, { useState, useCallback, useRef } from 'react';
import { SECTION_TABS, type SectionTabId } from '@/app/lib/ui/tabs';

export type SectionTabDef = { id: SectionTabId; title: string };

export interface SectionTabsShellProps {
  /** Render content for the active tab. Called with current tab id. */
  renderContent: (activeTabId: SectionTabId) => React.ReactNode;
  /** Return true if the current tab has blocking validation errors (visible fields only). Next button is disabled when true. */
  getBlockingError?: (tabId: SectionTabId) => boolean;
  /** Controlled: active tab id. When set, parent controls tab. */
  activeTabId?: SectionTabId;
  /** Controlled: called when user changes tab. */
  onTabChange?: (tabId: SectionTabId) => void;
  /** Optional actions to render in the nav row (e.g. Save). Receives activeTabId. */
  renderNavActions?: (activeTabId: SectionTabId) => React.ReactNode;
  /** Override tabs (e.g. filter out Cross-Dependency when disabled). Defaults to SECTION_TABS. */
  tabs?: readonly SectionTabDef[];
}

export function SectionTabsShell({ renderContent, getBlockingError, activeTabId: controlledTabId, onTabChange, renderNavActions, tabs: tabsProp }: SectionTabsShellProps) {
  const tabs = tabsProp ?? SECTION_TABS;
  const [internalTabId, setInternalTabId] = useState<SectionTabId>(tabs[0].id);
  const tablistRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledTabId !== undefined;
  const activeTabId = isControlled ? controlledTabId : internalTabId;
  const setActiveTabId = useCallback(
    (id: SectionTabId) => {
      if (!isControlled) setInternalTabId(id);
      onTabChange?.(id);
    },
    [isControlled, onTabChange]
  );

  const index = tabs.findIndex((t) => t.id === activeTabId);
  const canGoPrev = index > 0;
  const canGoNext = index >= 0 && index < tabs.length - 1;
  const hasBlockingError = getBlockingError?.(activeTabId) ?? false;

  const goPrev = useCallback(() => {
    if (canGoPrev) setActiveTabId(tabs[index - 1].id);
  }, [canGoPrev, index, tabs]);

  const goNext = useCallback(() => {
    if (canGoNext && !hasBlockingError) setActiveTabId(tabs[index + 1].id);
  }, [canGoNext, hasBlockingError, index, tabs]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const i = tabs.findIndex((t) => t.id === activeTabId);
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (i > 0) setActiveTabId(tabs[i - 1].id);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (i < tabs.length - 1) setActiveTabId(tabs[i + 1].id);
          break;
        case 'Home':
          e.preventDefault();
          setActiveTabId(tabs[0].id);
          break;
        case 'End':
          e.preventDefault();
          setActiveTabId(tabs[tabs.length - 1].id);
          break;
        default:
          break;
      }
    },
    [activeTabId, tabs, setActiveTabId]
  );

  return (
    <div className="section-tabs-shell">
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Assessment sections"
        className="section-tabs-tablist"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          gap: 0,
          borderBottom: '1px solid var(--cisa-gray-light)',
          marginBottom: '1rem',
          paddingBottom: 0,
        }}
        onKeyDown={handleTabKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTabId === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTabId === tab.id ? 0 : -1}
            onClick={() => setActiveTabId(tab.id as SectionTabId)}
            style={{
              flexShrink: 0,
              padding: '0.5rem 1rem',
              border: 'none',
              borderBottom: activeTabId === tab.id ? '2px solid var(--cisa-blue, #0071bc)' : '2px solid transparent',
              background: activeTabId === tab.id ? 'var(--background-alt, #f0f4f8)' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTabId === tab.id ? 600 : 400,
              fontSize: 'var(--font-size-sm, 0.875rem)',
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTabId}`}
        aria-labelledby={`tab-${activeTabId}`}
        className="section-tabs-panel"
      >
        {renderContent(activeTabId)}
      </div>

      <div className="section-tabs-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Previous section"
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNext}
            disabled={!canGoNext || hasBlockingError}
            aria-label="Next section"
          >
            Next
          </button>
        </div>
        {renderNavActions?.(activeTabId)}
      </div>
    </div>
  );
}
