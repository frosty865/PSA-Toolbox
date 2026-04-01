'use client';

import React, { useMemo, useEffect } from 'react';
import type { Assessment, CategoryCode, CategoryInput } from 'schema';
import { CHART_CATEGORIES, buildCategoryChartData, shouldShowChart, type CategoryChartData, type ChartDataPoint, type PaceSeriesItem } from '@/app/lib/charts/chartService';
import { mergeCurveIntoCategory } from '@/app/lib/curves/curve_accessors';
import { CategoryChart } from '@/app/lib/charts/CategoryChart';
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
import { getSlaReliabilityDerived, getSlaReliabilityDisplayText } from '@/app/lib/sla/slaReliabilitySummary';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

const CATEGORY_TITLES: Record<CategoryCode, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
  CRITICAL_PRODUCTS: 'Critical Products',
};

const CHART_CODE_TO_TOPIC: Record<string, DependencyTopicKey> = {
  ELECTRIC_POWER: 'energy',
  COMMUNICATIONS: 'communications',
  INFORMATION_TECHNOLOGY: 'information_technology',
  WATER: 'water',
  WASTEWATER: 'wastewater',
};

/** Normalize chart data so each point has t_hours, withoutBackup, withBackup (handles x/y or capacity_pct shapes). */
function normalizeChartData(data: CategoryChartData | null): CategoryChartData | null {
  if (!data) return null;
  const normPt = (p: Record<string, unknown>): ChartDataPoint => ({
    t_hours: Number(p.x ?? p.t_hours ?? p.t ?? 0),
    withoutBackup: Number(p.withoutBackup ?? p.capacity_without_backup ?? p.y ?? p.capacity_pct ?? p.capacity ?? 0),
    withBackup: Number(p.withBackup ?? p.capacity_with_backup ?? p.y ?? p.capacity_pct ?? p.capacity ?? 0),
  });
  const wb: ChartDataPoint[] = (data.withoutBackup ?? []).map((p) => normPt((p as Record<string, unknown>) ?? {}));
  const wib: ChartDataPoint[] = (data.withBackup ?? []).map((p) => normPt((p as Record<string, unknown>) ?? {}));
  const pace: PaceSeriesItem[] = (data.paceMultiSeries ?? []).map((s) => {
    const ser = s as PaceSeriesItem & Record<string, unknown>;
    const pts = (ser.points ?? ser.data ?? []) as Array<{ t_hours?: number; capacity_pct?: number; x?: number; y?: number; t?: number; capacity?: number }>;
    const dataNorm = pts.map((p) => ({
      t_hours: Number(p.x ?? p.t_hours ?? p.t ?? 0),
      capacity_pct: Number(p.y ?? p.capacity_pct ?? p.capacity ?? 0),
    }));
    return { ...ser, points: dataNorm };
  });
  return {
    ...data,
    withoutBackup: wb,
    withBackup: wib,
    paceMultiSeries: pace.length > 0 ? pace : data.paceMultiSeries,
  };
}

function KeyStatusLine({
  categoryCode,
  input,
}: {
  categoryCode: CategoryCode;
  input: Record<string, unknown> | undefined;
}) {
  const requiresService =
    input?.requires_service === true || input?.curve_requires_service === true;
  const hasBackup =
    input?.has_backup_any === true ||
    input?.has_backup === true ||
    input?.curve_backup_available === true ||
    input?.curve_backup_available === 'yes';
  const supply = input?.supply as { sources?: unknown[] } | undefined;
  const sourcesCount = Array.isArray(supply?.sources) ? supply.sources.length : null;

  const parts: string[] = [];
  parts.push(`Requires service: ${requiresService ? 'Yes' : 'No'}`);
  parts.push(`Has backup: ${hasBackup ? 'Yes' : 'No'}`);
  if (sourcesCount !== null) parts.push(`Sources: ${sourcesCount}`);

  return (
    <p className="text-secondary" style={{ fontSize: '0.8125rem', marginTop: '0.25rem', marginBottom: 0 }}>
      {parts.join(' · ')}
    </p>
  );
}

export interface SummaryTabProps {
  assessment: Assessment;
}

