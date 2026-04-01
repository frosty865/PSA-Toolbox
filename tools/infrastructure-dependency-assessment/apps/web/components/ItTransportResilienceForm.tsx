'use client';

import React from 'react';
import type {
  ItTransportResilience,
  ItCircuitCount,
  ItCarrierDiversity,
  ItBuildingEntryDiversity,
  ItUpstreamPopDiversity,
  ItPhysicalPathDiversity,
} from 'schema';
import { HelpTooltip } from './HelpTooltip';

const CIRCUIT_COUNT_OPTIONS: { value: ItCircuitCount; label: string }[] = [
  { value: 'ONE', label: 'One circuit' },
  { value: 'TWO', label: 'Two circuits' },
  { value: 'THREE_PLUS', label: 'Three or more circuits' },
];

const CARRIER_DIVERSITY_OPTIONS: { value: ItCarrierDiversity; label: string }[] = [
  { value: 'SAME_CARRIER', label: 'Same carrier' },
  { value: 'DIFFERENT_CARRIERS', label: 'Different carriers' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const BUILDING_ENTRY_OPTIONS: { value: ItBuildingEntryDiversity; label: string }[] = [
  { value: 'SAME_ENTRY', label: 'Same building entry' },
  { value: 'SEPARATE_ENTRIES', label: 'Separate building entries' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const UPSTREAM_POP_OPTIONS: { value: ItUpstreamPopDiversity; label: string }[] = [
  { value: 'SAME_POP', label: 'Same upstream POP' },
  { value: 'DIFFERENT_POPS', label: 'Different upstream POPs' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const IT_TRANSPORT_HELP = {
  circuitCount:
    'Number of internet circuits entering the facility. More circuits can improve availability only when they are independently routed and terminated.',
  carrierDiversity:
    'Whether those circuits use the same or different network providers. Different carriers reduce risk from a single-provider outage.',
  physicalPathDiversity:
    'Whether circuits follow separate physical routes. Separate conduits and separate street approaches reduce shared cable-cut risk.',
  buildingEntryDiversity:
    'Whether circuits enter the building through the same or separate entries. Separate entries reduce single-entry failure risk.',
  upstreamPopDiversity:
    'A POP (Point of Presence) is the provider handoff hub your circuit reaches upstream. Different upstream POPs reduce shared outage risk if one POP fails.',
  notes:
    'Capture evidence or assumptions (e.g., provider statements, conduit maps, demarc locations, or unknowns).',
} as const;

export interface ItTransportResilienceFormProps {
  value: ItTransportResilience | undefined;
  onChange: (next: ItTransportResilience) => void;
  /** When true, circuit_count is required (IT reliance on internet is YES). */
  requireCircuitCount?: boolean;
}

function defaultPathDiversity(): ItPhysicalPathDiversity {
  return { unknown: true };
}

export function ItTransportResilienceForm({
  value,
  onChange,
  requireCircuitCount = false,
}: ItTransportResilienceFormProps) {
  const t: Partial<ItTransportResilience> = value ?? {};
  const path = t.physical_path_diversity ?? defaultPathDiversity();

  const set = (patch: Partial<ItTransportResilience>) => {
    onChange({ ...t, ...patch } as ItTransportResilience);
  };

  const setPath = (patch: Partial<ItPhysicalPathDiversity>) => {
    const next = { ...path, ...patch };
    if (!next.same_conduit && !next.separate_conduits && !next.separate_street_approach && !next.unknown) {
      next.unknown = true;
    }
    set({ physical_path_diversity: next });
  };

  return (
    <section className="card p-4 mb-4" aria-labelledby="it-transport-resilience-heading">
      <h3 id="it-transport-resilience-heading" className="text-lg font-semibold mb-3">
        Internet Transport Resilience
      </h3>
      <p className="text-secondary text-sm mb-4">
        Last-mile transport survivability (circuits, path, entry). Hosted/cloud resilience is captured separately and does not mitigate last-mile loss.
      </p>

      <div className="form-group mb-3">
        <div className="d-flex align-items-center gap-1">
          <label className="form-label mb-0">Circuit count</label>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.circuitCount} />
          {requireCircuitCount && <span className="text-danger ms-1" aria-hidden>*</span>}
        </div>
        <div className="radio-group">
          {CIRCUIT_COUNT_OPTIONS.map(({ value: v, label }) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="it_transport_circuit_count"
                value={v}
                checked={t.circuit_count === v}
                onChange={() => set({ circuit_count: v })}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group mb-3">
        <div className="d-flex align-items-center gap-1">
          <label className="form-label mb-0">Carrier diversity</label>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.carrierDiversity} />
        </div>
        <div className="radio-group">
          {CARRIER_DIVERSITY_OPTIONS.map(({ value: v, label }) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="it_transport_carrier_diversity"
                value={v}
                checked={t.carrier_diversity === v}
                onChange={() => set({ carrier_diversity: v })}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group mb-3">
        <div className="d-flex align-items-center gap-1">
          <span className="form-label d-block mb-0">Physical path diversity</span>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.physicalPathDiversity} />
        </div>
        <p className="text-secondary small mb-2">Select all that apply; at least one required.</p>
        <div className="checkbox-group">
          <div className="checkbox-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={path.same_conduit === true}
                onChange={(e) => setPath({ same_conduit: e.target.checked })}
                aria-label="Same conduit"
              />
              <span>Same conduit</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={path.separate_conduits === true}
                onChange={(e) => setPath({ separate_conduits: e.target.checked })}
                aria-label="Separate conduits"
              />
              <span>Separate conduits</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={path.separate_street_approach === true}
                onChange={(e) => setPath({ separate_street_approach: e.target.checked })}
                aria-label="Separate street approach"
              />
              <span>Separate street approach</span>
            </label>
          </div>
          <div className="checkbox-item">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={path.unknown === true}
                onChange={(e) => setPath({ unknown: e.target.checked })}
                aria-label="Unknown"
              />
              <span>Unknown</span>
            </label>
          </div>
        </div>
      </div>

      <div className="form-group mb-3">
        <div className="d-flex align-items-center gap-1">
          <label className="form-label mb-0">Building entry diversity</label>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.buildingEntryDiversity} />
        </div>
        <div className="radio-group">
          {BUILDING_ENTRY_OPTIONS.map(({ value: v, label }) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="it_transport_building_entry"
                value={v}
                checked={t.building_entry_diversity === v}
                onChange={() => set({ building_entry_diversity: v })}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group mb-3">
        <div className="d-flex align-items-center gap-1">
          <label className="form-label mb-0">Upstream POP diversity</label>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.upstreamPopDiversity} />
        </div>
        <div className="radio-group">
          {UPSTREAM_POP_OPTIONS.map(({ value: v, label }) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="it_transport_upstream_pop"
                value={v}
                checked={t.upstream_pop_diversity === v}
                onChange={() => set({ upstream_pop_diversity: v })}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <div className="d-flex align-items-center gap-1">
          <label className="form-label mb-0" htmlFor="it-transport-notes">Notes (optional)</label>
          <HelpTooltip helpText={IT_TRANSPORT_HELP.notes} />
        </div>
        <textarea
          id="it-transport-notes"
          className="form-control"
          rows={2}
          value={t.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value || undefined })}
          placeholder="Additional details about transport resilience"
        />
      </div>
    </section>
  );
}

/** Derive single-path exposure from it_transport_resilience. True when one circuit and no strong diversity. Failover removed from model. */
export function isSinglePathTransportExposure(transport: ItTransportResilience | undefined): boolean {
  if (!transport?.circuit_count) return true;
  if (transport.circuit_count !== 'ONE') return false;
  const path = transport.physical_path_diversity;
  const strongPath = path?.separate_conduits === true || path?.separate_street_approach === true;
  const strongCarrier = transport.carrier_diversity === 'DIFFERENT_CARRIERS';
  const strongEntry = transport.building_entry_diversity === 'SEPARATE_ENTRIES';
  const strongPop = transport.upstream_pop_diversity === 'DIFFERENT_POPS';
  if (strongPath || strongCarrier || strongEntry || strongPop) return false;
  return true;
}
