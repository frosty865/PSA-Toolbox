'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/FieldLink';
import { useSearchParams } from 'next/navigation';
import { useAssessment } from '@/lib/assessment-context';
import { saveAssessmentToLocal } from '@/app/lib/io/assessmentStorage';
import { clearAllSessionsFromLocalStorage } from '@/app/lib/io/collectSessions';
import { UI_CONFIG } from 'schema';
import { getDefaultCategoryInput } from '@/lib/get-default-category-input';
import { getDefaultAssessment } from '@/lib/default-assessment';
import type { Assessment, CategoryCode, CategoryInput, CriticalProductRow } from 'schema';
import { SectionTabsShell } from '@/components/SectionTabsShell';
import { DependencySection } from '@/components/DependencySection';
import { CrossDependenciesTab } from '@/components/CrossDependenciesTab';
import { AssetInformationSection } from '@/components/AssetInformationSection';
import { ReviewExportPage } from '@/components/ReviewExport/ReviewExportPage';
import { SummaryTab } from '@/components/SummaryTab';
import { ProgressActions } from '@/components/ProgressActions';
import { EnergyQuestionnaireSection } from '@/app/assessment/dependencies/energy/EnergyQuestionnaireSection';
import { WaterQuestionnaireSection } from '@/app/assessment/dependencies/water/WaterQuestionnaireSection';
import { WastewaterQuestionnaireSection } from '@/app/assessment/dependencies/wastewater/WastewaterQuestionnaireSection';
import { ItQuestionnaireSection } from '@/app/assessment/dependencies/information_technology/ItQuestionnaireSection';
import { CommsQuestionnaireSection } from '@/app/assessment/dependencies/communications/CommsQuestionnaireSection';
import { ItTransportResilienceForm } from '@/components/ItTransportResilienceForm';
import { ItHostedResilienceChecklist, type DependencyRow } from '@/components/ItHostedResilienceChecklist';
import { getDigitalServiceOption } from '@/app/lib/catalog/digital_services_catalog';
import { isDependencyExcludedFromHostedResilience } from '@/app/lib/report/it/hosted_service_registry';
import type { ItTransportResilience, ItHostedResilience } from 'schema';
import { buildCategoryChartData, chartDataCacheKey, getCommsPaceCurveDebug, getPaceSystemTypeDisplayLabel, shouldShowChart } from '@/app/lib/charts/chartService';
import { CategoryChart } from '@/app/lib/charts/CategoryChart';
import { SECTION_TABS, type SectionTabId } from '@/app/lib/ui/tabs';
import {
  DEFAULT_PRIORITY_RESTORATION,
  getSlaMttrMaxHours,
  getTopicForBadge,
  hasSlaCommitment,
  countSlaFailurePoints,
  SLA_FAILURE_FLAG_KEYS,
  getDefaultSlaFailureFlags,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';
import type { DependencyTopicKey, PriorityRestoration, SlaFailureFlagKey } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import {
  clearDependentFields,
  DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE,
  DEPENDENTS_WHEN_HAS_BACKUP_FALSE,
} from '@/lib/clear-dependent-fields';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';
import { isCrossDependencyEnabled } from '@/lib/cross-dependency-enabled';
import { deriveCurveValuesFromCategoryInput } from '@/app/lib/assessment/normalize_curve_storage';
import { categoryCodeToInfrastructure, mergeCurveIntoCategory, setCurveValues } from '@/app/lib/curves/curve_accessors';
import { CisaCommandHero } from '@/components/CisaCommandHero';
import { IDA_TAXONOMY, getIdaSubsectors } from '@/lib/ida-taxonomy';

/**
 * Build dependency rows for the Hosted Services continuity block only.
 * Includes ONLY IT-2 upstream assets (externally hosted applications/SaaS). Excludes TRANSPORT_ISP kind.
 * IT-1 providers (MSP/ISP) are NOT included — continuity questions apply to hosted apps, not network providers.
 */
function buildItDependencyRowsFromInput(input: Record<string, unknown>): DependencyRow[] {
  const rows: DependencyRow[] = [];
  const upstream = (input['IT-2_upstream_assets'] as Array<Record<string, unknown>> | undefined) ?? [];
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

const DEPENDENCY_TAB_IDS: SectionTabId[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
];

const CURVE_TAB_IDS: SectionTabId[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

/** Map curve category code to priority restoration topic key for SLA badge. */
const CURVE_TAB_TO_TOPIC: Record<string, DependencyTopicKey> = {
  ELECTRIC_POWER: 'energy',
  COMMUNICATIONS: 'communications',
  INFORMATION_TECHNOLOGY: 'information_technology',
  WATER: 'water',
  WASTEWATER: 'wastewater',
};

const CATEGORY_CHART_TITLES: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

function isDependencyTab(id: SectionTabId): id is CategoryCode {
  return DEPENDENCY_TAB_IDS.includes(id);
}

function isCurveTab(id: SectionTabId): boolean {
  return CURVE_TAB_IDS.includes(id);
}

function composeMailingAddress(parts: {
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): string {
  return [
    parts.line1 ?? '',
    parts.line2 ?? '',
    parts.line3 ?? '',
    [parts.city ?? '', parts.state ?? '', parts.zip ?? ''].filter(Boolean).join(', '),
    parts.country ?? '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

const VALID_TAB_IDS = new Set(SECTION_TABS.map((t) => t.id));

function CategoriesPageContent() {
  const { assessment, setAssessment } = useAssessment();
  const searchParams = useSearchParams();
  const [activeTabId, setActiveTabId] = useState<SectionTabId>('ASSET_INFORMATION');
  const crossDependencyEnabled = isCrossDependencyEnabled(assessment);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Open tab from ?tab= (e.g. from export validation "go to missing data" link)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TAB_IDS.has(tab as SectionTabId)) {
      setActiveTabId(tab as SectionTabId);
    }
  }, [searchParams]);

  const visibleTabs = useMemo(
    () =>
      crossDependencyEnabled
        ? SECTION_TABS
        : SECTION_TABS.filter((t) => t.id !== 'CROSS_DEPENDENCIES'),
    [crossDependencyEnabled]
  );

  useEffect(() => {
    if (!crossDependencyEnabled && activeTabId === 'CROSS_DEPENDENCIES') {
      setActiveTabId('SUMMARY');
    }
  }, [crossDependencyEnabled, activeTabId]);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const energySaveRef = useRef<{ save: () => void } | null>(null);

  const updateCategory = useCallback(
    (category: CategoryCode, key: string, value: unknown) => {
      setAssessment((previous) => {
        const config = UI_CONFIG.find((c) => c.category === category);
        const prevCategory =
          previous.categories?.[category] ??
          (config ? getDefaultCategoryInput(config.fields, category) : {});
        let nextCategory: Record<string, unknown> = { ...prevCategory, [key]: value };
        if (key === 'requires_service' && value === false) {
          nextCategory = clearDependentFields(nextCategory, [...DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE]);
        }
        if ((key === 'has_backup_any' || key === 'has_backup') && value === false) {
          nextCategory = clearDependentFields(nextCategory, [...DEPENDENTS_WHEN_HAS_BACKUP_FALSE]);
        }

        let intermediate = previous;
        const infra = categoryCodeToInfrastructure(category);
        if (infra) {
          const curveUpdates = deriveCurveValuesFromCategoryInput(nextCategory as Partial<CategoryInput>);
          intermediate = setCurveValues(previous, infra, curveUpdates);
        }

        return {
          ...intermediate,
          categories: {
            ...intermediate.categories,
            [category]: nextCategory,
          },
        };
      });
    },
    [setAssessment]
  );

  const updateCriticalProducts = useCallback(
    (category: CategoryCode, rows: CriticalProductRow[]) => {
      updateCategory(category, 'critical_products', rows);
    },
    [updateCategory]
  );

  const updateAsset = useCallback(
    (patch: Partial<Assessment['asset']>) => {
      setAssessment({
        ...assessment,
        asset: { ...assessment.asset, ...patch },
      });
    },
    [assessment, setAssessment]
  );

  const mailingAddressLine1 = assessment.asset.mailing_address_line1 ?? '';
  const mailingAddressLine2 = assessment.asset.mailing_address_line2 ?? '';
  const mailingAddressLine3 = assessment.asset.mailing_address_line3 ?? '';
  const mailingCity = assessment.asset.mailing_city ?? '';
  const mailingState = assessment.asset.mailing_state ?? '';
  const mailingZip = assessment.asset.mailing_zip ?? '';
  const mailingCountry = assessment.asset.mailing_country ?? '';
  const composedMailingAddress = composeMailingAddress({
    line1: mailingAddressLine1,
    line2: mailingAddressLine2,
    line3: mailingAddressLine3,
    city: mailingCity,
    state: mailingState,
    zip: mailingZip,
    country: mailingCountry,
  });

  const autofillCoordinates = useCallback(async () => {
    const address = (assessment.asset.physical_address || assessment.asset.location || '').trim();
    if (!address) {
      setGeoError('Enter a physical address before auto-filling coordinates.');
      return;
    }
    const parts = address.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        updateAsset({
          facility_latitude: lat.toFixed(6),
          facility_longitude: lon.toFixed(6),
          location: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        });
        setGeoError(null);
        return;
      }
    }

    setGeoBusy(true);
    setGeoError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Geocoding failed (${response.status})`);
      }
      const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const first = results[0];
      if (!first?.lat || !first?.lon) {
        throw new Error('No coordinates found for that address');
      }
      updateAsset({
        facility_latitude: first.lat,
        facility_longitude: first.lon,
        location: `${first.lat}, ${first.lon}`,
      });
    } catch (error) {
      setGeoError(error instanceof Error ? error.message : 'Failed to geocode address');
    } finally {
      setGeoBusy(false);
    }
  }, [assessment.asset.location, assessment.asset.physical_address, updateAsset]);

  const updateCategoryForCurve = useCallback(
    (category: CategoryCode, categoryInput: CategoryInput) => {
      setAssessment((prev) => {
        let intermediate = prev;
        const infra = categoryCodeToInfrastructure(category);
        if (infra) {
          const curveUpdates = deriveCurveValuesFromCategoryInput(categoryInput);
          intermediate = setCurveValues(prev, infra, curveUpdates);
        }
        return {
          ...intermediate,
          categories: {
            ...intermediate.categories,
            [category]: categoryInput,
          },
        };
      });
    },
    [setAssessment]
  );

  const onElectricPowerCurveDataChange = useCallback(
    (categoryInput: CategoryInput) => updateCategoryForCurve('ELECTRIC_POWER', categoryInput),
    [updateCategoryForCurve]
  );
  const onWaterCurveDataChange = useCallback(
    (categoryInput: CategoryInput) => updateCategoryForCurve('WATER', categoryInput),
    [updateCategoryForCurve]
  );
  const onWastewaterCurveDataChange = useCallback(
    (categoryInput: CategoryInput) => updateCategoryForCurve('WASTEWATER', categoryInput),
    [updateCategoryForCurve]
  );
  const onItCurveDataChange = useCallback(
    (categoryInput: CategoryInput) => updateCategoryForCurve('INFORMATION_TECHNOLOGY', categoryInput),
    [updateCategoryForCurve]
  );
  const onCommsCurveDataChange = useCallback(
    (categoryInput: CategoryInput) => updateCategoryForCurve('COMMUNICATIONS', categoryInput),
    [updateCategoryForCurve]
  );

  // Electric Power now uses the standard dependency section layout like other tabs.

  const getBlockingError = useCallback(
    (tabId: SectionTabId): boolean => {
      if (tabId === 'ASSET_INFORMATION') {
        return !assessment.asset.asset_name.trim();
      }
      return false;
    },
    [assessment]
  );

  const renderContent = useCallback(
    (tabId: SectionTabId) => {
      if (tabId === 'ASSET_INFORMATION') {
        return (
          <AssetInformationSection asset={assessment.asset} onUpdate={updateAsset} />
        );
      }
      if (tabId === 'SUMMARY') {
        return <SummaryTab assessment={assessment} />;
      }
      if (tabId === 'CROSS_DEPENDENCIES') {
        return (
          <CrossDependenciesTab
            assessment={assessment}
            onUpdate={(node) =>
              setAssessment((prev) => ({ ...prev, cross_dependencies: node }))
            }
            setAssessment={setAssessment}
          />
        );
      }
      if (tabId === 'REVIEW_EXPORT') {
        return <ReviewExportPage />;
      }
      if (isDependencyTab(tabId)) {
        const praSlaEnabled = isPraSlaEnabled(assessment);
        const config = UI_CONFIG.find((c) => c.category === tabId)!;
        const defaults = getDefaultCategoryInput(config.fields, tabId as import('schema').CategoryCode);
        let data = { ...defaults, ...(assessment.categories?.[tabId] ?? {}) };
        if (isCurveTab(tabId)) {
          data = mergeCurveIntoCategory(assessment, tabId as CategoryCode, data);
        }
        const input = data as Record<string, unknown>;
        const chartData = isCurveTab(tabId)
          ? buildCategoryChartData(tabId as CategoryCode, input as import('schema').CategoryInput)
          : null;
        const showChart = isCurveTab(tabId) && shouldShowChart(tabId as CategoryCode, input as import('schema').CategoryInput);
        const chartTitle = CATEGORY_CHART_TITLES[tabId] ? `${CATEGORY_CHART_TITLES[tabId]} Impact Curve` : 'Impact Curve';
        const priorityRestoration = assessment.priority_restoration ?? DEFAULT_PRIORITY_RESTORATION;
        const topic = isCurveTab(tabId) ? CURVE_TAB_TO_TOPIC[tabId] : undefined;
        const topicData = topic != null ? getTopicForBadge(priorityRestoration as PriorityRestoration, topic) : null;
        // Prefer category agreements (tab form) for this tab's chart badge; fall back to Priority Restoration modal data
        const categoryAgreements = input.agreements as { has_sla?: boolean; sla_hours?: number | null } | undefined;
        const fromCategory = categoryAgreements?.has_sla === true;
        const categorySlaHours =
          fromCategory && categoryAgreements?.sla_hours != null && Number.isFinite(Number(categoryAgreements.sla_hours))
            ? Number(categoryAgreements.sla_hours)
            : null;
        const slaAssessed = fromCategory || (topicData?.sla_assessed ?? false);
        const hasSla = fromCategory || (topicData != null && hasSlaCommitment(topicData));
        const mttrHours = fromCategory ? categorySlaHours : (topicData != null ? getSlaMttrMaxHours(topicData) : null);
        const failurePointCount = topicData != null && hasSla ? countSlaFailurePoints(topicData) : 0;
        const gapFlagKeys: SlaFailureFlagKey[] =
          topicData != null && topicData.sla_failure_flags
            ? SLA_FAILURE_FLAG_KEYS.filter(
                (k) => (topicData.sla_failure_flags ?? getDefaultSlaFailureFlags())[k] !== 'yes'
              )
            : [];
        const slaBadge =
          praSlaEnabled && isCurveTab(tabId) && topic != null
            ? {
                enabled: hasSla,
                mttrMaxHours: mttrHours,
                slaAssessed,
                failurePointCount,
                topicKey: topic,
                gapFlagKeys,
              }
            : praSlaEnabled && isCurveTab(tabId)
              ? { enabled: hasSla, mttrMaxHours: mttrHours, slaAssessed, failurePointCount: 0, topicKey: undefined, gapFlagKeys: [] }
              : undefined;

        const dependencyKey = assessment.meta?.created_at_iso ?? 'init';
        return (
          <React.Fragment key={dependencyKey}>
            {tabId === 'ELECTRIC_POWER' ? (
              <>
                <EnergyQuestionnaireSection
                  embedded={true}
                  onCurveDataChange={onElectricPowerCurveDataChange}
                  existingElectricPowerCategory={input as Partial<CategoryInput>}
                  priorityRestoration={praSlaEnabled ? priorityRestoration : undefined}
                  onPriorityRestorationChange={
                    praSlaEnabled
                      ? (next) =>
                          setAssessment((prev) =>
                            ({ ...prev, priority_restoration: next } as Assessment)
                          )
                      : undefined
                  }
                  saveRef={energySaveRef}
                />
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                  </div>
                )}
              </>
            ) : tabId === 'WATER' ? (
              <>
                <WaterQuestionnaireSection
                  embedded={true}
                  onCurveDataChange={onWaterCurveDataChange}
                  existingWaterCategory={input as Partial<CategoryInput>}
                  priorityRestoration={praSlaEnabled ? priorityRestoration : undefined}
                  onPriorityRestorationChange={
                    praSlaEnabled
                      ? (next) =>
                          setAssessment((prev) =>
                            ({ ...prev, priority_restoration: next } as Assessment)
                          )
                      : undefined
                  }
                />
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                  </div>
                )}
              </>
            ) : tabId === 'WASTEWATER' ? (
              <>
                <WastewaterQuestionnaireSection
                  embedded={true}
                  onCurveDataChange={onWastewaterCurveDataChange}
                  existingWastewaterCategory={input as Partial<CategoryInput>}
                  priorityRestoration={praSlaEnabled ? priorityRestoration : undefined}
                  onPriorityRestorationChange={
                    praSlaEnabled
                      ? (next) =>
                          setAssessment((prev) =>
                            ({ ...prev, priority_restoration: next } as Assessment)
                          )
                      : undefined
                  }
                />
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                  </div>
                )}
              </>
            ) : tabId === 'INFORMATION_TECHNOLOGY' ? (
              <>
                <ItQuestionnaireSection
                  embedded={true}
                  onCurveDataChange={onItCurveDataChange}
                  existingItCategory={input as Partial<CategoryInput>}
                  priorityRestoration={praSlaEnabled ? priorityRestoration : undefined}
                  onPriorityRestorationChange={
                    praSlaEnabled
                      ? (next) =>
                          setAssessment((prev) =>
                            ({ ...prev, priority_restoration: next } as Assessment)
                          )
                      : undefined
                  }
                  praSlaEnabled={praSlaEnabled}
                />
                {/* Cyber / Continuity / Recovery — single block after IT questionnaire */}
                <section
                  className="card p-4 mb-4"
                  style={{ borderLeft: '4px solid var(--cisa-blue-lighter)' }}
                  aria-labelledby="it-cyber-continuity-heading"
                >
                  <h3 id="it-cyber-continuity-heading" className="text-lg font-semibold mb-4" style={{ color: 'var(--cisa-blue)' }}>
                    Cyber / Continuity / Recovery
                  </h3>
                  <fieldset className="mb-4 border-0 p-0">
                    <legend className="font-medium mb-2 text-base">
                      Does the facility maintain an information technology continuity or recovery plan
                      addressing prolonged service disruption or cyber incidents?
                    </legend>
                    <div className="radio-group-vertical">
                      {(['yes', 'no', 'unknown'] as const).map((val) => (
                        <div key={val} className="radio-option-item">
                          <label className="flex items-center gap-2 cursor-pointer min-h-[2rem]">
                            <input
                              type="radio"
                              name="it_continuity_plan_exists"
                              value={val}
                              checked={(input as Record<string, unknown>).it_continuity_plan_exists === val}
                              onChange={() => updateCategory('INFORMATION_TECHNOLOGY', 'it_continuity_plan_exists', val)}
                              className="w-4 h-4"
                              aria-label={`Plan exists: ${val}`}
                            />
                            <span className="capitalize">{val}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                  {(input as Record<string, unknown>).it_continuity_plan_exists === 'yes' && (
                    <>
                      <fieldset className="mb-4 pl-4 border-0 p-0" style={{ borderLeft: '2px solid var(--cisa-gray-light)' }}>
                        <legend className="font-medium mb-2 text-base">
                          Has the information technology continuity or recovery plan been exercised or tested?
                        </legend>
                        <div className="radio-group-vertical">
                          {[
                            { value: 'yes_within_12_months', label: 'Yes – within the last 12 months' },
                            { value: 'yes_over_12_months_ago', label: 'Yes – more than 12 months ago' },
                            { value: 'no', label: 'No' },
                            { value: 'unknown', label: 'Unknown' },
                          ].map(({ value, label }) => (
                            <div key={value} className="radio-option-item">
                              <label className="flex items-center gap-2 cursor-pointer min-h-[2rem]">
                                <input
                                  type="radio"
                                  name="it_plan_exercised"
                                  value={value}
                                  checked={(input as Record<string, unknown>).it_plan_exercised === value}
                                  onChange={() => updateCategory('INFORMATION_TECHNOLOGY', 'it_plan_exercised', value)}
                                  className="w-4 h-4"
                                  aria-label={label}
                                />
                                <span>{label}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </fieldset>
                      {String((input as Record<string, unknown>).it_plan_exercised ?? '').startsWith('yes_') && (
                        <fieldset className="mb-0 pl-4 border-0 p-0" style={{ borderLeft: '2px solid var(--cisa-gray-lighter)' }}>
                          <legend className="font-medium mb-2 text-base">
                            What was the scope of the most recent exercise or test?
                          </legend>
                          <div className="radio-group-vertical">
                            {[
                              { value: 'tabletop_discussion', label: 'Tabletop discussion' },
                              { value: 'functional_technical_test', label: 'Functional / technical test' },
                              { value: 'full_operational_exercise', label: 'Full operational exercise' },
                              { value: 'unknown', label: 'Unknown' },
                            ].map(({ value, label }) => (
                              <div key={value} className="radio-option-item">
                                <label className="flex items-center gap-2 cursor-pointer min-h-[2rem]">
                                  <input
                                    type="radio"
                                    name="it_exercise_scope"
                                    value={value}
                                    checked={(input as Record<string, unknown>).it_exercise_scope === value}
                                    onChange={() => updateCategory('INFORMATION_TECHNOLOGY', 'it_exercise_scope', value)}
                                    className="w-4 h-4"
                                    aria-label={label}
                                  />
                                  <span>{label}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    </>
                  )}
                </section>
                {(input as Record<string, unknown>).requires_service === true && (
                  <>
                    <ItTransportResilienceForm
                      value={(input as Record<string, unknown>).it_transport_resilience as ItTransportResilience | undefined}
                      onChange={(next) => updateCategory('INFORMATION_TECHNOLOGY', 'it_transport_resilience', next)}
                      requireCircuitCount
                    />
                    {buildItDependencyRowsFromInput(input as Record<string, unknown>).length > 0 && (
                      <ItHostedResilienceChecklist
                        dependencies={buildItDependencyRowsFromInput(input as Record<string, unknown>)}
                        value={(input as Record<string, unknown>).it_hosted_resilience as ItHostedResilience | undefined}
                        onChange={(next) => updateCategory('INFORMATION_TECHNOLOGY', 'it_hosted_resilience', next)}
                      />
                    )}
                  </>
                )}
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                  </div>
                )}
              </>
            ) : tabId === 'COMMUNICATIONS' ? (
              <>
                <CommsQuestionnaireSection
                  embedded={true}
                  onCurveDataChange={onCommsCurveDataChange}
                  existingCommsCategory={input as Partial<CategoryInput>}
                  priorityRestoration={praSlaEnabled ? priorityRestoration : undefined}
                  onPriorityRestorationChange={
                    praSlaEnabled
                      ? (next) =>
                          setAssessment((prev) =>
                            ({ ...prev, priority_restoration: next } as Assessment)
                          )
                      : undefined
                  }
                />
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                    <p className="text-xs text-secondary mt-2">
                      Lines show the retained coordination capacity over time for each method (Primary, Alternate, Contingency, Emergency).
                    </p>
                    {(() => {
                      const paceDebug = getCommsPaceCurveDebug(input as import('schema').CategoryInput);
                      return paceDebug ? (
                        <details className="mt-3 border rounded p-3" style={{ borderColor: 'var(--cisa-gray-light)' }}>
                          <summary className="cursor-pointer font-medium">How this curve was built</summary>
                          <div className="mt-2 text-sm space-y-2">
                            <p>Scenario: {paceDebug.scenario}. Layers with LIKELY_FAIL_REGIONAL or same upstream as failed Primary are excluded.</p>
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr>
                                  <th className="border p-1">Layer</th>
                                  <th className="border p-1">System type</th>
                                  <th className="border p-1">Sustain entered (h)</th>
                                  <th className="border p-1">Power scope</th>
                                  <th className="border p-1">Effective sustain (h)</th>
                                  <th className="border p-1">Capacity %</th>
                                  <th className="border p-1">Viability</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paceDebug.layers.map((row) => {
                                  const effective = row.effective_sustain_hours ?? row.sustain_hours;
                                  const capped = effective < row.sustain_hours;
                                  return (
                                    <tr key={row.layer}>
                                      <td className="border p-1">{row.layer}</td>
                                      <td className="border p-1">{getPaceSystemTypeDisplayLabel(row.system_type)} ({row.system_type})</td>
                                      <td className="border p-1">{row.sustain_hours}</td>
                                      <td className="border p-1">{row.power_scope_display ?? '—'}</td>
                                      <td className="border p-1">{capped ? `${effective} (capped)` : effective}</td>
                                      <td className="border p-1">{row.capacity_pct}</td>
                                      <td className="border p-1">{row.reason}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ) : null;
                    })()}
                  </div>
                )}
              </>
            ) : (
              <>
                <DependencySection
                  category={tabId}
                  data={input}
                  onUpdate={(key, value) => updateCategory(tabId, key, value)}
                  onCriticalProductsChange={(rows) => updateCriticalProducts(tabId, rows)}
                  showHelp={true}
                  praSlaEnabled={praSlaEnabled}
                  priorityRestoration={priorityRestoration}
                  onPriorityRestorationChange={(next) =>
                    setAssessment((prev) => ({ ...prev, priority_restoration: next } as Assessment))
                  }
                />
                {isCurveTab(tabId) && (
                  <div className="mt-4">
                    <CategoryChart
                      key={chartDataCacheKey(tabId as CategoryCode, input as import('schema').CategoryInput)}
                      title={chartTitle}
                      data={chartData}
                      showPlaceholder={!showChart}
                      placeholderMessage="Complete required fields to display the curve."
                      slaBadge={slaBadge}
                    />
                  </div>
                )}
              </>
            )}
          </React.Fragment>
        );
      }
      return null;
    },
    [
      assessment,
      updateCategory,
      updateCriticalProducts,
      updateAsset,
      crossDependencyEnabled,
      onElectricPowerCurveDataChange,
      onWaterCurveDataChange,
      onWastewaterCurveDataChange,
      onItCurveDataChange,
      onCommsCurveDataChange,
    ]
  );

  const handleClearSession = useCallback(() => {
    clearAllSessionsFromLocalStorage();
    setAssessment(getDefaultAssessment());
    setActiveTabId('ASSET_INFORMATION');
  }, [setAssessment]);

  const handleDependencySave = useCallback(() => {
    if (activeTabId === 'ELECTRIC_POWER') {
      energySaveRef.current?.save();
    }
    saveAssessmentToLocal(assessment);
    setSaveFeedback('Saved.');
    setTimeout(() => setSaveFeedback(null), 2500);
  }, [activeTabId, assessment]);

  const renderNavActions = useCallback(
    (tabId: SectionTabId) => {
      if (!DEPENDENCY_TAB_IDS.includes(tabId)) return null;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={handleDependencySave}>
            Save
          </button>
          {saveFeedback && <span className="text-success" style={{ fontSize: 'var(--font-size-sm)' }}>{saveFeedback}</span>}
        </div>
      );
    },
    [handleDependencySave, saveFeedback]
  );

  return (
    <main className="section active">
      <div style={{ marginBottom: '1.5rem' }}>
        <CisaCommandHero
          topbandSub="Infrastructure Dependency Assessment"
          eyebrow="Assessment command center"
          title="Infrastructure Dependency Assessment"
          subtitle="Enter dependency data by section to mirror workbook sheets, track completion, and move toward export-ready outputs. Your session persists in the browser while you work."
          cta={{ href: '#category-workspace', label: 'Start category data entry' }}
          chips={[
            { label: 'Browser session autosave', icon: 'sync' },
            { label: 'Report-ready workflow', icon: 'file' },
            { label: 'IDA', icon: 'shield' },
          ]}
          howItFits={[
            {
              title: 'Assess',
              body: 'Capture asset, dependency, and resilience inputs across electric, IT, water, wastewater, communications, and related sections.',
            },
            {
              title: 'Analyze',
              body: 'Use tabs and charts to validate entries, cross-dependencies, and summary views before export.',
            },
            {
              title: 'Deliver',
              body: 'Save progress locally and use the review/export path when the assessment is complete.',
            },
          ]}
        />
      </div>
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          border: '1px solid var(--cisa-gray-light)',
          borderRadius: '0.75rem',
          background: 'var(--cisa-white)',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--cisa-blue-dark)' }}>Required facility fields</h3>
        <p style={{ margin: '0 0 0.75rem 0', color: 'var(--cisa-gray-dark)' }}>
          Capture these fields before starting the dependency sections so the save JSON and report output stay aligned.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.9rem',
          }}
        >
          <div>
            <label className="form-label" htmlFor="ida-sector">Sector</label>
            <select
              id="ida-sector"
              className="form-control"
              value={assessment.asset.sector ?? ''}
              onChange={(e) => updateAsset({ sector: e.target.value || undefined, subsector: undefined })}
            >
              <option value="">Select a sector</option>
              {IDA_TAXONOMY.map((sector) => (
                <option key={sector.code} value={sector.name}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="ida-subsector">Subsector</label>
            <select
              id="ida-subsector"
              className="form-control"
              value={assessment.asset.subsector ?? ''}
              onChange={(e) => updateAsset({ subsector: e.target.value || undefined })}
              disabled={!assessment.asset.sector}
            >
              <option value="">{assessment.asset.sector ? 'Select a subsector' : 'Select a sector first'}</option>
              {getIdaSubsectors(assessment.asset.sector ?? '').map((subsector) => (
                <option key={subsector.code} value={subsector.name}>
                  {subsector.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="ida-physical-address">Physical Address</label>
            <textarea
              id="ida-physical-address"
              className="form-control"
              rows={4}
              value={composedMailingAddress || assessment.asset.physical_address || ''}
              onChange={(e) => updateAsset({ physical_address: e.target.value || undefined, location: e.target.value || undefined })}
              placeholder="Address lines, city, state, ZIP, country"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-address-line1">Address line 1</label>
            <input
              id="ida-address-line1"
              className="form-control"
              type="text"
              value={mailingAddressLine1}
              onChange={(e) => updateAsset({
                mailing_address_line1: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: e.target.value,
                  line2: mailingAddressLine2,
                  line3: mailingAddressLine3,
                  city: mailingCity,
                  state: mailingState,
                  zip: mailingZip,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="Street address"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-address-line2">Address line 2</label>
            <input
              id="ida-address-line2"
              className="form-control"
              type="text"
              value={mailingAddressLine2}
              onChange={(e) => updateAsset({
                mailing_address_line2: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: e.target.value,
                  line3: mailingAddressLine3,
                  city: mailingCity,
                  state: mailingState,
                  zip: mailingZip,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="Suite, building, PO box"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-address-line3">Address line 3</label>
            <input
              id="ida-address-line3"
              className="form-control"
              type="text"
              value={mailingAddressLine3}
              onChange={(e) => updateAsset({
                mailing_address_line3: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: mailingAddressLine2,
                  line3: e.target.value,
                  city: mailingCity,
                  state: mailingState,
                  zip: mailingZip,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="Department, attention, or additional line"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-city">City</label>
            <input
              id="ida-city"
              className="form-control"
              type="text"
              value={mailingCity}
              onChange={(e) => updateAsset({
                mailing_city: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: mailingAddressLine2,
                  line3: mailingAddressLine3,
                  city: e.target.value,
                  state: mailingState,
                  zip: mailingZip,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="City"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-state">State</label>
            <input
              id="ida-state"
              className="form-control"
              type="text"
              value={mailingState}
              onChange={(e) => updateAsset({
                mailing_state: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: mailingAddressLine2,
                  line3: mailingAddressLine3,
                  city: mailingCity,
                  state: e.target.value,
                  zip: mailingZip,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="State"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-zip">ZIP</label>
            <input
              id="ida-zip"
              className="form-control"
              type="text"
              value={mailingZip}
              onChange={(e) => updateAsset({
                mailing_zip: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: mailingAddressLine2,
                  line3: mailingAddressLine3,
                  city: mailingCity,
                  state: mailingState,
                  zip: e.target.value,
                  country: mailingCountry,
                }) || undefined,
              })}
              placeholder="ZIP"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-country">Country</label>
            <input
              id="ida-country"
              className="form-control"
              type="text"
              value={mailingCountry}
              onChange={(e) => updateAsset({
                mailing_country: e.target.value || undefined,
                physical_address: composeMailingAddress({
                  line1: mailingAddressLine1,
                  line2: mailingAddressLine2,
                  line3: mailingAddressLine3,
                  city: mailingCity,
                  state: mailingState,
                  zip: mailingZip,
                  country: e.target.value,
                }) || undefined,
              })}
              placeholder="United States"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-latitude">Latitude</label>
            <input
              id="ida-latitude"
              className="form-control"
              type="text"
              value={assessment.asset.facility_latitude ?? ''}
              onChange={(e) => updateAsset({ facility_latitude: e.target.value || undefined })}
              placeholder="Auto-populated"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="ida-longitude">Longitude</label>
            <input
              id="ida-longitude"
              className="form-control"
              type="text"
              value={assessment.asset.facility_longitude ?? ''}
              onChange={(e) => updateAsset({ facility_longitude: e.target.value || undefined })}
              placeholder="Auto-populated"
            />
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button type="button" className="btn btn-secondary" onClick={autofillCoordinates} disabled={geoBusy}>
              {geoBusy ? 'Retrieving…' : 'Auto-fill lat/long'}
            </button>
          </div>
        </div>
        {geoError ? <p className="small text-danger mt-2 mb-0">{geoError}</p> : null}
      </div>
      <div
        id="category-workspace"
        style={{
          backgroundColor: 'var(--cisa-gray-lighter, #f1f1f2)',
          paddingBottom: '1rem',
          marginBottom: '0.5rem',
          borderBottom: '1px solid var(--cisa-gray-light)',
        }}
      >
        <h2 className="section-title">Category data</h2>
        <p className="text-secondary mb-4">
          Enter dependency assessment data for each section. Use the tabs to match the workbook sheets.
        </p>

        <ProgressActions
          assessment={assessment}
          setAssessment={setAssessment}
          onLoadSuccess={() => setActiveTabId('SUMMARY')}
          onClear={handleClearSession}
        />
      </div>

      <SectionTabsShell
        key={assessment.meta.created_at_iso}
        tabs={visibleTabs}
        renderContent={renderContent}
        getBlockingError={getBlockingError}
        activeTabId={activeTabId}
        onTabChange={(tabId) => {
          saveAssessmentToLocal(assessment);
          setActiveTabId(tabId);
        }}
        renderNavActions={renderNavActions}
      />
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="section active"><p className="text-secondary">Loading…</p></div>}>
      <CategoriesPageContent />
    </Suspense>
  );
}
