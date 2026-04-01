'use client';

/**
 * Bridge: shows CrossDependenciesSection on Summary tab, works with both
 * legacy array and new CrossDependenciesNode format.
 */
import React from 'react';
import type { Assessment, CrossDependency, CrossDependenciesNode, CrossDependencyEdge } from 'schema';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { computeDerivedFlags } from '@/app/lib/cross-dependencies/deriveFlags';
import { CrossDependenciesSection } from './CrossDependenciesSection';

const INFRA = ['ELECTRIC_POWER', 'COMMUNICATIONS', 'INFORMATION_TECHNOLOGY', 'WATER', 'WASTEWATER'] as const;

function edgeToLegacy(e: CrossDependencyEdge): CrossDependency {
  const depType =
    e.purpose === 'primary_operations'
      ? 'primary_operations'
      : e.purpose === 'restoration_recovery'
        ? 'backup_systems'
        : e.purpose === 'monitoring_control'
          ? 'monitoring_control'
          : 'primary_operations';
  let hours: number | null = null;
  if (e.time_to_cascade_bucket === 'immediate') hours = 1;
  else if (e.time_to_cascade_bucket === 'short') hours = 4;
  else if (e.time_to_cascade_bucket === 'medium') hours = 12;
  else if (e.time_to_cascade_bucket === 'long') hours = 48;

  const toCat = INFRA.includes(e.to_category as (typeof INFRA)[number]) ? e.to_category : 'ELECTRIC_POWER';
  return {
    from_category: e.from_category,
    to_category: toCat as (typeof INFRA)[number],
    dependency_type: depType,
    description: e.notes ?? '',
    time_to_cascade_hours: hours,
  };
}

function legacyToEdge(leg: CrossDependency): CrossDependencyEdge {
  let bucket: CrossDependencyEdge['time_to_cascade_bucket'] = 'unknown';
  if (typeof leg.time_to_cascade_hours === 'number') {
    if (leg.time_to_cascade_hours <= 1) bucket = 'immediate';
    else if (leg.time_to_cascade_hours <= 6) bucket = 'short';
    else if (leg.time_to_cascade_hours <= 24) bucket = 'medium';
    else bucket = 'long';
  }
  const purpose =
    leg.dependency_type === 'primary_operations'
      ? 'primary_operations'
      : leg.dependency_type === 'backup_systems'
        ? 'restoration_recovery'
        : leg.dependency_type === 'monitoring_control'
          ? 'monitoring_control'
          : 'primary_operations';

  const fromCat = leg.from_category?.trim();
  return {
    from_category: (fromCat && (INFRA.includes(fromCat as (typeof INFRA)[number]) || fromCat === 'CRITICAL_PRODUCTS'))
      ? (fromCat as CrossDependencyEdge['from_category'])
      : 'ELECTRIC_POWER',
    to_category: INFRA.includes(leg.to_category as (typeof INFRA)[number])
      ? (leg.to_category as CrossDependencyEdge['to_category'])
      : 'ELECTRIC_POWER',
    purpose,
    criticality: 'critical',
    time_to_cascade_bucket: bucket,
    single_path: 'unknown',
    confidence: 'documented',
    notes: leg.description || undefined,
    source: 'user',
  };
}

export type CrossDependenciesSummaryBlockProps = {
  assessment: Assessment;
  onUpdate: (node: CrossDependenciesNode) => void;
};

export function CrossDependenciesSummaryBlock({ assessment, onUpdate }: CrossDependenciesSummaryBlockProps) {
  const node = getCrossDependenciesNode(assessment);

  // Edges that fit legacy section (both from and to in 5 infra; no CRITICAL_PRODUCTS in dropdowns)
  const infraEdges = node.edges.filter(
    (e) =>
      INFRA.includes(e.from_category as (typeof INFRA)[number]) &&
      INFRA.includes(e.to_category as (typeof INFRA)[number])
  );
  const otherEdges = node.edges.filter(
    (e) =>
      e.from_category === 'CRITICAL_PRODUCTS' ||
      e.to_category === 'CRITICAL_PRODUCTS'
  );

  const legacyList: CrossDependency[] = infraEdges.map(edgeToLegacy);

  const handleUpdate = (next: CrossDependency[]) => {
    const newEdges = next.map(legacyToEdge);
    const merged: CrossDependencyEdge[] = [...newEdges, ...otherEdges];
    const derived = computeDerivedFlags(merged);
    onUpdate({
      ...node,
      edges: merged,
      derived,
    });
  };

  return (
    <CrossDependenciesSection cross_dependencies={legacyList} onUpdate={handleUpdate} />
  );
}
