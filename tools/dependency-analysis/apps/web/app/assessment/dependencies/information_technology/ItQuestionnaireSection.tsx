'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from '@/components/FieldLink';
import {
  IT_QUESTIONS,
  IT_CURVE_QUESTIONS,
  getDefaultItAnswers,
  type ItAnswers,
  type ItServiceProviderEntry,
  type ItUpstreamAssetEntry,
  type ItConnectionEntry,
  type ItComponentProtection,
  type ItQuestionDef,
  type ItInstallationLocation,
} from '@/app/lib/dependencies/infrastructure/it_spec';
import { ComboBox } from '@/components/inputs/ComboBox';
import {
  DIGITAL_SERVICE_OPTIONS,
  getDigitalServiceOption,
} from '@/app/lib/catalog/digital_services_catalog';
import { getHostedServiceProfile, isTransportProvider } from '@/app/lib/report/it/hosted_service_registry';
import { itAnswersToInformationTechnologyCategoryInput, categoryInputToItAnswers } from '@/app/lib/dependencies/it_to_category_input';
import { getItAnswersForUI, saveItAnswers } from '@/app/lib/dependencies/persistence';
import type { CategoryInput } from 'schema';
import {
  DEFAULT_PRIORITY_RESTORATION,
  type PriorityRestoration,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import { PriorityRestorationHelpButton } from '@/components/asset-dependency/PriorityRestorationHelpButton';
import { ImpactCurveConfigCard } from '@/components/ImpactCurveConfigCard';
import { RedundancyActivationBlock } from '@/components/RedundancyActivationBlock';
import { HelpTooltip } from '@/components/HelpTooltip';
import { InfraIntroBlock } from '@/components/InfraIntroBlock';
import { INFRA_INTRO } from '@/app/lib/dependencies/infra_intro_copy';

const IT_INTRO =
  'Answer each question. When the answer is YES, provide the required entries (add one row per item where applicable).';

const TOTAL_QUESTION_COUNT = IT_CURVE_QUESTIONS.length + IT_QUESTIONS.length;

const IT_QUESTION_MAP: Record<string, ItQuestionDef> = IT_QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<string, ItQuestionDef>
);

function itQuestion(id: string): ItQuestionDef {
  const q = IT_QUESTION_MAP[id];
  if (!q) {
    throw new Error(`Unknown IT question id: ${id}`);
  }
  return q;
}

type YesNoUnknown = 'yes' | 'no' | 'unknown';

const INSTALLATION_OPTIONS: Array<{
  value: ItInstallationLocation;
  label: string;
  description: string;
}> = [
  {
    value: 'exterior_at_grade',
    label: 'Exterior at grade (vehicle accessible)',
    description: 'Installed where vehicles can directly contact components, such as curbside fiber cabinets or ground-level termination boxes.',
  },
  {
    value: 'exterior_elevated_or_protected',
    label: 'Exterior but elevated or otherwise protected',
    description: 'Mounted above vehicle height or behind permanent barriers that prevent direct vehicle contact.',
  },
  {
    value: 'interior_or_underground',
    label: 'Underground or interior within secured space',
    description: 'Installed inside secured rooms, within the building envelope, or routed through underground conduit away from vehicle paths.',
  },
  {
    value: 'unknown',
    label: 'Unknown or varies by location',
    description: 'Installation details are not known or vary across providers or service entrances.',
  },
];

export type ItQuestionnaireSectionProps = {
  embedded?: boolean;
  onCurveDataChange?: (categoryInput: CategoryInput) => void;
  existingItCategory?: Partial<CategoryInput>;
  priorityRestoration?: PriorityRestoration;
  onPriorityRestorationChange?: (next: PriorityRestoration) => void;
  /** When false, PRA/SLA section (Provider Restoration Agreements) is hidden. Base assessment must not show PRA questions. */
  praSlaEnabled?: boolean;
};

