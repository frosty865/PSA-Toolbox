'use client';

import React from 'react';
import {
  UI_CONFIG,
  getFieldHelp,
  AGREEMENTS_LABELS,
  PRA_CATEGORY_OPTIONS,
} from 'schema';
import type { CategoryCode, CriticalProductRow, Supply, SupplySource, ItTransportResilience, ItHostedResilience } from 'schema';
import type { PraCategory, UIFieldConfig } from 'schema';
import { HelpIcon } from 'ui';
import { normalizeAgreements, DEFAULT_AGREEMENTS_STATE, type AgreementsState } from '@/lib/agreements';
import { NumericInput } from '@/components/ui/NumericInput';
import { SupplySourcesEditor } from './SupplySourcesEditor';
import { ItTransportResilienceForm } from './ItTransportResilienceForm';
import { ItHostedResilienceChecklist, type DependencyRow } from './ItHostedResilienceChecklist';
import { getDigitalServiceOption } from '@/app/lib/catalog/digital_services_catalog';
import { isDependencyExcludedFromHostedResilience } from '@/app/lib/report/it/hosted_service_registry';
import { PriorityRestorationHelpButton } from './asset-dependency/PriorityRestorationHelpButton';
import { isPriorityRestorationSectionCompleted, type DependencyTopicKey, type PriorityRestoration, type PriorityRestorationTopic } from '@/app/lib/asset-dependency/priorityRestorationSchema';

function newSourceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultSupplySource(providerName: string | null): SupplySource {
  return {
    source_id: newSourceId(),
    provider_name: providerName ?? null,
    source_label: null,
    demarcation_lat: null,
    demarcation_lon: null,
    demarcation_description: null,
    independence: 'UNKNOWN',
    notes: null,
  };
}

/** IT-only: Primary and Secondary ISP inputs. Writes to supply.sources (authoritative for report). */
function ItSupplyIspBlock({ supply, onUpdate }: { supply: Supply | undefined; onUpdate: (s: Supply) => void }) {
  const sources = supply?.sources ?? [];
  const primary = (sources[0]?.provider_name ?? '').trim();
  const secondary = (sources[1]?.provider_name ?? '').trim();

  const setPrimary = (value: string) => {
    const name = value.trim() || null;
    const s0 = sources[0] ? { ...sources[0], provider_name: name } : defaultSupplySource(name);
    onUpdate({ has_alternate_source: secondary.length > 0, sources: secondary ? [s0, sources[1] ?? defaultSupplySource(secondary)] : [s0] });
  };
  const setSecondary = (value: string) => {
    const name = value.trim();
    if (!name) {
      onUpdate({ has_alternate_source: false, sources: sources[0] ? [sources[0]] : [defaultSupplySource(primary || null)] });
      return;
    }
    const s0 = sources[0] ?? defaultSupplySource(primary || null);
    const s1 = sources[1] ? { ...sources[1], provider_name: name } : defaultSupplySource(name);
    onUpdate({ has_alternate_source: true, sources: [s0, s1] });
  };

  return (
    <section className="card p-4 mb-4" aria-labelledby="it-isp-heading">
      <h3 id="it-isp-heading" className="text-lg font-semibold mb-3">
        Internet Service Providers (Transport)
      </h3>
      <p className="text-secondary text-sm mb-3">
        Primary and secondary ISP or data connectivity providers. Report lists one row per provider.
      </p>
      <div className="form-group mb-2">
        <label className="form-label" htmlFor="it-isp-primary">Primary ISP</label>
        <input
          id="it-isp-primary"
          type="text"
          className="form-control"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          placeholder="e.g. Comcast"
          aria-label="Primary internet service provider"
        />
      </div>
      <div className="form-group mb-0">
        <label className="form-label" htmlFor="it-isp-secondary">Secondary ISP (optional)</label>
        <input
          id="it-isp-secondary"
          type="text"
          className="form-control"
          value={secondary}
          onChange={(e) => setSecondary(e.target.value)}
          placeholder="e.g. Xfinity or second carrier"
          aria-label="Secondary internet service provider"
        />
      </div>
    </section>
  );
}

