'use client';

import React, { useEffect, useRef } from 'react';
import type { CategoryCode } from 'schema';
import type { Supply, SupplySource, SupplyIndependence } from 'schema';
import { NumericInput } from '@/components/ui/NumericInput';

const INDEPENDENCE_OPTIONS: { value: SupplyIndependence; label: string }[] = [
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'SAME_DEMARCATION', label: 'Same demarcation point (single point of failure)' },
  { value: 'DIFFERENT_DEMARCATION_SAME_UPSTREAM', label: 'Different demarcation, same upstream (partial resilience)' },
  { value: 'DIFFERENT_LOOP_OR_PATH', label: 'Different loop/path (resilient)' },
];

/** When has_alternate_source is true, non-IT categories must set independence (not UNKNOWN). IT allows UNKNOWN. */
const INDEPENDENCE_OPTIONS_WHEN_ALTERNATE: { value: Exclude<SupplyIndependence, 'UNKNOWN'>; label: string }[] =
  INDEPENDENCE_OPTIONS.filter((o) => o.value !== 'UNKNOWN') as { value: Exclude<SupplyIndependence, 'UNKNOWN'>; label: string }[];

function defaultSource(): SupplySource {
  return {
    source_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    provider_name: null,
    source_label: null,
    demarcation_lat: null,
    demarcation_lon: null,
    demarcation_description: null,
    independence: 'UNKNOWN',
    notes: null,
  };
}

function defaultSupply(): Supply {
  return { has_alternate_source: false, sources: [defaultSource()] };
}

export interface SupplySourcesEditorProps {
  categoryCode: CategoryCode;
  value: Supply | undefined;
  onChange: (supply: Supply) => void;
}