export function ItQuestionnaireSection({
  embedded = false,
  onCurveDataChange,
  existingItCategory = {},
  priorityRestoration,
  onPriorityRestorationChange,
  praSlaEnabled = false,
}: ItQuestionnaireSectionProps) {
  const defaults = getDefaultItAnswers();
  const [answers, setAnswers] = useState<ItAnswers>(defaults);
  const [validationError, setValidationError] = useState<{ message: string; path: (string | number)[] } | null>(null);

  useEffect(() => {
    const stored = getItAnswersForUI();
    const fromExisting = categoryInputToItAnswers(existingItCategory);
    if (Object.keys(fromExisting).length > 0) {
      setAnswers({ ...stored, ...fromExisting });
    } else {
      setAnswers(stored);
    }
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    saveTimeoutRef.current = setTimeout(() => saveItAnswers(answers), 1500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [answers]);

  const update = useCallback((patch: Partial<ItAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
    setValidationError(null);
  }, []);

  // ISPs (primary/secondary) are stored in supply.sources, not IT-1. Do not prefill IT-1 from curve_primary_provider.

  // Sync to parent so chart updates and data persists
  const lastPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onCurveDataChange) return;
    const categoryInput = itAnswersToInformationTechnologyCategoryInput(answers, existingItCategory);
    const payload = JSON.stringify(categoryInput);
    if (payload === lastPayloadRef.current) return;
    lastPayloadRef.current = payload;
    onCurveDataChange(categoryInput);
  }, [answers, existingItCategory, onCurveDataChange]);

  const heading = embedded ? (
    <h3 className="text-lg font-semibold mt-6 mb-2">Information Technology (Externally Hosted / Managed Digital Services) — IT-1–IT-7</h3>
  ) : (
    <h2 className="section-title">Information Technology (Externally Hosted / Managed Digital Services)</h2>
  );

  const scopeCallout = (
    <div
      className="mb-4 p-3 border rounded"
      style={{ borderColor: 'var(--cisa-blue-lighter)', backgroundColor: 'var(--cisa-blue-lightest)', borderLeft: '4px solid var(--cisa-blue-lighter)' }}
      role="region"
      aria-labelledby="it-scope-heading"
    >
      <h4 id="it-scope-heading" className="h6 mb-2">Scope</h4>
      <p className="mb-0 text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
        Evaluates reliance on externally hosted or managed digital services (SaaS platforms, cloud applications, hosted identity services, managed IT providers). Systems owned and operated by the facility are considered critical assets and are not assessed as dependencies here.
      </p>
    </div>
  );

  const requiresService = answers.curve_requires_service !== false;
  const hasBackup = answers.curve_backup_available === 'yes';
  const hasMultipleProviders = answers['IT-3_multiple_connections'] === 'no'; // no = multiple providers
  const installationLocation = answers['IT-7_installation_location'];
  const vehicleExposure = answers['IT-7_vehicle_impact_exposure'];
  const autoVehicleNa = installationLocation === 'interior_or_underground';
  const showVehicleProtection = !autoVehicleNa && vehicleExposure === 'yes';
  const qIT1 = itQuestion('IT-1');
  const qIT2 = itQuestion('IT-2');
  const qIT3 = itQuestion('IT-3');
  const qIT4 = itQuestion('IT-4');
  const qIT5 = itQuestion('IT-5');
  const qIT7 = itQuestion('IT-7');
  const qIT11 = itQuestion('IT-11');

  const handleInstallationLocationChange = useCallback(
    (value: ItInstallationLocation) => {
      const next: Partial<ItAnswers> = {
        'IT-7_installation_location': value,
      };
      if (value === 'interior_or_underground') {
        next['IT-7_vehicle_impact_exposure'] = 'na';
        next['IT-7a_vehicle_impact_protection'] = 'unknown';
      } else {
        const currentExposure = answers['IT-7_vehicle_impact_exposure'];
        next['IT-7_vehicle_impact_exposure'] = currentExposure === 'na' ? 'unknown' : currentExposure;
      }
      update(next);
    },
    [answers, update]
  );

  const handleVehicleExposureChange = useCallback(
    (value: YesNoUnknown) => {
      update({
        'IT-7_vehicle_impact_exposure': value,
        'IT-7a_vehicle_impact_protection': value === 'yes' ? answers['IT-7a_vehicle_impact_protection'] : 'unknown',
      });
    },
    [answers, update]
  );

  const handleVehicleProtectionChange = useCallback(
    (value: YesNoUnknown) => update({ 'IT-7a_vehicle_impact_protection': value }),
    [update]
  );

  return (
    <>
      {scopeCallout}
      {heading}
      <p className="text-secondary mb-4">{IT_INTRO}</p>
      <div className="mb-4">
        {!embedded && (
          <Link href="/assessment/categories/" className="btn btn-secondary" style={{ marginRight: '0.5rem' }}>
            ← Categories
          </Link>
        )}
        {priorityRestoration != null && onPriorityRestorationChange != null && (
          <PriorityRestorationHelpButton
            topicKey="information_technology"
            value={priorityRestoration}
            onChange={onPriorityRestorationChange}
            showNotes={true}
          />
        )}
        {validationError && (
            <span className="text-danger ml-3" role="alert">
              {validationError.message}
            </span>
          )}
      </div>

      <InfraIntroBlock {...INFRA_INTRO.INFORMATION_TECHNOLOGY} />

      {/* A. Internet Transport Failure */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: 0, marginBottom: '0.5em' }}>
        A. Internet Transport Failure
      </div>
      <p className="text-secondary mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
        Scenario: Internet connectivity is lost due to ISP or circuit failure.
        This section evaluates physical transport resilience (carriers, circuits, diversity).
      </p>

      {/* OPERATIONAL IMPACT PROFILE – Impact Curve Configuration (at top) */}
      <div className="section-heading" style={{ fontSize: '1em', fontWeight: 600, marginTop: '1rem', marginBottom: '0.75em' }}>
        Operational Impact Profile
      </div>

      {/* Curve Questions */}
      <ImpactCurveConfigCard>
        <QuestionBlock questionId="curve_1" prompt={IT_CURVE_QUESTIONS[0].prompt} helpText={IT_CURVE_QUESTIONS[0].helpText} feedsChart>
          <YesNoRow
            value={answers.curve_requires_service === false ? 'no' : 'yes'}
            onChange={(v) => update({ curve_requires_service: v === 'yes' })}
          />
        </QuestionBlock>

        {requiresService && (
          <>
            <QuestionBlock questionId="curve_primary_provider" prompt={IT_CURVE_QUESTIONS[1].prompt} helpText={IT_CURVE_QUESTIONS[1].helpText}>
              <input
                type="text"
                dir="ltr"
                className="form-control"
                value={answers.curve_primary_provider ?? ''}
                onChange={(e) => update({ curve_primary_provider: e.target.value || undefined })}
                placeholder="Primary ISP or data connectivity provider"
                style={{ width: '100%', maxWidth: '400px' }}
                aria-label="Who provides primary internet/data connectivity"
              />
            </QuestionBlock>
            <QuestionBlock questionId="curve_secondary_provider" prompt="Secondary ISP or data connectivity provider (if applicable)" helpText="If you have a second circuit or backup provider, enter its name here. Both will appear in the report.">
              <input
                type="text"
                dir="ltr"
                className="form-control"
                value={answers.curve_secondary_provider ?? ''}
                onChange={(e) => update({ curve_secondary_provider: e.target.value || undefined })}
                placeholder="Secondary ISP (optional)"
                style={{ width: '100%', maxWidth: '400px' }}
                aria-label="Who provides secondary internet/data connectivity"
              />
            </QuestionBlock>
            <QuestionBlock questionId="curve_2" prompt={IT_CURVE_QUESTIONS[2].prompt} helpText={IT_CURVE_QUESTIONS[2].helpText} feedsChart>
              <input
                type="number"
                min="0"
                max="72"
                className="form-control"
                value={answers.curve_time_to_impact_hours ?? ''}
                onChange={(e) => update({ curve_time_to_impact_hours: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0-72 hours"
                style={{ width: '200px' }}
              />
            </QuestionBlock>
            <QuestionBlock questionId="curve_3" prompt={IT_CURVE_QUESTIONS[3].prompt} helpText={IT_CURVE_QUESTIONS[3].helpText} feedsChart>
              <input
                type="number"
                min="0"
                max="100"
                className="form-control"
                value={answers.curve_loss_fraction_no_backup != null ? Math.round(answers.curve_loss_fraction_no_backup * 100) : ''}
                onChange={(e) => update({ curve_loss_fraction_no_backup: e.target.value ? Number(e.target.value) / 100 : undefined })}
                placeholder="0-100%"
                style={{ width: '200px' }}
              />
            </QuestionBlock>
            <QuestionBlock questionId="curve_4" prompt={IT_CURVE_QUESTIONS[4].prompt} helpText={IT_CURVE_QUESTIONS[4].helpText} feedsChart>
              <YesNoUnknownRow
                value={answers.curve_backup_available ?? 'unknown'}
                onChange={(v) => update({ curve_backup_available: v })}
              />
            </QuestionBlock>
            {hasBackup && (
              <>
                <RedundancyActivationBlock
                  value={(answers as Record<string, unknown>).redundancy_activation as React.ComponentProps<typeof RedundancyActivationBlock>['value']}
                  onChange={(v) => update({ redundancy_activation: v })}
                  capabilityLabel="redundant circuit / alternate connectivity"
                  activationDelayMin={0}
                  activationDelayMax={240}
                  activationDelayHelp="IT/Comms failover: 0–240 min default; up to 1440 if vendor dispatch."
                />
                <QuestionBlock questionId="curve_6" prompt={IT_CURVE_QUESTIONS[5].prompt} helpText={IT_CURVE_QUESTIONS[5].helpText} feedsChart>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control"
                    value={answers.curve_loss_fraction_with_backup != null ? Math.round(answers.curve_loss_fraction_with_backup * 100) : ''}
                    onChange={(e) => update({ curve_loss_fraction_with_backup: e.target.value ? Number(e.target.value) / 100 : undefined })}
                    placeholder="0-100%"
                    style={{ width: '200px' }}
                  />
                </QuestionBlock>
              </>
            )}
            <QuestionBlock questionId="curve_7" prompt={IT_CURVE_QUESTIONS[6].prompt} helpText={IT_CURVE_QUESTIONS[6].helpText} feedsChart>
              <input
                type="number"
                min="0"
                max="168"
                className="form-control"
                value={answers.curve_recovery_time_hours ?? ''}
                onChange={(e) => update({ curve_recovery_time_hours: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0-168 hours"
                style={{ width: '200px' }}
              />
            </QuestionBlock>
          </>
        )}
      </ImpactCurveConfigCard>

      {/* B. Internet Connectivity Loss (Hosted Services Unreachable) */}
      <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.5em' }}>
        B. Internet Connectivity Loss (Hosted Services Unreachable)
      </div>
      <p className="text-secondary mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
        If internet connectivity to the facility is lost, externally hosted services become unreachable.
        This section evaluates operational impact when hosted services cannot be reached — not ISP or circuit redundancy (those are in Communications).
      </p>

      {/* SECTION 1 – STRUCTURAL DEPENDENCY IDENTIFICATION */}
      <div className="section-heading" style={{ fontSize: '1em', fontWeight: 600, marginTop: '1rem', marginBottom: '0.75em' }}>
        Structural Dependency Identification
      </div>

      {/* IT-1..IT-11 — only when requires service */}
      {requiresService && (
        <div className="space-y-4">
          {/* IT-1 */}
          <QuestionBlock
            questionId="IT-1"
            prompt={qIT1.prompt}
            helpText={qIT1.helpText}
          >
            <YesNoUnknownRow value={answers['IT-1_can_identify_providers']} onChange={(v) => update({ 'IT-1_can_identify_providers': v })} />
            {answers['IT-1_can_identify_providers'] === 'yes' && (
              <ItServiceProvidersEditor
                providers={answers['IT-1_service_providers']}
                onChange={(p) => update({ 'IT-1_service_providers': p })}
              />
            )}
          </QuestionBlock>

          {/* IT-2 — Yes / No / NA (not applicable) / Unknown */}
          <QuestionBlock
            questionId="IT-2"
            prompt={qIT2.prompt}
            helpText={qIT2.helpText}
          >
            <div className="radio-group-vertical">
              {[
                { value: 'yes' as const, label: 'Yes' },
                { value: 'no' as const, label: 'No' },
                { value: 'na' as const, label: 'NA (facility does not rely on externally hosted services)' },
                { value: 'unknown' as const, label: 'Unknown' },
              ].map(({ value, label }) => (
                <div key={value} className="radio-option-item">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="IT-2_can_identify_assets"
                      value={value}
                      checked={answers['IT-2_can_identify_assets'] === value}
                      onChange={() => update({ 'IT-2_can_identify_assets': value })}
                      aria-label={`${qIT2.prompt}: ${label}`}
                    />
                    <span>{label}</span>
                  </label>
                </div>
              ))}
            </div>
            {answers['IT-2_can_identify_assets'] === 'yes' && (
              <ItUpstreamAssetsEditor
                assets={answers['IT-2_upstream_assets']}
                onChange={(a) => update({ 'IT-2_upstream_assets': a })}
              />
            )}
          </QuestionBlock>

          {/* IT-3 — Yes = single provider (bad), No = multiple providers (good) */}
          <QuestionBlock
            questionId="IT-3"
            prompt={qIT3.prompt}
            helpText={qIT3.helpText}
          >
            <div className="radio-group">
              {[
                { value: 'yes' as const, label: 'Yes (single provider dependency)' },
                { value: 'no' as const, label: 'No (multiple providers / alternate platforms exist)' },
                { value: 'unknown' as const, label: 'Unknown' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="IT-3"
                    value={value}
                    checked={answers['IT-3_multiple_connections'] === value}
                    onChange={() =>
                      update({
                        'IT-3_multiple_connections': value,
                        ...(value === 'yes'
                          ? {
                              'IT-4_physically_separated': undefined,
                              'IT-4_service_connections': undefined,
                              'IT-5_survivability': undefined,
                            }
                          : {}),
                      })
                    }
                    aria-label={`${IT_QUESTIONS[2].prompt}: ${label}`}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </QuestionBlock>

          {answers['IT-3_multiple_connections'] !== 'yes' && (
            <>
              {/* IT-4 */}
              <QuestionBlock
                questionId="IT-4"
                prompt={qIT4.prompt}
                helpText={qIT4.helpText}
              >
                <div className="mb-3">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    Are primary and secondary internet terminations physically separated?
                    <HelpTooltip helpText="Different rooms, building entries, or conduits = Yes. Same room/entry or shared corridor = No." />
                  </p>
                  <div className="radio-group-vertical">
                    {[
                      { value: 'yes' as const, label: 'Yes - physically separated' },
                      { value: 'no' as const, label: 'No - same room/entry or shared path' },
                      { value: 'unknown' as const, label: 'Unknown' },
                      { value: 'na' as const, label: 'N/A' },
                    ].map(({ value, label }) => (
                      <div key={value} className="radio-option-item">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="IT-4_physically_separated"
                            value={value}
                            checked={answers['IT-4_physically_separated'] === value}
                            onChange={() => update({ 'IT-4_physically_separated': value })}
                            aria-label={`${qIT4.prompt}: ${label}`}
                          />
                          <span>{label}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {(answers['IT-4_physically_separated'] === 'yes' || answers['IT-4_physically_separated'] === 'no') && (
                  <div>
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      Document each connection demarcation and path details
                      <HelpTooltip helpText="Add one row per connection. Include provider name, exact termination location, and whether route segments are shared." />
                    </p>
                    <ItConnectionEntriesEditor
                      connections={answers['IT-4_service_connections']}
                      onChange={(c) => update({ 'IT-4_service_connections': c })}
                    />
                  </div>
                )}
              </QuestionBlock>

              {/* IT-5 */}
              <QuestionBlock
                questionId="IT-5"
                prompt={qIT5.prompt}
                helpText={qIT5.helpText}
              >
                <YesNoUnknownRow value={answers['IT-5_survivability']} onChange={(v) => update({ 'IT-5_survivability': v })} />
              </QuestionBlock>
            </>
          )}

          {/* IT-6 deprecated — hidden */}

          {/* SECTION 2 – PHYSICAL EXPOSURE CONDITIONS */}
          <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
            Physical Exposure Conditions
          </div>

          {/* IT-7 */}
          <QuestionBlock
            questionId="IT-7"
            prompt={qIT7.prompt}
            helpText={qIT7.helpText}
          >
            <div className="radio-group-vertical">
              {INSTALLATION_OPTIONS.map(({ value, label, description }) => (
                <div key={value} className="radio-option-item">
                  <label className="flex items-start gap-2 cursor-pointer" style={{ marginBottom: 0 }}>
                    <input
                      type="radio"
                      name="IT-7_installation_location"
                      value={value}
                      checked={installationLocation === value}
                      onChange={() => handleInstallationLocationChange(value)}
                      aria-label={`${label}: ${description}`}
                    />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                      <span className="font-medium" style={{ display: 'block' }}>{label}</span>
                      <span className="text-sm text-secondary" style={{ display: 'block' }}>{description}</span>
                    </span>
                  </label>
                </div>
              ))}
            </div>

            {autoVehicleNa ? (
              <div
                className="mt-3 p-3 border rounded"
                role="status"
                style={{
                  borderColor: 'var(--cisa-green-lighter, #b7e0c2)',
                  backgroundColor: 'var(--cisa-green-lightest, #edf7f0)',
                  borderLeft: '4px solid var(--cisa-green-lighter, #b7e0c2)',
                }}
              >
                <p className="mb-1 font-semibold">Vehicle impact exposure set to Not Applicable.</p>
                <p className="mb-0 text-sm text-secondary">
                  Because components are underground or interior, vehicle impact exposure is automatically recorded as N/A and the protection follow-up is skipped.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-semibold mb-2">Are components exposed to potential vehicle impact?</p>
                  <div className="radio-group-vertical">
                    {(['yes', 'no', 'unknown'] as const).map((v) => (
                      <div key={v} className="radio-option-item">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="IT-7_vehicle_impact_exposure"
                            checked={vehicleExposure === v}
                            onChange={() => handleVehicleExposureChange(v)}
                          />
                          <span className="capitalize">{v}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {showVehicleProtection && (
                  <div>
                    <p className="font-semibold mb-2">Are protective measures in place?</p>
                    <div className="radio-group-vertical">
                      {(['yes', 'no', 'unknown'] as const).map((v) => (
                        <div key={v} className="radio-option-item">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="IT-7a_vehicle_impact_protection"
                              checked={answers['IT-7a_vehicle_impact_protection'] === v}
                              onChange={() => handleVehicleProtectionChange(v)}
                            />
                            <span className="capitalize">{v}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </QuestionBlock>
        </div>
      )}

      {/* PRA/SLA — Per-ISP Provider Restoration Agreements (overlay only; hidden in base assessment) */}
      {praSlaEnabled && requiresService && (() => {
        const primary = (answers.curve_primary_provider ?? '').trim();
        const secondary = (answers.curve_secondary_provider ?? '').trim();
        const providerNames = [primary, secondary].filter(Boolean);
        const existingByProvider = (answers.it_pra_sla_providers ?? []).reduce(
          (acc, p) => {
            acc[p.name] = p;
            return acc;
          },
          {} as Record<string, { name: string; restoration_coordination?: YesNoUnknown; priority_restoration?: YesNoUnknown }>
        );
        const providersWithPra = providerNames.map((name) => existingByProvider[name] ?? { name, restoration_coordination: 'unknown' as const, priority_restoration: 'unknown' as const });

        const setProviderPra = (providerName: string, field: 'restoration_coordination' | 'priority_restoration', value: YesNoUnknown) => {
          const list = answers.it_pra_sla_providers ?? [];
          const idx = list.findIndex((p) => p.name === providerName);
          const entry = list[idx] ?? { name: providerName, restoration_coordination: 'unknown' as const, priority_restoration: 'unknown' as const };
          const nextEntry = { ...entry, [field]: value };
          const nextList = idx >= 0 ? list.map((p, i) => (i === idx ? nextEntry : p)) : [...list, nextEntry];
          update({ it_pra_sla_providers: nextList });
        };

        if (providerNames.length === 0) return null;
        return (
          <>
            <div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
              Provider Restoration Agreements
            </div>
            {providersWithPra.map((provider) => (
              <div key={provider.name} className="card mb-4 p-4">
                <h4 className="font-semibold mb-3" style={{ fontSize: '1rem' }}>ISP: {provider.name}</h4>
                <QuestionBlock
                  questionId={`IT-11-${provider.name}`}
                  prompt="Does the facility have established coordination with this ISP for restoration during outages?"
                  helpText={qIT11.helpText}
                >
                  <YesNoUnknownRow
                    value={provider.restoration_coordination ?? 'unknown'}
                    onChange={(v) => setProviderPra(provider.name, 'restoration_coordination', v)}
                  />
                </QuestionBlock>
                <QuestionBlock
                  questionId={`IT-PRA-${provider.name}`}
                  prompt="Does the facility participate in a priority restoration program with this ISP?"
                  helpText="If YES, the facility is identified for prioritized service restoration with this provider during widespread outages."
                >
                  <YesNoUnknownRow
                    value={provider.priority_restoration ?? 'unknown'}
                    onChange={(v) => setProviderPra(provider.name, 'priority_restoration', v)}
                  />
                </QuestionBlock>
              </div>
            ))}
          </>
        );
      })()}
    </>
  );
}

function QuestionBlock({
  questionId,
  prompt,
  helpText,
  feedsChart,
  children,
}: {
  questionId?: string;
  prompt: string;
  helpText: string;
  feedsChart?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section id={questionId ? `it-q-${questionId}` : undefined} className={`card mb-4 ${feedsChart ? 'border-primary' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        {feedsChart && <span className="badge badge-primary text-xs">Feeds impact curve</span>}
      </div>
      <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
        {prompt}
        {helpText && <HelpTooltip helpText={helpText} />}
      </h4>
      {children}
    </section>
  );
}

function YesNoRow({ value, onChange }: { value: 'yes' | 'no'; onChange: (v: 'yes' | 'no') => void }) {
  return (
    <div className="radio-group">
      {(['yes', 'no'] as const).map((v) => (
        <label key={v} className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={value === v} onChange={() => onChange(v)} />
          <span className="capitalize">{v}</span>
        </label>
      ))}
    </div>
  );
}

function YesNoUnknownRow({ value, onChange }: { value?: YesNoUnknown; onChange: (v: YesNoUnknown) => void }) {
  return (
    <div className="radio-group-vertical">
      {(['yes', 'no', 'unknown'] as const).map((v) => (
        <div key={v} className="radio-option-item">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={value === v} onChange={() => onChange(v)} />
            <span className="capitalize">{v}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

function BackupTestedRow({
  value,
  onChange,
}: {
  value: 'yes_within_12_months' | 'yes_over_12_months_ago' | 'no' | 'unknown' | undefined;
  onChange: (v: 'yes_within_12_months' | 'yes_over_12_months_ago' | 'no' | 'unknown') => void;
}) {
  const opts = [
    { value: 'yes_within_12_months' as const, label: 'Yes – within 12 months' },
    { value: 'yes_over_12_months_ago' as const, label: 'Yes – over 12 months ago' },
    { value: 'no' as const, label: 'No' },
    { value: 'unknown' as const, label: 'Unknown' },
  ];
  return (
    <div className="radio-group-vertical">
      {opts.map(({ value: v, label }) => (
        <div key={v} className="radio-option-item">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={value === v} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

const IT1_ISP_VALIDATION_MSG = 'Connectivity providers belong in Internet Transport above.';

function ItServiceProvidersEditor({ providers, onChange }: { providers: ItServiceProviderEntry[]; onChange: (p: ItServiceProviderEntry[]) => void }) {
  const filtered = providers.filter((p) => !isTransportProvider((p.provider_name ?? '').trim()));
  const hasIsp = filtered.length < providers.length;
  React.useEffect(() => {
    if (hasIsp) onChange(filtered);
  }, [hasIsp]);
  const emit = (next: ItServiceProviderEntry[]) => {
    const noIsp = next.filter((p) => !isTransportProvider((p.provider_name ?? '').trim()));
    onChange(noIsp.length < next.length ? noIsp : next);
  };
  const add = () => emit([...filtered, { provider_name: '', designation: 'unknown' }]);
  const remove = (i: number) => emit(filtered.filter((_, j) => j !== i));
  const set = (i: number, patch: Partial<ItServiceProviderEntry>) => {
    const next = [...filtered];
    next[i] = { ...next[i]!, ...patch };
    emit(next);
  };
  return (
    <div className="mt-2 space-y-2">
      {hasIsp && (
        <p id="it1-isp-msg" className="text-danger small mb-2" role="alert">
          {IT1_ISP_VALIDATION_MSG}
        </p>
      )}
      {filtered.map((p, i) => (
        <div key={i} className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            dir="ltr"
            className="form-control"
            value={p.provider_name}
            onChange={(e) => set(i, { provider_name: e.target.value })}
            placeholder="MSP/MSSP name (not ISP)"
            style={{ width: '180px' }}
            aria-label="Provider name"
            aria-describedby={hasIsp ? 'it1-isp-msg' : undefined}
          />
          <select className="form-control" value={p.designation} onChange={(e) => set(i, { designation: e.target.value as ItServiceProviderEntry['designation'] })} aria-label="Designation">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="unknown">Unknown</option>
          </select>
          <button type="button" onClick={() => remove(i)} className="btn btn-secondary text-sm">Remove</button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-secondary text-sm">Add provider</button>
    </div>
  );
}

// Exclude TRANSPORT_ISP so transport providers are not selectable as hosted services (IT-2)
const DIGITAL_SERVICE_COMBO_OPTIONS = DIGITAL_SERVICE_OPTIONS.filter(
  (o) => getHostedServiceProfile(o.id)?.kind !== 'TRANSPORT_ISP'
).map((o) => ({
  value: o.id,
  label: o.label,
  group: o.group,
}));

function onSelectService(
  row: ItUpstreamAssetEntry,
  nextId: string
): ItUpstreamAssetEntry {
  const opt = getDigitalServiceOption(nextId);
  const next: ItUpstreamAssetEntry = { ...row, service_id: nextId };
  if (nextId !== 'other') {
    next.service_other = '';
  }
  if (opt?.provider && (!next.service_provider || String(next.service_provider).trim() === '')) {
    next.service_provider = opt.provider;
  }
  return next;
}

function ItUpstreamAssetsEditor({ assets, onChange }: { assets: ItUpstreamAssetEntry[]; onChange: (a: ItUpstreamAssetEntry[]) => void }) {
  const add = () =>
    onChange([
      ...assets,
      { service_id: '', service_provider: undefined, designation: 'unknown' },
    ]);
  const remove = (i: number) => onChange(assets.filter((_, j) => j !== i));
  const set = (i: number, patch: Partial<ItUpstreamAssetEntry>) => {
    const next = [...assets];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  return (
    <div className="mt-2 space-y-2">
      {assets.map((a, i) => (
        <div key={i} className="card p-3 space-y-2">
          <div className="flex gap-2 flex-wrap items-center">
            <div style={{ flex: 1, minWidth: 260 }}>
              <ComboBox
                value={a.service_id ?? ''}
                onChange={(nextId) => {
                  const updated = onSelectService(a, nextId);
                  set(i, updated);
                }}
                options={DIGITAL_SERVICE_COMBO_OPTIONS}
                placeholder="Select a service…"
                ariaLabel="Digital service"
              />
            </div>
            <input
              type="text"
              dir="ltr"
              className="form-control"
              value={a.service_provider ?? ''}
              onChange={(e) => set(i, { ...a, service_provider: e.target.value || undefined })}
              placeholder="Provider (optional)"
              style={{ width: 240, maxWidth: '100%' }}
            />
            <button type="button" onClick={() => remove(i)} className="btn btn-secondary text-sm">
              Remove
            </button>
          </div>
          {a.service_id === 'other' && (
            <div>
              <input
                type="text"
                dir="ltr"
                className="form-control"
                value={a.service_other ?? ''}
                onChange={(e) => set(i, { ...a, service_other: e.target.value })}
                placeholder="Specify the service name"
                style={{ width: '100%', maxWidth: 'none' }}
              />
            </div>
          )}
          <div>
            <input
              type="text"
              dir="ltr"
              className="form-control"
              value={a.notes ?? ''}
              onChange={(e) => set(i, { ...a, notes: e.target.value || undefined })}
              placeholder="Notes (optional)"
              style={{ width: '100%', maxWidth: 'none' }}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-secondary text-sm">
        Add service
      </button>
    </div>
  );
}

function ItConnectionEntriesEditor({ connections, onChange }: { connections: ItConnectionEntry[]; onChange: (c: ItConnectionEntry[]) => void }) {
  const add = () =>
    onChange([
      ...connections,
      {
        associated_provider: '',
        connection_label: '',
        facility_entry_location: '',
        shared_corridor_with_other_utilities: 'unknown',
      },
    ]);
  const remove = (i: number) => onChange(connections.filter((_, j) => j !== i));
  const set = (i: number, patch: Partial<ItConnectionEntry>) => {
    const next = [...connections];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  return (
    <div className="mt-2 space-y-2">
      {connections.map((c, i) => (
        <div key={i} className="border p-3 rounded space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2">
                Associated provider
                <HelpTooltip helpText="Use the provider name shown in primary/secondary ISP fields (for reliable report matching)." />
              </label>
              <input
                className="form-control"
                value={c.associated_provider ?? ''}
                onChange={(e) => set(i, { associated_provider: e.target.value })}
                placeholder="e.g., Verizon"
                aria-label="Associated provider"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2">
                Connection label
                <HelpTooltip helpText="Use a stable name such as Primary, Secondary, Circuit A, Circuit B." />
              </label>
              <input
                className="form-control"
                value={c.connection_label}
                onChange={(e) => set(i, { connection_label: e.target.value })}
                placeholder="e.g., Primary"
                aria-label="Connection label"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-2">
              Demarcation / termination location
              <HelpTooltip helpText="Enter the exact room/entry where provider service terminates (e.g., Main IDF Room 101, MPOE South wall)." />
            </label>
            <input
              className="form-control"
              value={c.facility_entry_location}
              onChange={(e) => set(i, { facility_entry_location: e.target.value })}
              placeholder="e.g., Main IDF Room 101"
              aria-label="Facility entry location"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-2">
              Path independence / shared corridor
              <HelpTooltip helpText="Independent path means no shared corridor/entry with the other connection. Shared corridor indicates lower physical independence." />
            </label>
            <select
              className="form-control"
              value={c.shared_corridor_with_other_utilities}
              onChange={(e) => set(i, { shared_corridor_with_other_utilities: e.target.value as ItConnectionEntry['shared_corridor_with_other_utilities'] })}
              aria-label="Shared corridor with other utilities"
            >
              <option value="no">Independent path (not shared corridor)</option>
              <option value="yes">Shared corridor / shared entry (not independent)</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <button type="button" onClick={() => remove(i)} className="btn btn-secondary text-sm">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-secondary text-sm">Add connection</button>
    </div>
  );
}

function ItProtectionsEditor({ protections, onChange }: { protections: ItComponentProtection[]; onChange: (p: ItComponentProtection[]) => void }) {
  const add = () => onChange([...protections, { component_type: '', location: '', protection_type: '' }]);
  const remove = (i: number) => onChange(protections.filter((_, j) => j !== i));
  const set = (i: number, patch: Partial<ItComponentProtection>) => {
    const next = [...protections];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  return (
    <div className="mt-2 space-y-2">
      {protections.map((p, i) => (
        <div key={i} className="flex gap-2 flex-wrap items-center">
          <input className="form-control" value={p.component_type} onChange={(e) => set(i, { component_type: e.target.value })} placeholder="Component type" aria-label="Component type" />
          <input className="form-control" value={p.location} onChange={(e) => set(i, { location: e.target.value })} placeholder="Location" aria-label="Location" />
          <input className="form-control" value={p.protection_type} onChange={(e) => set(i, { protection_type: e.target.value })} placeholder="Protection type" aria-label="Protection type" />
          <button type="button" onClick={() => remove(i)} className="btn btn-secondary text-sm">Remove</button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-secondary text-sm">Add protection</button>
    </div>
  );
}

