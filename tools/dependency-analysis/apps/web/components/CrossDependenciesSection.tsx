'use client';

import React from 'react';
import type { CrossDependency } from 'schema';

const CATEGORY_OPTIONS = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

const DEPENDENCY_TYPES = ['primary_operations', 'backup_systems', 'monitoring_control'] as const;

export type CrossDependenciesSectionProps = {
  cross_dependencies: CrossDependency[];
  onUpdate: (next: CrossDependency[]) => void;
};

export function CrossDependenciesSection({ cross_dependencies = [], onUpdate }: CrossDependenciesSectionProps) {
  const add = () => {
    onUpdate([
      ...cross_dependencies,
      { to_category: 'ELECTRIC_POWER', description: '', time_to_cascade_hours: null },
    ]);
  };

  const update = (index: number, patch: Partial<CrossDependency>) => {
    const next = [...cross_dependencies];
    next[index] = { ...next[index], ...patch };
    onUpdate(next);
  };

  const remove = (index: number) => {
    onUpdate(cross_dependencies.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-4 p-3 border rounded" style={{ borderColor: 'var(--cisa-gray-light)' }}>
      <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>Cross-dependencies (optional)</h3>
      <p className="text-secondary mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
        Facility-reported interdependencies that could lead to cascading failure. Not a hazard model.
      </p>
      {cross_dependencies.map((entry, i) => (
        <div key={i} className="mb-3 p-2 border rounded">
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>From category</label>
              <select
                className="form-control form-control-sm"
                value={entry.from_category ?? ''}
                onChange={(e) => update(i, { from_category: e.target.value || undefined })}
              >
                <option value="">—</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>To category</label>
              <select
                className="form-control form-control-sm"
                value={entry.to_category}
                onChange={(e) => update(i, { to_category: e.target.value as CrossDependency['to_category'] })}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label" style={{ fontSize: 'var(--font-size-sm)' }}>Type</label>
              <select
                className="form-control form-control-sm"
                value={entry.dependency_type ?? ''}
                onChange={(e) =>
                  update(i, {
                    dependency_type: (e.target.value as CrossDependency['dependency_type']) || undefined,
                  })
                }
              >
                <option value="">—</option>
                {DEPENDENCY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Time to cascade (hrs)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={0}
                max={168}
                value={entry.time_to_cascade_hours ?? ''}
                onChange={(e) =>
                  update(i, { time_to_cascade_hours: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => remove(i)}>
                Remove
              </button>
            </div>
          </div>
          <div className="mt-2">
            <label className="form-label small">Description</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Short description"
              value={entry.description ?? ''}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={add}>
        Add cross-dependency
      </button>
    </div>
  );
}
