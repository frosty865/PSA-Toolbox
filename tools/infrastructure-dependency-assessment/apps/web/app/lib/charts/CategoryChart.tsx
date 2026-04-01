'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { CategoryChartData, PaceSeriesItem } from './chartService';
import { HORIZON_HOURS, CAPACITY_MIN, CAPACITY_MAX } from './chartService';

/** Chart height (px). Fixed height for stable layout; approximates 2.82:1 for ~620px width. */
const CHART_HEIGHT_PX = 220;
import type { PaceCurveSegment } from './communications_pace_curve';

type CurvePoint = { t_hours: number; capacity_pct: number };
type CurveSeries = {
  id: string;
  label?: string;
  points: CurvePoint[];
  hidden?: boolean;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

function buildUnifiedData(series: CurveSeries[]): Record<string, number>[] {
  const rows = new Map<number, Record<string, number>>();

  for (const s of series ?? []) {
    for (const p of s.points ?? []) {
      const t = Number(p.t_hours);
      const y = Number(p.capacity_pct ?? (p as { y?: number }).y ?? (p as { capacity?: number }).capacity);

      if (!Number.isFinite(t) || !Number.isFinite(y)) continue;

      let row = rows.get(t);
      if (!row) {
        row = { t_hours: t };
        rows.set(t, row);
      }

      row[s.id] = y;
    }
  }

  return Array.from(rows.values()).sort((a, b) => (a.t_hours ?? 0) - (b.t_hours ?? 0));
}
import { SlaMttrBadge } from '@/components/asset-dependency/SlaMttrBadge';
import { topicAnchorPrefix } from '@/app/lib/asset-dependency/priorityRestorationSchema';
import type { DependencyTopicKey, SlaFailureFlagKey } from '@/app/lib/asset-dependency/priorityRestorationSchema';

function paceLayerLabel(layer: PaceCurveSegment['layer']): string {
  switch (layer) {
    case 'P': return 'Primary';
    case 'A': return 'Alternate';
    case 'C': return 'Contingency';
    case 'E': return 'Emergency';
    case 'none': return 'No alternate';
    default: return String(layer);
  }
}

function findSegmentAt(segments: PaceCurveSegment[], tHours: number): PaceCurveSegment | undefined {
  return segments.find((s) => s.t_start <= tHours && tHours < s.t_end);
}

/** Color for PACE band legend swatch (matches segment identity). */
function paceSegmentFill(layer: PaceCurveSegment['layer']): string {
  switch (layer) {
    case 'P': return '#07a41e';
    case 'A': return '#0071bc';
    case 'C': return '#772162';
    case 'E': return '#e87500';
    case 'none': return '#5c5c5c';
    default: return '#ccc';
  }
}

export interface CategoryChartProps {
  title: string;
  data: CategoryChartData | null;
  /** When true, show placeholder message instead of chart */
  showPlaceholder?: boolean;
  placeholderMessage?: string;
  /** When provided, show SLA/MTTR-Max badge overlay and optional reliability stack. */
  slaBadge?: {
    enabled: boolean;
    mttrMaxHours: number | null;
    /** When false, show "SLA not assessed" and hide MTTR line + reliability stack. */
    slaAssessed?: boolean;
    failurePointCount?: number;
    topicKey?: DependencyTopicKey;
    gapFlagKeys?: SlaFailureFlagKey[];
    /** Programmatically generated SLA reliability summary (assessor or stakeholder). */
    slaSummaryText?: string;
  };
}

const PLACEHOLDER_MESSAGE = 'Complete required fields to display the curve.';

export function CategoryChart({
  title,
  data,
  showPlaceholder = false,
  placeholderMessage = PLACEHOLDER_MESSAGE,
  slaBadge,
}: CategoryChartProps) {
  const slaAssessed = slaBadge?.slaAssessed !== false;
  const badge = slaBadge ? (
    <SlaMttrBadge
      enabled={slaBadge.enabled}
      mttrMaxHours={slaBadge.mttrMaxHours}
      slaAssessed={slaBadge.slaAssessed}
      inline
    />
  ) : null;

  const slaHours =
    slaAssessed &&
    slaBadge?.enabled &&
    slaBadge?.mttrMaxHours != null &&
    Number.isFinite(slaBadge.mttrMaxHours)
      ? slaBadge.mttrMaxHours
      : null;

  const failureCount = slaBadge?.failurePointCount ?? 0;
  const gapFlagKeys = slaBadge?.gapFlagKeys ?? [];
  const topicKey = slaBadge?.topicKey;
  const slaSummaryText = slaBadge?.slaSummaryText;
  const showReliabilityStack = slaAssessed && slaHours != null && slaBadge?.enabled;

  if (showPlaceholder || !data || data.withoutBackup.length === 0) {
    return (
      <div className="chart-card w-full" style={{ padding: '1.25rem', border: '1px solid var(--cisa-gray-light)', borderRadius: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1rem', margin: 0, flex: '1 1 200px', minWidth: 0 }}>{title}</h3>
          {badge}
        </div>
        <p className="text-secondary" style={{ margin: 0 }}>{placeholderMessage}</p>
      </div>
    );
  }

  const paceMultiSeries = data.paceMultiSeries ?? [];
  const useMultiSeries = paceMultiSeries.length > 0;

  const [seriesVisibility, setSeriesVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of paceMultiSeries) {
      init[s.id] = s.defaultVisible;
    }
    return init;
  });

  const usePaceOnly = (data as Record<string, unknown>)?.usePaceOnly === true;

  const allSeries = useMemo((): CurveSeries[] => {
    if (usePaceOnly && useMultiSeries) {
      return paceMultiSeries.map((s) => ({
        id: s.dataKey ?? s.id,
        label: s.label,
        points: (s.points ?? []).map((p) => ({
          t_hours: p.t_hours ?? (p as { t?: number }).t ?? 0,
          capacity_pct: p.capacity_pct ?? (p as { capacity?: number }).capacity ?? 0,
        })),
        hidden: !seriesVisibility[s.id],
        stroke: s.stroke,
        strokeWidth: s.strokeWidth,
        strokeDasharray: s.id === 'effectiveMax' ? undefined : '4 2',
      }));
    }
    const base: CurveSeries[] = [
      {
        id: 'withoutBackup',
        label: data.legend.without,
        points: (data.withoutBackup ?? []).map((p) => ({
          t_hours: p.t_hours,
          capacity_pct: p.withoutBackup,
        })),
        stroke: 'var(--cisa-red, #cd2026)',
        strokeWidth: 2.5,
      },
      {
        id: 'withBackup',
        label: data.legend.with,
        points: (data.withBackup ?? []).map((p) => ({
          t_hours: p.t_hours,
          capacity_pct: p.withBackup,
        })),
        stroke: 'var(--cisa-green, #07a41e)',
        strokeWidth: 2.5,
        strokeDasharray: '6 3',
      },
    ];
    if (useMultiSeries) {
      for (const s of paceMultiSeries) {
        const dataKey = s.dataKey === 'effective' ? 'effective' : s.dataKey;
        base.push({
          id: dataKey,
          label: s.label,
          points: (s.points ?? []).map((p) => ({
            t_hours: p.t_hours ?? (p as { t?: number }).t ?? 0,
            capacity_pct: p.capacity_pct ?? (p as { capacity?: number }).capacity ?? 0,
          })),
          hidden: !seriesVisibility[s.id],
          stroke: s.stroke,
          strokeWidth: s.strokeWidth,
          strokeDasharray: s.id === 'effective' ? undefined : '4 2',
        });
      }
    }
    return base;
  }, [data.withoutBackup, data.withBackup, data.legend, useMultiSeries, usePaceOnly, paceMultiSeries, seriesVisibility]);

  const chartData = useMemo(() => buildUnifiedData(allSeries), [allSeries]);

  const paceSegments = data.paceSegments ?? [];
  const hasPaceSegments = paceSegments.length > 0 && !useMultiSeries;

  const toggleSeries = (id: string) => {
    setSeriesVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const tooltipContent = hasPaceSegments || useMultiSeries
    ? (props: TooltipProps<number, string>) => {
        const { active, payload, label } = props;
        if (!active || !payload?.length || label == null) return null;
        const tHours = typeof label === 'number' ? label : (payload[0]?.payload as { t_hours?: number } | undefined)?.t_hours;
        const numHours = typeof tHours === 'number' && Number.isFinite(tHours) ? tHours : null;
        const segment = !useMultiSeries && numHours != null ? findSegmentAt(paceSegments, numHours) : undefined;
        return (
          <div
            className="recharts-default-tooltip"
            style={{
              margin: 0,
              padding: '8px 12px',
              backgroundColor: 'var(--cisa-white, #fff)',
              border: '1px solid var(--cisa-gray-light, #ddd)',
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>Time: {label}h</p>
            {payload.map((entry) => (
              <p key={entry.dataKey} style={{ margin: 0, color: entry.color }}>
                {entry.name}: {entry.value}%
              </p>
            ))}
            {segment != null && (
              <p style={{ margin: '6px 0 0 0', fontWeight: 600, borderTop: '1px solid #eee', paddingTop: 6 }}>
                {paceLayerLabel(segment.layer)}: {segment.t_start}–{segment.t_end}h at {Math.round(segment.capacity)}%{segment.capped ? ' (capped)' : ''}
              </p>
            )}
          </div>
        );
      }
    : undefined;

  return (
    <div className="chart-card w-full" style={{ padding: '1.25rem', border: '1px solid var(--cisa-gray-light)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1rem', margin: 0, flex: '1 1 200px', minWidth: 0 }}>{title}</h3>
        {badge}
      </div>
      <div className="w-full" style={{ height: CHART_HEIGHT_PX }}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="#777777" strokeOpacity={0.14} strokeDasharray="3 3" />
          <XAxis
            dataKey="t_hours"
            type="number"
            domain={[0, HORIZON_HOURS]}
            ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96]}
            tickFormatter={(v) => `${v}h`}
            label={{ value: 'Time (hours)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            domain={[CAPACITY_MIN, CAPACITY_MAX]}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            tickFormatter={(v) => `${v}%`}
            width={36}
            label={{ value: 'Capacity %', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={tooltipContent as never}
            formatter={tooltipContent == null ? (value: number) => [`${value}%`, ''] : undefined}
            labelFormatter={tooltipContent == null ? (label: number) => `Time: ${label}h` : undefined}
          />
          {allSeries.map((s) => (
            <Line
              key={s.id}
              type="stepAfter"
              dataKey={s.id}
              name={s.label ?? s.id}
              stroke={s.stroke}
              strokeWidth={s.strokeWidth ?? 2}
              strokeDasharray={s.strokeDasharray}
              dot={false}
              hide={s.hidden}
            />
          ))}
          {slaHours != null && (
            <Line
              type="monotone"
              dataKey="sla"
              name="SLA Target"
              stroke="#e87500"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              data={[]}
              isAnimationActive={false}
            />
          )}
          {slaHours != null && (
            <ReferenceLine
              x={slaHours}
              stroke="#e87500"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{
                value: 'SLA: 100%',
                position: 'top',
                fill: '#e87500',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          )}
          {data?.activationDelayHours != null && data.activationDelayHours > 0 && (
            <ReferenceLine
              x={data.activationDelayHours}
              stroke="#07a41e"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              label={{
                value: 'Alternate engaged',
                position: 'top',
                fill: '#07a41e',
                fontSize: 10,
              }}
            />
          )}
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: '0.5rem' }}
            onClick={(e: unknown) => {
              if (!useMultiSeries) return;
              const payload = e as { dataKey?: string };
              const dataKey = payload?.dataKey ?? (typeof e === 'string' ? e : '');
              const s = paceMultiSeries.find((x) => x.dataKey === dataKey || x.label === dataKey);
              if (s) toggleSeries(s.id);
            }}
            formatter={(value, entry) => {
              const dataKey = entry?.dataKey != null ? String(entry.dataKey) : '';
              return (
              <span
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (useMultiSeries && dataKey) {
                    const s = paceMultiSeries.find((x) => x.dataKey === dataKey);
                    if (s) toggleSeries(s.id);
                  }
                }}
                onKeyDown={(ev) => {
                  if (useMultiSeries && (ev.key === 'Enter' || ev.key === ' ') && dataKey) {
                    ev.preventDefault();
                    const s = paceMultiSeries.find((x) => x.dataKey === dataKey);
                    if (s) toggleSeries(s.id);
                  }
                }}
                style={{ cursor: useMultiSeries ? 'pointer' : 'default', userSelect: 'none' }}
              >
                {value}
              </span>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
      {hasPaceSegments && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--cisa-gray-light)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600, color: 'var(--color-secondary)' }}>
            PACE steps (green line): Primary → Alternate → Contingency → Emergency
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {paceSegments.map((seg, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: paceSegmentFill(seg.layer),
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                {paceLayerLabel(seg.layer)} {seg.t_start}–{seg.t_end}h at {Math.round(seg.capacity)}%{seg.capped ? ' (capped)' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {(showReliabilityStack || slaSummaryText) && (
        <div
          className="sla-reliability-stack"
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--cisa-gray-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minWidth: 0,
          }}
        >
          {slaSummaryText != null && slaSummaryText !== '' && (
            <p className="text-secondary mb-0" style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.4, maxWidth: '100%' }}>
              {slaSummaryText}
            </p>
          )}
          {showReliabilityStack && slaSummaryText == null && (
          <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            {failureCount === 0
              ? 'SLA Reliability: No limitations identified'
              : `SLA Reliability: ${failureCount} condition${failureCount !== 1 ? 's' : ''} noted`}
          </span>
          )}
          {gapFlagKeys.length > 0 && (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {gapFlagKeys.map((flagKey, i) => {
                const anchorId = topicKey != null ? `${topicAnchorPrefix(topicKey)}-sla-flag-${flagKey}` : undefined;
                return (
                  <button
                    key={flagKey}
                    type="button"
                    title={`Scroll to ${flagKey}`}
                    aria-label={`Condition ${i + 1}: ${flagKey}`}
                    style={{
                      width: 12,
                      height: 12,
                      padding: 0,
                      border: 'none',
                      borderRadius: 0,
                      backgroundColor: '#e87500',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (anchorId && typeof document !== 'undefined') {
                        const el = document.getElementById(anchorId);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  />
                );
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