/**
 * Build dependency rows for the Hosted Services continuity block only.
 * Includes ONLY IT-2 upstream assets (externally hosted applications/SaaS). Excludes TRANSPORT_ISP kind.
 * IT-1 providers (MSP/ISP) are NOT included — continuity questions apply to hosted apps, not network providers.
 * ISPs remain in categories.INFORMATION_TECHNOLOGY.supply.sources and do not appear here.
 */
function buildItDependencyRows(data: Record<string, unknown>): DependencyRow[] {
  const rows: DependencyRow[] = [];
  const upstream = (data['IT-2_upstream_assets'] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const u of upstream) {
    const serviceId = String(u.service_id ?? '').trim();
    const serviceOther = String(u.service_other ?? '').trim();
    if (!serviceId) continue;
    const id = serviceId === 'other' ? `other_${serviceOther || 'other'}` : serviceId;
    const label =
      serviceId === 'other' ? (serviceOther || 'Other') : (getDigitalServiceOption(serviceId)?.label ?? serviceId);
    if (isDependencyExcludedFromHostedResilience(id, label, serviceId)) continue;
    rows.push({ id, label });
  }
  return rows;
}

function isKeyLikeLabel(label: string | undefined, fieldKey: string): boolean {
  const t = String(label ?? '').trim();
  return t === fieldKey || (t.length > 0 && /^[a-z0-9_]+$/i.test(t));
}

function resolveLabel(category: CategoryCode, field: UIFieldConfig): string {
  const label = field.label;
  if (label != null && String(label).trim() !== '' && !isKeyLikeLabel(String(label), field.key)) {
    return String(label).trim();
  }
  if (process.env.NODE_ENV === 'development') {
    if (label == null || String(label).trim() === '') {
      throw new Error(
        `Missing field.label for ${category}.${field.key} — labels must come from XLSM extraction.`
      );
    }
    if (isKeyLikeLabel(String(label), field.key)) {
      console.warn(
        `Invalid label for ${category}.${field.key}: appears to be a key, not workbook text. Update Asset Dependency Visualization.xlsm and re-run scripts/extract_xlsm_ui_config.ts.`
      );
    }
  }
  return field.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldLabel({
  id,
  category,
  field,
  showHelp,
}: {
  id: string;
  category: CategoryCode;
  field: UIFieldConfig;
  showHelp: boolean;
}) {
  const label = resolveLabel(category, field);
  const resolved = getFieldHelp(category, field.key, field.help, field.examples);
  const hasHelp = resolved.help != null && resolved.help.trim() !== '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="form-label" htmlFor={id}>{label}</label>
        {showHelp && hasHelp && (
          <HelpIcon help={resolved.help!} examples={resolved.examples} id={`${id}-help`} />
        )}
      </span>
      {process.env.NODE_ENV === 'development' && field.label_source && (
        <small style={{ fontSize: '0.75rem', color: '#6c757d' }}>
          Source: {field.label_source.sheet} {field.label_source.cell}
        </small>
      )}
    </span>
  );
}

function FieldInput({
  field,
  category,
  value,
  onChange,
  disabled,
  showHelp,
}: {
  field: UIFieldConfig;
  category: CategoryCode;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  showHelp: boolean;
}) {
  const id = `field-${category}-${field.key}`;
  const resolvedLabel = resolveLabel(category, field);
  const resolved = getFieldHelp(category, field.key, field.help, field.examples);
  const hasHelp = resolved.help != null && resolved.help.trim() !== '';
  const labelBlock = (
    <FieldLabel id={id} category={category} field={field} showHelp={showHelp} />
  );
  if (field.type === 'boolean') {
    const checked = value === true;
    return (
      <div className="checkbox-item">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <label htmlFor={id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {resolvedLabel}
            {showHelp && hasHelp && (
              <HelpIcon help={resolved.help!} examples={resolved.examples} id={`${id}-help`} />
            )}
          </label>
          {process.env.NODE_ENV === 'development' && field.label_source && (
            <small style={{ fontSize: '0.75rem', color: '#6c757d' }}>
              Source: {field.label_source.sheet} {field.label_source.cell}
            </small>
          )}
        </span>
      </div>
    );
  }
  if (field.type === 'number') {
    const isPercentField =
      field.displayAs === 'percent' ||
      (field.displayAs == null && (field.key.includes('loss_fraction') || field.key.includes('percent')));
    if (isPercentField) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`Percent input not allowed outside curve section: ${category}.${field.key}`);
      }
      return null;
    }
    const rawNum = value === null || value === undefined ? null : Number(value);
    const storedNum = rawNum != null && Number.isFinite(rawNum) ? rawNum : null;
    const inputMin = field.min as number | undefined;
    const inputMax = field.max as number | undefined;
    const unitLabel = field.unit;

    return (
      <div className="form-group">
        {labelBlock}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <NumericInput
            id={id}
            value={storedNum}
            onValueChange={(n) => {
              onChange(n);
            }}
            integer
            min={inputMin}
            max={inputMax}
            allowEmpty
            disabled={disabled}
            className="form-control"
          />
          {unitLabel && (
            <span className="text-secondary" style={{ fontSize: '0.875rem' }}>{unitLabel}</span>
          )}
        </span>
      </div>
    );
  }
  if (field.type === 'text') {
    return (
      <div className="form-group">
        {labelBlock}
        <input
          id={id}
          type="text"
          className="form-control"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      </div>
    );
  }
  return null;
}

