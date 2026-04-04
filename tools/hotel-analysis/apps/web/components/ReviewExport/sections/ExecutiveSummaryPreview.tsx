'use client';

import React, { useMemo } from 'react';
import type { Assessment, CategoryCode } from 'schema';
import type { ReportVM } from '@/app/lib/report/view_model';
import type { CompletionResult } from '@/app/lib/assessment/completion';
import { getFirstMissingInfo } from '@/app/lib/assessment/completion';
import { ExecutiveRiskPostureSnapshot } from '@/components/review/ExecutiveRiskPostureSnapshot';
import { RiskPostureSnapshot } from '@/components/snapshot/RiskPostureSnapshot';
import { hasAnyCurveData, getCurveEmptyReason } from '@/app/lib/report/visual_analysis_predicates';
import { CHART_CATEGORIES, buildCategoryChartData, shouldShowChart } from '@/app/lib/charts/chartService';
import { mergeCurveIntoCategory } from '@/app/lib/curves/curve_accessors';
import { CategoryChart } from '@/app/lib/charts/CategoryChart';

const CATEGORY_TITLES: Record<CategoryCode, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

/**
 * Executive Summary Preview: Shows purpose/scope + Risk Posture Snapshot + Key Risk Drivers
 */
export function ExecutiveSummaryPreview({
  assessment,
  reportVM,
  completion,
  showHelp,
}: {
  assessment: Assessment;
  reportVM: ReportVM | null;
  completion: CompletionResult;
  showHelp: boolean;
}) {
  const categories = assessment.categories ?? {};
  const curveChartItems = useMemo(() => {
    return CHART_CATEGORIES.filter((code) => {
      const base = categories[code] ?? {};
      const input = mergeCurveIntoCategory(assessment, code, base);
      return shouldShowChart(code, input as Parameters<typeof shouldShowChart>[1]);
    }).map((code) => {
      const base = categories[code] ?? {};
      const input = mergeCurveIntoCategory(assessment, code, base);
      const data = buildCategoryChartData(code, input as Parameters<typeof buildCategoryChartData>[1]);
      const title = CATEGORY_TITLES[code];
      return { code, title, data };
    });
  }, [assessment, categories]);

  return (
    <div>
      {/* New Risk Posture Snapshot (if available) */}
      {reportVM?.executive?.risk_posture_snapshot && (
        <RiskPostureSnapshot snapshot={reportVM.executive.risk_posture_snapshot} />
      )}

      {/* Legacy Snapshot (if available) */}
      {reportVM?.snapshot && <ExecutiveRiskPostureSnapshot snapshot={reportVM.snapshot} />}

      {/* Purpose/Scope Statement */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <p style={{ fontSize: 'var(--font-size-md)', lineHeight: 1.6 }}>
          This assessment documents the operational dependency profile of the facility on external infrastructure
          systems and identifies key operational constraints and cascading risk pathways. The analysis is based on
                quantified disruption scenarios (96-hour model) and synthesizes facility-specific inputs with standardized
          operational thresholds.
        </p>
      </div>

      {/* Key Risk Drivers: real data only; no fake placeholders */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Key Risk Drivers
        </h4>
        {reportVM?.executive?.key_risk_drivers?.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
            {reportVM.executive.key_risk_drivers.map((driver, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--cisa-gray-light)',
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                  <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: 0, flex: 1 }}>
                    {driver.title}
                  </h5>
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: driver.severity === 'HIGH' ? 'var(--color-danger, #e31c3d)' : driver.severity === 'ELEVATED' ? '#fa9441' : '#fdb81e',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '3px',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      marginLeft: 'var(--spacing-sm)',
                    }}
                  >
                    {driver.severity}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary, #666)', margin: '0 0 var(--spacing-sm) 0' }}>
                  {driver.narrative}
                </p>
                {driver.infrastructures?.length ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {driver.infrastructures.map((infra) => (
                      <span
                        key={infra}
                        style={{ fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--cisa-gray-light)', padding: '0.25rem 0.5rem', borderRadius: '3px' }}
                      >
                        {infra.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : completion.isComplete ? (
          <div
            style={{
              border: '1px solid var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              backgroundColor: 'var(--color-background, #fff)',
              color: 'var(--color-secondary, #666)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Assessment complete. No drivers identified based on current inputs.
          </div>
        ) : (
          <div
            style={{
              border: '2px dashed var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              backgroundColor: 'var(--cisa-gray-light)',
              color: 'var(--color-secondary, #666)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {(() => {
              const first = getFirstMissingInfo(completion);
              return first
                ? `Missing required inputs in: ${first.sectorLabel}. Next missing: ${first.label}`
                : 'Complete the assessment to generate Key Risk Drivers.';
            })()}
          </div>
        )}
      </div>

      {/* Visual Analysis: curves only; cross-dependencies live on dedicated tab when enabled */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Visual Analysis
        </h4>
        <div style={{ width: '100%' }}>
          {hasAnyCurveData(assessment) ? (
            <div
              style={{
                border: '1px solid var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-lg)',
                backgroundColor: 'var(--color-background, #fff)',
                minHeight: '300px',
                width: '100%',
              }}
            >
              <p style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, margin: '0 0 var(--spacing-md) 0' }}>
                Operational Capability Curves
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary)', margin: '0 0 var(--spacing-md) 0' }}>
              96-hour disruption model per infrastructure.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                {curveChartItems.map(({ code, title, data }) => (
                  <CategoryChart
                    key={code}
                    title={`${title} Impact Curve`}
                    data={data}
                    showPlaceholder={false}
                    placeholderMessage="Not enough data yet."
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
                backgroundColor: 'var(--cisa-gray-light)',
                minHeight: '300px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <p style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, margin: '0 0 var(--spacing-sm) 0' }}>
                Operational Capability Curves
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary)', margin: 0 }}>
                {getCurveEmptyReason(assessment) || 'Complete reliance and curve inputs (e.g. time to impact, loss) to show curves.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
