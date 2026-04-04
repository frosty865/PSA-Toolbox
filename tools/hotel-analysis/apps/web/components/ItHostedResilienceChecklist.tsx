'use client';

import React from 'react';
import type { ItHostedResilience, ItHostedResilienceEntry, HostedContinuitySurvivability } from 'schema';
import { migrateHostedResilienceEntry } from '@/app/lib/report/it/hosted_resilience_migration';
import { HelpTooltip } from '@/components/HelpTooltip';

const SURVIVABILITY_OPTIONS: { value: HostedContinuitySurvivability; label: string }[] = [
  { value: 'NO_CONTINUITY', label: 'No continuity — key functions stop.' },
  { value: 'LOCAL_MIRROR_OR_CACHE', label: 'Local mirror / offline copy allows limited operation.' },
  { value: 'ALTERNATE_PLATFORM_OR_PROVIDER', label: 'Alternate provider/platform/workflow already established.' },
  { value: 'UNKNOWN', label: 'Unknown.' },
];

const HOSTED_CONTINUITY_HELP =
  'Scenario: internet connectivity to the facility is lost and externally hosted services become unreachable. Choose how operations would continue: no continuity (key functions stop), local mirror/offline copy (limited operation), or alternate provider/platform already established. ISP and circuit redundancy are evaluated in the Communications module, not here.';

export interface DependencyRow {
  id: string;
  label: string;
}

export interface ItHostedResilienceChecklistProps {
  dependencies: DependencyRow[];
  value: ItHostedResilience | undefined;
  onChange: (next: ItHostedResilience) => void;
}

export function ItHostedResilienceChecklist({
  dependencies,
  value,
  onChange,
}: ItHostedResilienceChecklistProps) {
  const map = value ?? {};

  const setEntry = (dependencyId: string, patch: Partial<ItHostedResilienceEntry>) => {
    const prev = map[dependencyId] ?? {};
    const migrated = migrateHostedResilienceEntry(prev);
    onChange({ ...map, [dependencyId]: { ...migrated, ...patch } });
  };

  const setSurvivability = (dependencyId: string, survivability: HostedContinuitySurvivability) => {
    setEntry(dependencyId, { survivability });
  };

  const CONTINUITY_TITLE = 'If internet connectivity to the facility is lost and externally hosted services become unreachable, how would operations continue?';

  if (dependencies.length === 0) {
    return (
      <section className="card p-4 mb-4" aria-labelledby="it-hosted-continuity-heading">
        <h3 id="it-hosted-continuity-heading" className="text-lg font-semibold mb-3">
          {CONTINUITY_TITLE}
        </h3>
        <p className="text-secondary">
          Add hosted services (IT-2) above; then for each one, select how operations would continue if internet connectivity is lost and the hosted service cannot be reached. ISP and circuit redundancy are assessed in the Communications module.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4 mb-4" aria-labelledby="it-hosted-continuity-heading">
      <div className="flex items-center gap-2 mb-3">
        <h3 id="it-hosted-continuity-heading" className="text-lg font-semibold mb-0">
          {CONTINUITY_TITLE}
        </h3>
        <HelpTooltip helpText={HOSTED_CONTINUITY_HELP} />
      </div>
      <p className="text-secondary text-sm mb-4">
        For each hosted dependency: if internet connectivity is lost and the hosted service cannot be reached, how would operations continue? ISP and circuit redundancy are evaluated in the Communications module.
      </p>
      <div className="space-y-4">
        {dependencies.map(({ id, label }) => {
          const raw = map[id] ?? {};
          const entry = migrateHostedResilienceEntry(raw);
          const survivability = entry.survivability;
          return (
            <div key={id} className="border rounded p-3">
              <h4 className="font-medium mb-2">{label}</h4>

              <p className="text-sm font-medium mb-1">Continuity</p>
              <div className="radio-group-vertical mb-3">
                {SURVIVABILITY_OPTIONS.map(({ value: v, label: l }) => (
                  <div key={v} className="radio-option-item mb-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`${id}-survivability`}
                        checked={survivability === v}
                        onChange={() => setSurvivability(id, v)}
                        aria-label={`${label}: ${l}`}
                        className="mt-1"
                      />
                      <span className="font-medium">{l}</span>
                    </label>
                  </div>
                ))}
              </div>

              <div>
                <label className="form-label text-sm">Notes (optional)</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={(typeof raw === 'object' && raw !== null && 'notes' in raw ? (raw as { notes?: string }).notes : undefined) ?? entry.notes ?? ''}
                  onChange={(e) => setEntry(id, { notes: e.target.value || undefined })}
                  placeholder="Notes for this dependency"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