const DEFAULT_CRITICAL_PRODUCT_ROW: CriticalProductRow = {
  product_or_service: '',
  dependency_present: false,
  notes: null,
  single_source: null,
  alternate_supplier_identified: null,
  alternate_supplier_name: null,
  multi_source_currently_used: null,
};

function CriticalProductsTable({
  category,
  table,
  rows,
  onRowsChange,
  maxRows,
}: {
  category: CategoryCode;
  table: { columns: Array<{ key: string; label: string; label_source?: { sheet: string; cell: string }; type: 'text' | 'boolean' }>; maxRows: number };
  rows: CriticalProductRow[];
  onRowsChange: (rows: CriticalProductRow[]) => void;
  maxRows: number;
}) {
  const updateRow = (index: number, key: keyof CriticalProductRow, value: string | boolean | null) => {
    const next = rows.slice();
    const row = { ...(next[index] ?? DEFAULT_CRITICAL_PRODUCT_ROW), [key]: value };
    if (key === 'alternate_supplier_identified' && value === false) {
      (row as Record<string, unknown>).alternate_supplier_name = null;
    }
    next[index] = row as CriticalProductRow;
    onRowsChange(next);
  };
  const addRow = () => {
    if (rows.length >= maxRows) return;
    onRowsChange([...rows, { ...DEFAULT_CRITICAL_PRODUCT_ROW }]);
  };
  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="form-section">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {table.columns.map((col) => (
                <th key={col.key}>
                  {col.label}
                  {process.env.NODE_ENV === 'development' && col.label_source && (
                    <small style={{ display: 'block', fontSize: '0.7rem', color: '#6c757d' }}>
                      {col.label_source.sheet} {col.label_source.cell}
                    </small>
                  )}
                </th>
              ))}
              <th aria-label="Row actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {table.columns.map((col) => {
                  const rowRecord = row as Record<string, unknown>;
                  const isAlternateName = col.key === 'alternate_supplier_name';
                  const showAlternateName = isAlternateName && rowRecord.alternate_supplier_identified === true;
                  return (
                    <td key={col.key}>
                      {isAlternateName && !showAlternateName ? (
                        <span className="text-secondary">—</span>
                      ) : col.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={rowRecord[col.key] === true}
                          onChange={(e) => updateRow(i, col.key as keyof CriticalProductRow, e.target.checked)}
                          aria-label={col.label}
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          value={String(rowRecord[col.key] ?? '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(i, col.key as keyof CriticalProductRow, col.key === 'notes' ? (v || null) : v);
                          }}
                          aria-label={col.label}
                        />
                      )}
                    </td>
                  );
                })}
                <td>
                  <button
                    type="button"
                    className="ida-btn ida-btn-secondary ida-btn-sm"
                    onClick={() => removeRow(i)}
                    aria-label="Remove row"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length < maxRows && (
        <button type="button" className="ida-btn ida-btn-secondary mt-2" onClick={addRow}>
          Add row
        </button>
      )}
    </div>
  );
}