export function SupplySourcesEditor({ categoryCode, value, onChange }: SupplySourcesEditorProps) {
  const supply = value ?? defaultSupply();
  const { has_alternate_source, sources } = supply;
  const firstIndependenceSelectRef = useRef<HTMLSelectElement>(null);
  const prevAlternateRef = useRef(has_alternate_source);

  const requireIndependenceWhenAlternate = has_alternate_source && categoryCode !== 'INFORMATION_TECHNOLOGY';
  const independenceOptions = requireIndependenceWhenAlternate ? INDEPENDENCE_OPTIONS_WHEN_ALTERNATE : INDEPENDENCE_OPTIONS;
  const hasIndependenceError =
    requireIndependenceWhenAlternate && sources.some((src) => src.independence === 'UNKNOWN');

  useEffect(() => {
    if (has_alternate_source && !prevAlternateRef.current) {
      prevAlternateRef.current = true;
      firstIndependenceSelectRef.current?.focus();
    } else if (!has_alternate_source) {
      prevAlternateRef.current = false;
    }
  }, [has_alternate_source]);

  const setSupply = (patch: Partial<Supply>) => {
    onChange({ ...supply, ...patch });
  };

  const setSources = (next: SupplySource[]) => {
    setSupply({ sources: next });
  };

  const handleAlternateChange = (yes: boolean) => {
    if (yes) {
      const need = Math.max(2, sources.length);
      const next = sources.slice(0, need);
      while (next.length < need) next.push(defaultSource());
      onChange({ has_alternate_source: true, sources: next });
    } else {
      const one = sources[0] ? { ...sources[0], independence: 'UNKNOWN' as const } : defaultSource();
      onChange({ has_alternate_source: false, sources: [one] });
    }
  };

  const updateSource = (index: number, patch: Partial<SupplySource>) => {
    const next = sources.slice();
    next[index] = { ...(next[index] ?? defaultSource()), ...patch };
    setSources(next);
  };

  const addSource = () => {
    setSources([...sources, defaultSource()]);
  };

  const removeSource = (index: number) => {
    if (sources.length <= 2) return;
    setSources(sources.filter((_, i) => i !== index));
  };

  const baseId = `supply-${categoryCode}`;

  return (
    <div className="form-section" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <div className="form-group">
        <label className="form-label">Is there an alternate source/feed for this service?</label>
        <div className="radio-group">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${baseId}-alternate`}
              checked={!has_alternate_source}
              onChange={() => handleAlternateChange(false)}
            />
            No
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${baseId}-alternate`}
              checked={has_alternate_source}
              onChange={() => handleAlternateChange(true)}
            />
            Yes
          </label>
        </div>
      </div>

      {!has_alternate_source ? (
        <div className="card" style={{ padding: '1rem', marginTop: '0.5rem' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Source 1</h4>
          <div className="form-group">
            <label className="form-label" htmlFor={`${baseId}-p0`}>Provider name</label>
            <input
              id={`${baseId}-p0`}
              type="text"
              className="form-control"
              value={sources[0]?.provider_name ?? ''}
              onChange={(e) => updateSource(0, { provider_name: e.target.value || null })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${baseId}-d0`}>Demarcation description</label>
            <input
              id={`${baseId}-d0`}
              type="text"
              className="form-control"
              value={sources[0]?.demarcation_description ?? ''}
              onChange={(e) => updateSource(0, { demarcation_description: e.target.value || null })}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 8rem' }}>
              <label className="form-label" htmlFor={`${baseId}-lat0`}>Latitude</label>
              <NumericInput
                id={`${baseId}-lat0`}
                value={sources[0]?.demarcation_lat ?? null}
                onValueChange={(n) => updateSource(0, { demarcation_lat: n })}
                integer={false}
                allowEmpty
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 8rem' }}>
              <label className="form-label" htmlFor={`${baseId}-lon0`}>Longitude</label>
              <NumericInput
                id={`${baseId}-lon0`}
                value={sources[0]?.demarcation_lon ?? null}
                onValueChange={(n) => updateSource(0, { demarcation_lon: n })}
                integer={false}
                allowEmpty
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor={`${baseId}-n0`}>Notes</label>
            <input
              id={`${baseId}-n0`}
              type="text"
              className="form-control"
              value={sources[0]?.notes ?? ''}
              onChange={(e) => updateSource(0, { notes: e.target.value || null })}
            />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Minimum 2 sources. Add source to describe each feed.</p>
          {hasIndependenceError && (
            <p
              id={`${baseId}-independence-error`}
              className="form-error"
              role="alert"
              style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-error, #c00)' }}
            >
              Independence must be set when an alternate source is selected.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider name *</th>
                  <th>Source label</th>
                  <th>Demarcation (lat/lon)</th>
                  <th>Demarcation description</th>
                  <th>Independence</th>
                  <th>Notes</th>
                  <th aria-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src, i) => (
                  <tr key={src.source_id}>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={src.provider_name ?? ''}
                        onChange={(e) => updateSource(i, { provider_name: e.target.value || null })}
                        aria-required="true"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={src.source_label ?? ''}
                        onChange={(e) => updateSource(i, { source_label: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <span style={{ display: 'flex', gap: '0.25rem' }}>
                        <NumericInput
                          value={src.demarcation_lat ?? null}
                          onValueChange={(n) => updateSource(i, { demarcation_lat: n })}
                          integer={false}
                          allowEmpty
                          placeholder="Lat"
                          className="form-control"
                          style={{ width: '5rem' }}
                        />
                        <NumericInput
                          value={src.demarcation_lon ?? null}
                          onValueChange={(n) => updateSource(i, { demarcation_lon: n })}
                          integer={false}
                          allowEmpty
                          placeholder="Lon"
                          className="form-control"
                          style={{ width: '5rem' }}
                        />
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={src.demarcation_description ?? ''}
                        onChange={(e) => updateSource(i, { demarcation_description: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <select
                        ref={i === 0 ? firstIndependenceSelectRef : undefined}
                        className="form-control"
                        value={requireIndependenceWhenAlternate && src.independence === 'UNKNOWN' ? '' : src.independence}
                        onChange={(e) => {
                          const v = e.target.value as SupplySource['independence'];
                          if (v) updateSource(i, { independence: v });
                        }}
                        aria-invalid={requireIndependenceWhenAlternate && src.independence === 'UNKNOWN'}
                        aria-describedby={requireIndependenceWhenAlternate && src.independence === 'UNKNOWN' ? `${baseId}-independence-error` : undefined}
                      >
                        {requireIndependenceWhenAlternate && (
                          <option value="" disabled>
                            Select independence...
                          </option>
                        )}
                        {independenceOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={src.notes ?? ''}
                        onChange={(e) => updateSource(i, { notes: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ida-btn ida-btn-secondary ida-btn-sm"
                        onClick={() => removeSource(i)}
                        disabled={sources.length <= 2}
                        aria-label="Remove source"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="ida-btn ida-btn-secondary mt-2" onClick={addSource}>
            Add source
          </button>
        </div>
      )}
    </div>
  );
}