export function SummaryTab({ assessment }: SummaryTabProps) {
  const categories = assessment.categories ?? {};

  const praSlaEnabled = isPraSlaEnabled(assessment);
  const chartItems = useMemo(() => {
    return CHART_CATEGORIES.map((code) => {
      const base = categories[code] ?? {};
      const input = mergeCurveIntoCategory(assessment, code, base as Partial<CategoryInput>);
      const data = buildCategoryChartData(code, input as CategoryInput | undefined);
      const show = shouldShowChart(code, input as CategoryInput | undefined);
      const topic = CHART_CODE_TO_TOPIC[code];
      const pr = (assessment.priority_restoration ?? DEFAULT_PRIORITY_RESTORATION) as PriorityRestoration;
      const topicData = topic != null ? getTopicForBadge(pr, topic) : null;
      const slaAssessed = topicData?.sla_assessed ?? false;
      const hasSla = topicData != null && hasSlaCommitment(topicData);
      const failurePointCount = topicData != null && hasSla ? countSlaFailurePoints(topicData) : 0;
      const gapFlagKeys: SlaFailureFlagKey[] =
        topicData != null && topicData.sla_failure_flags
          ? SLA_FAILURE_FLAG_KEYS.filter(
              (k) => (topicData.sla_failure_flags ?? getDefaultSlaFailureFlags())[k] !== 'yes'
            )
          : [];
      const derived = topic != null ? getSlaReliabilityDerived(pr, topic) : undefined;
      const slaSummaryText = derived != null ? getSlaReliabilityDisplayText(derived, 'ASSESSOR') : undefined;
      const slaBadge =
        praSlaEnabled && topic != null
          ? {
              enabled: hasSla,
              mttrMaxHours: topicData != null ? getSlaMttrMaxHours(topicData) : null,
              slaAssessed,
              failurePointCount,
              topicKey: topic,
              gapFlagKeys,
              slaSummaryText,
            }
          : undefined;
      return { code, title: CATEGORY_TITLES[code], data, show, input: input as Record<string, unknown> | undefined, slaBadge };
    });
  }, [categories, assessment.priority_restoration, praSlaEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    try {
      const rows = chartItems.map(({ code, title, data, show }) => {
        const series =
          (data?.paceMultiSeries?.length ?? 0) > 0
            ? data?.paceMultiSeries
            : data
              ? [
                  { id: 'withoutBackup', points: data.withoutBackup },
                  { id: 'withBackup', points: data.withBackup },
                ]
              : [];
        const counts = (series ?? []).map((x: { id?: string; key?: string; label?: string; points?: unknown[]; data?: unknown[] }) => ({
          id: x.id ?? x.key ?? x.label ?? 'series',
          n: x.points?.length ?? x.data?.length ?? 0,
          sample: (x.points ?? x.data ?? []).slice?.(0, 2),
        }));
        return { code, title, counts, show, dataNull: !data, noPoints: data && (data.withoutBackup?.length ?? 0) === 0 && (data.withBackup?.length ?? 0) === 0 };
      });
      // eslint-disable-next-line no-console
      console.log('[SUMMARY CURVES] category series point counts:');
      for (const r of rows) {
        const line = r.counts.map((c: { id?: string; n?: number }) => `${c.id}:${c.n ?? 0}`).join(' | ');
        // eslint-disable-next-line no-console
        console.log(`  - ${r.code}: ${line}`);
      }
      const anyPoints = rows.some((r) => r.counts.some((c: { n?: number }) => (c.n ?? 0) > 0));
      // eslint-disable-next-line no-console
      console.log('[SUMMARY CURVES] anyPoints =', anyPoints);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SUMMARY CURVES] debug failed', e);
    }
  }, [chartItems]);

  return (
    <div className="summary-tab w-full">
      <div className="w-full max-w-4xl px-4 mx-auto">
        <p className="text-secondary mb-4">
          At a glance: impact curves for each dependency category. Complete required fields on each tab to see curves.
        </p>
        <div className="flex flex-col gap-6 mb-8">
          {chartItems.map(({ code, title, data, show, input, slaBadge }) => {
          const allEmpty = data && (data.withoutBackup?.length ?? 0) === 0 && (data.withBackup?.length ?? 0) === 0 && (data.paceMultiSeries?.length ?? 0) === 0;
          const placeholderMsg =
            allEmpty && process.env.NODE_ENV !== 'production'
              ? 'No curve points generated (missing required fields or invalid numeric values). See console: [SUMMARY CURVES]'
              : 'Not enough data yet.';
          return (
            <div key={code} className="w-full min-w-0">
              <CategoryChart
                title={`${title} Impact Curve`}
                data={normalizeChartData(data)}
                showPlaceholder={!show}
                placeholderMessage={placeholderMsg}
                slaBadge={slaBadge}
              />
              <KeyStatusLine categoryCode={code} input={input} />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