function AgreementsBlock({
  agreements: agreementsProp,
  onUpdate,
  showHelp,
}: {
  agreements: AgreementsState | undefined;
  onUpdate: (next: AgreementsState) => void;
  showHelp: boolean;
}) {
  const agreements = normalizeAgreements(agreementsProp) ?? DEFAULT_AGREEMENTS_STATE;
  const handleChange = (patch: Partial<AgreementsState>) => {
    const next = normalizeAgreements({ ...agreements, ...patch });
    onUpdate(next);
  };
  const idPrefix = 'agreements';
  return (
    <div className="form-section" style={{ marginTop: '1rem' }}>
      <h4 className="form-label" style={{ marginBottom: '0.75rem' }}>Agreements</h4>
      <div className="checkbox-item">
        <input
          id={`${idPrefix}-has_sla`}
          type="checkbox"
          checked={agreements.has_sla}
          onChange={(e) => handleChange({ has_sla: e.target.checked })}
        />
        <label htmlFor={`${idPrefix}-has_sla`}>{AGREEMENTS_LABELS.has_sla}</label>
      </div>
      {agreements.has_sla && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-sla_hours`} className="form-label">
            {AGREEMENTS_LABELS.sla_hours}
          </label>
          <NumericInput
            id={`${idPrefix}-sla_hours`}
            value={agreements.sla_hours ?? null}
            onValueChange={(n) => handleChange({ sla_hours: n })}
            integer
            min={0}
            max={168}
            allowEmpty
            className="form-control"
          />
          <span className="text-secondary" style={{ marginLeft: '0.25rem' }}>Hours</span>
        </div>
      )}
      <div className="checkbox-item">
        <input
          id={`${idPrefix}-has_pra`}
          type="checkbox"
          checked={agreements.has_pra}
          onChange={(e) => handleChange({ has_pra: e.target.checked })}
        />
        <label htmlFor={`${idPrefix}-has_pra`}>{AGREEMENTS_LABELS.has_pra}</label>
      </div>
      {agreements.has_pra && (
        <>
          <div className="form-group">
            <label htmlFor={`${idPrefix}-pra_category`} className="form-label">
              {AGREEMENTS_LABELS.pra_category}
            </label>
            <select
              id={`${idPrefix}-pra_category`}
              className="form-control"
              value={agreements.pra_category ?? ''}
              onChange={(e) => {
                const v = e.target.value as PraCategory | '';
                handleChange({ pra_category: v || null });
              }}
            >
              <option value="">Select...</option>
              {PRA_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {agreements.pra_category === 'OTHER' && (
            <div className="form-group">
              <label htmlFor={`${idPrefix}-pra_category_other`} className="form-label">
                {AGREEMENTS_LABELS.pra_category_other}
              </label>
              <input
                id={`${idPrefix}-pra_category_other`}
                type="text"
                className="form-control"
                maxLength={80}
                value={agreements.pra_category_other ?? ''}
                onChange={(e) => handleChange({ pra_category_other: e.target.value || null })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Fields hidden when requires_service is false. */
const GATED_BY_REQUIRES_SERVICE = new Set([
  'time_to_impact_hours',
  'loss_fraction_no_backup',
  'has_backup_any',
  'has_backup',
  'has_backup_generator',
  'backup_duration_hours',
  'loss_fraction_with_backup',
  'recovery_time_hours',
]);

/** Fields hidden when has_backup_any/has_backup is false. */
const GATED_BY_HAS_BACKUP = new Set([
  'has_backup_generator',
  'backup_duration_hours',
  'loss_fraction_with_backup',
]);

function effectiveHasBackup(data: Record<string, unknown>): boolean {
  if (data.has_backup_any === true) return true;
  if (data.has_backup === true) return true;
  return false;
}

function shouldShowField(fieldKey: string, data: Record<string, unknown>): boolean {
  if (GATED_BY_REQUIRES_SERVICE.has(fieldKey) && data.requires_service !== true) return false;
  if (GATED_BY_HAS_BACKUP.has(fieldKey) && !effectiveHasBackup(data)) return false;
  return true;
}

function hasConditionalDataWhileParentFalse(data: Record<string, unknown>): string | null {
  if (data.requires_service === false) {
    for (const key of GATED_BY_REQUIRES_SERVICE) {
      const v = data[key];
      if (v != null && v !== 0 && v !== false && (typeof v !== 'string' || v.trim() !== '') && (!Array.isArray(v) || v.length > 0)) {
        return `requires_service is false but ${key} has value`;
      }
    }
  }
  if (effectiveHasBackup(data) === false) {
    for (const key of GATED_BY_HAS_BACKUP) {
      const v = data[key];
      if (v != null && v !== 0 && v !== false && (typeof v !== 'string' || v.trim() !== '')) {
        return `has_backup_any/has_backup is false but ${key} has value`;
      }
    }
  }
  const agreements = data.agreements as AgreementsState | undefined;
  if (agreements != null) {
    if (agreements.has_sla === false && agreements.sla_hours != null) {
      return 'agreements.has_sla is false but agreements.sla_hours has value';
    }
    if (agreements.has_pra === false && (agreements.pra_category != null || (agreements.pra_category_other != null && String(agreements.pra_category_other).trim() !== ''))) {
      return 'agreements.has_pra is false but agreements.pra_category or pra_category_other has value';
    }
  }
  return null;
}

const CURVE_CATEGORY_TO_TOPIC: Partial<Record<CategoryCode, DependencyTopicKey>> = {
  ELECTRIC_POWER: 'energy',
  COMMUNICATIONS: 'communications',
  INFORMATION_TECHNOLOGY: 'information_technology',
  WATER: 'water',
  WASTEWATER: 'wastewater',
};

export interface DependencySectionProps {
  category: CategoryCode;
  data: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  onCriticalProductsChange: (rows: CriticalProductRow[]) => void;
  showHelp: boolean;
  /** When false, PRA/SLA UI (agreements block, Priority Restoration button) is hidden. Default true. */
  praSlaEnabled?: boolean;
  /** When provided with onPriorityRestorationChange, shows Priority Restoration & SLA help button and persists to assessment. */
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
}

/** Renders one dependency section (gold-standard layout): card with title/description and either form fields or Critical Products table. */
export function DependencySection({
  category,
  data,
  onUpdate,
  onCriticalProductsChange,
  showHelp,
  praSlaEnabled = true,
  priorityRestoration,
  onPriorityRestorationChange,
}: DependencySectionProps) {
  const config = UI_CONFIG.find((c) => c.category === category);
  if (!config) return null;

  const isTableCategory = config.table != null;
  const topicKey = CURVE_CATEGORY_TO_TOPIC[category];
  const showPriorityRestorationButton =
    praSlaEnabled &&
    topicKey != null &&
    priorityRestoration != null &&
    onPriorityRestorationChange != null;

  if (process.env.NODE_ENV === 'development') {
    const err = hasConditionalDataWhileParentFalse(data);
    if (err) throw new Error(`Conditional data present while parent is false: ${err}`);
    const agreements = data.agreements as AgreementsState | undefined;
    if (agreements != null) {
      if (agreements.has_sla === false && agreements.sla_hours != null) {
        throw new Error('Dev guard: has_sla is false but sla_hours is not null');
      }
      if (agreements.has_pra === false && (agreements.pra_category != null || (agreements.pra_category_other != null && String(agreements.pra_category_other).trim() !== ''))) {
        throw new Error('Dev guard: has_pra is false but pra_category or pra_category_other is not null');
      }
    }
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: config.description ? '0.5rem' : 0 }}>
        <h3 className="card-title" style={{ margin: 0 }}>{config.title}</h3>
        {showPriorityRestorationButton && (
          <PriorityRestorationHelpButton
            topicKey={topicKey}
            value={priorityRestoration}
            onChange={onPriorityRestorationChange}
          />
        )}
      </div>
      {config.description && <p className="text-secondary mb-3">{config.description}</p>}
      {isTableCategory ? (
        <CriticalProductsTable
          category={category}
          table={{
            ...config.table!,
            columns: [
              ...config.table!.columns,
              { key: 'alternate_supplier_name', label: 'Alternate supplier name', type: 'text' },
              { key: 'multi_source_currently_used', label: 'Currently sourced from more than one supplier?', type: 'boolean' },
            ],
          }}
          rows={(data.critical_products as CriticalProductRow[] | undefined) ?? []}
          onRowsChange={onCriticalProductsChange}
          maxRows={config.table!.maxRows}
        />
      ) : (
        <div className="form-section">
          {(!showPriorityRestorationButton || isPriorityRestorationSectionCompleted(priorityRestoration?.[topicKey!] as PriorityRestorationTopic | null | undefined)) && (
            <>
              {config.fields.map((field) => {
                if (field.key !== 'requires_service') return null;
                if (process.env.NODE_ENV === 'development' && field.label_source == null) {
                  throw new Error(`Missing label_source for ${category}.${field.key}. Labels must come from XLSM extraction.`);
                }
                return (
                  <FieldInput
                    key={field.key}
                    field={field}
                    category={category}
                    value={data[field.key]}
                    onChange={(v) => onUpdate(field.key, v)}
                    showHelp={showHelp}
                  />
                );
              })}
              {data.requires_service === true && category !== 'CRITICAL_PRODUCTS' && category !== 'INFORMATION_TECHNOLOGY' && (
                <SupplySourcesEditor
                  categoryCode={category}
                  value={data.supply as Supply | undefined}
                  onChange={(supply: Supply) => onUpdate('supply', supply)}
                />
              )}
              {data.requires_service === true && category === 'INFORMATION_TECHNOLOGY' && (
                <>
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">A. Internet Transport Failure</h4>
                    <p className="text-secondary text-sm mb-0">
                      Scenario: Internet connectivity is lost due to ISP or circuit failure.
                      This section evaluates physical transport resilience (carriers, circuits, diversity).
                    </p>
                  </div>
                  <ItSupplyIspBlock
                    supply={data.supply as Supply | undefined}
                    onUpdate={(supply: Supply) => onUpdate('supply', supply)}
                  />
                  <ItTransportResilienceForm
                    value={data.it_transport_resilience as ItTransportResilience | undefined}
                    onChange={(next) => onUpdate('it_transport_resilience', next)}
                    requireCircuitCount
                  />
                  {buildItDependencyRows(data as Record<string, unknown>).length > 0 && (
                    <>
                      <div className="mb-4 mt-4">
                        <h4 className="font-semibold mb-1">B. Internet Connectivity Loss (Hosted Services Unreachable)</h4>
                        <p className="text-secondary text-sm mb-0">
                          If internet connectivity to the facility is lost, externally hosted services become unreachable.
                          This section evaluates operational impact when hosted services cannot be reached — not ISP or circuit redundancy (those are in Communications).
                        </p>
                      </div>
                      <ItHostedResilienceChecklist
                        dependencies={buildItDependencyRows(data as Record<string, unknown>)}
                        value={data.it_hosted_resilience as ItHostedResilience | undefined}
                        onChange={(next) => onUpdate('it_hosted_resilience', next)}
                      />
                    </>
                  )}
                </>
              )}
              {category !== 'CRITICAL_PRODUCTS' && praSlaEnabled && !showPriorityRestorationButton && (
                <AgreementsBlock
                  agreements={normalizeAgreements(data.agreements as AgreementsState | undefined) ?? DEFAULT_AGREEMENTS_STATE}
                  onUpdate={(next) => onUpdate('agreements', next)}
                  showHelp={showHelp}
                />
              )}
              {config.fields.map((field) => {
                if (field.key === 'requires_service') return null;
                if (!shouldShowField(field.key, data)) return null;
                if (process.env.NODE_ENV === 'development') {
                  if (!field.label_source) {
                    throw new Error(
                      `Missing label_source for ${category}.${field.key}. Labels must come from XLSM extraction.`
                    );
                  }
                  if (field.key.includes('loss_fraction') && field.displayAs === 'fraction') {
                    throw new Error(
                      'loss_fraction fields must be rendered as percent per UI_REFERENCE_ELECTRICITY.md'
                    );
                  }
                }
                return (
                  <FieldInput
                    key={field.key}
                    field={field}
                    category={category}
                    value={data[field.key]}
                    onChange={(v) => onUpdate(field.key, v)}
                    showHelp={showHelp}
                  />
                );
              })}
            </>
          )}
        </div>
      )}
    </section>
  );
}
