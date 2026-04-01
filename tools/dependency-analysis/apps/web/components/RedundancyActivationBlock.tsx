'use client';

import React from 'react';

/** Mirrors schema RedundancyInitiationMode (avoid build dependency on schema export). */
export type RedundancyInitiationMode = 'AUTOMATIC' | 'MANUAL_ONSITE' | 'MANUAL_REMOTE' | 'VENDOR_REQUIRED' | 'UNKNOWN';

/** Mirrors schema RedundancyActivation (avoid build dependency on schema export). */
export type RedundancyActivation = {
  mode: RedundancyInitiationMode;
  activation_delay_min?: number | null;
  requires_trained_personnel?: boolean | null;
  trained_personnel_24_7?: boolean | null;
  remote_initiation_available?: boolean | null;
  vendor_dispatch_required?: boolean | null;
  documented_and_tested?: boolean | null;
};

const INITIATION_OPTIONS: { value: RedundancyInitiationMode; label: string }[] = [
  { value: 'AUTOMATIC', label: 'Automatic (self-correcting / no human action required)' },
  { value: 'MANUAL_ONSITE', label: 'Manual – On-site personnel' },
  { value: 'MANUAL_REMOTE', label: 'Manual – Remote initiation available' },
  { value: 'VENDOR_REQUIRED', label: 'Vendor initiation required' },
  { value: 'UNKNOWN', label: 'Unknown / not documented' },
];

const MANUAL_OR_VENDOR: RedundancyInitiationMode[] = ['MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED'];

export type RedundancyActivationBlockProps = {
  value: RedundancyActivation | undefined;
  onChange: (next: RedundancyActivation) => void;
  /** Label for "alternate capability" vs "redundant circuit" etc. */
  capabilityLabel?: string;
  /** Min/max activation delay (minutes) for this sector */
  activationDelayMin?: number;
  activationDelayMax?: number;
  /** Help text for activation delay (sector-specific) */
  activationDelayHelp?: string;
  /** Optional question index for "Question N of M" */
  questionIndex?: number;
  totalCount?: number;
};

export function RedundancyActivationBlock({
  value,
  onChange,
  capabilityLabel = 'alternate capability',
  activationDelayMin = 0,
  activationDelayMax = 1440,
  activationDelayHelp,
  questionIndex,
  totalCount,
}: RedundancyActivationBlockProps) {
  const ra = value ?? { mode: 'UNKNOWN', activation_delay_min: null };
  const mode = ra.mode ?? 'UNKNOWN';
  const showTrainedPersonnel = MANUAL_OR_VENDOR.includes(mode);
  const show24_7 = showTrainedPersonnel && ra.requires_trained_personnel === true;

  const update = (patch: Partial<RedundancyActivation>) => {
    onChange({ ...ra, ...patch } as RedundancyActivation);
  };

  return (
    <div className="redundancy-activation-block" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--cisa-blue-lightest, #f0f7ff)', borderRadius: 'var(--border-radius)', border: '1px solid var(--cisa-gray-light, #ddd)' }}>
      <h4 style={{ fontSize: '1em', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
        How is {capabilityLabel} initiated?
      </h4>

      {/* Q1: Initiation mode */}
      <div style={{ marginBottom: '1rem' }}>
        <label className="block text-sm font-medium mb-1">Initiation method</label>
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as RedundancyInitiationMode;
            const patch: Partial<RedundancyActivation> = { mode: m };
            if (m === 'AUTOMATIC') {
              patch.requires_trained_personnel = false;
              patch.activation_delay_min = Math.min(ra.activation_delay_min ?? 0, 60);
            } else if (MANUAL_OR_VENDOR.includes(m)) {
              patch.requires_trained_personnel = true;
            }
            update(patch);
          }}
          className="form-control w-full max-w-md"
          aria-label="How is alternate capability initiated"
        >
          {INITIATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Q2: Activation delay (minutes) */}
      <div style={{ marginBottom: '1rem' }}>
        <label className="block text-sm font-medium mb-1">
          Activation delay (minutes) — time until {capabilityLabel} is fully effective
        </label>
        <input
          type="number"
          min={activationDelayMin}
          max={activationDelayMax}
          className="form-control w-32"
          value={ra.activation_delay_min ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Math.min(activationDelayMax, Math.max(activationDelayMin, Number(e.target.value) || 0));
            update({ activation_delay_min: v });
          }}
          placeholder={`${activationDelayMin}–${activationDelayMax}`}
          aria-label="Activation delay in minutes"
        />
        {activationDelayHelp && (
          <p className="text-sm text-secondary mt-1">{activationDelayHelp}</p>
        )}
      </div>

      {/* Q3: Requires trained personnel (conditional) */}
      {showTrainedPersonnel && (
        <div style={{ marginBottom: '1rem' }}>
          <label className="block text-sm font-medium mb-1">
            Does initiation require trained personnel to perform or supervise the switch?
          </label>
          <div className="radio-group-vertical">
            <div className="radio-option-item">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="requires_trained"
                  checked={ra.requires_trained_personnel === true}
                  onChange={() => update({ requires_trained_personnel: true })}
                />
                <span>Yes</span>
              </label>
            </div>
            <div className="radio-option-item">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="requires_trained"
                  checked={ra.requires_trained_personnel === false}
                  onChange={() => update({ requires_trained_personnel: false, trained_personnel_24_7: null })}
                />
                <span>No</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Q4: Trained personnel 24/7 (conditional) */}
      {show24_7 && (
        <div style={{ marginBottom: '1rem' }}>
          <label className="block text-sm font-medium mb-1">
            Is trained personnel available 24/7 to initiate the {capabilityLabel}?
          </label>
          <div className="radio-group-vertical">
            <div className="radio-option-item">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trained_24_7"
                  checked={ra.trained_personnel_24_7 === true}
                  onChange={() => update({ trained_personnel_24_7: true })}
                />
                <span>Yes</span>
              </label>
            </div>
            <div className="radio-option-item">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trained_24_7"
                  checked={ra.trained_personnel_24_7 === false}
                  onChange={() => update({ trained_personnel_24_7: false })}
                />
                <span>No</span>
              </label>
            </div>
          </div>
          {ra.trained_personnel_24_7 === false && (
            <p className="text-sm text-amber-700 mt-1">
              After-hours activation delays can create immediate impact even when an alternate exists.
            </p>
          )}
        </div>
      )}

      {/* Q5: Documented and tested */}
      <div style={{ marginBottom: 0 }}>
        <label className="block text-sm font-medium mb-1">
          Is this process documented and tested (tabletop or live test) at least annually?
        </label>
        <div className="radio-group-vertical">
          <div className="radio-option-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="documented_tested"
                checked={ra.documented_and_tested === true}
                onChange={() => update({ documented_and_tested: true })}
              />
              <span>Yes</span>
            </label>
          </div>
          <div className="radio-option-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="documented_tested"
                checked={ra.documented_and_tested === false}
                onChange={() => update({ documented_and_tested: false })}
              />
              <span>No</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
