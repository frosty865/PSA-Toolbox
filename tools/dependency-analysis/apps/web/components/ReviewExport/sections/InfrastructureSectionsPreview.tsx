'use client';

import React from 'react';
import type { Assessment, CategoryCode } from 'schema';
import type { ReportVM } from '@/app/lib/report/view_model';
import { VulnerabilityBlock } from '@/components/Report/VulnerabilityBlock';

const INFRASTRUCTURE_SECTIONS: Array<{
  key: string;
  title: string;
  color: string;
  categoryCode: CategoryCode;
}> = [
  { key: 'infrastructure_power', title: 'Electric Power', color: '#e31c3d', categoryCode: 'ELECTRIC_POWER' },
  { key: 'infrastructure_comms', title: 'Communications', color: '#0071bc', categoryCode: 'COMMUNICATIONS' },
  { key: 'infrastructure_it', title: 'Information Technology', color: '#007baa', categoryCode: 'INFORMATION_TECHNOLOGY' },
  { key: 'infrastructure_water', title: 'Water', color: '#00a91d', categoryCode: 'WATER' },
  { key: 'infrastructure_wastewater', title: 'Wastewater', color: '#773344', categoryCode: 'WASTEWATER' },
];

export function InfrastructureSectionsPreview({
  assessment,
  reportVM,
  expandedSections,
  toggleSection,
  showHelp,
}: {
  assessment: Assessment;
  reportVM: ReportVM | null;
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  showHelp: boolean;
}) {
  return (
    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
      {INFRASTRUCTURE_SECTIONS.map((infra) => (
        <div key={infra.key} className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              padding: 'var(--spacing-md)',
              marginBottom: expandedSections[infra.key] ? 'var(--spacing-md)' : 0,
              borderBottom: expandedSections[infra.key] ? '1px solid var(--cisa-gray-light)' : 'none',
              borderLeft: `4px solid ${infra.color}`,
            }}
            onClick={() => toggleSection(infra.key)}
          >
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>
              {infra.title}
            </h3>
            <span style={{ fontSize: '1.5rem' }}>{expandedSections[infra.key] ? '▼' : '▶'}</span>
          </div>

          {expandedSections[infra.key] && (
            <div style={{ padding: 'var(--spacing-md)' }}>
              <InfrastructureSectionContent infra={infra} assessment={assessment} reportVM={reportVM} showHelp={showHelp} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InfrastructureSectionContent({
  infra,
  assessment,
  reportVM,
  showHelp,
}: {
  infra: (typeof INFRASTRUCTURE_SECTIONS)[0];
  assessment: Assessment;
  reportVM: ReportVM | null;
  showHelp: boolean;
}) {
  // Category may store curve as curve_* or CategoryInput-style keys (from dependency questionnaires)
  const categoryData = assessment.categories?.[infra.categoryCode] as Record<string, unknown> | undefined;
  const curveRequiresService = categoryData?.curve_requires_service ?? categoryData?.requires_service;
  const timeToImpact = (categoryData?.curve_time_to_impact_hours ?? categoryData?.time_to_impact_hours) as number | undefined;
  const lossNoBackup = (categoryData?.curve_loss_fraction_no_backup ?? categoryData?.loss_fraction_no_backup) as number | undefined;
  const backupAvailable = categoryData?.curve_backup_available ?? categoryData?.has_backup_any ?? categoryData?.has_backup;
  const backupDuration = (categoryData?.curve_backup_duration_hours ?? categoryData?.backup_duration_hours) as number | undefined;
  const recoveryHours = (categoryData?.curve_recovery_time_hours ?? categoryData?.recovery_time_hours) as number | undefined;

  const profileItems = [
    { label: 'Requires Service', value: curveRequiresService === true || curveRequiresService === 'yes' ? 'Yes' : curveRequiresService === false || curveRequiresService === 'no' ? 'No' : '—' },
    { label: 'Time to Severe Impact', value: typeof timeToImpact === 'number' && !Number.isNaN(timeToImpact) ? `${timeToImpact} hours` : '—' },
    { label: 'Functional Degradation', value: typeof lossNoBackup === 'number' && !Number.isNaN(lossNoBackup) ? `${Math.round(lossNoBackup * 100)}%` : '—' },
    { label: 'Mitigation Available', value: backupAvailable === true || backupAvailable === 'yes' ? 'Yes' : backupAvailable === false || backupAvailable === 'no' ? 'No' : '—' },
    { label: 'Duration with Mitigation', value: typeof backupDuration === 'number' && !Number.isNaN(backupDuration) ? `${backupDuration} hours` : '—' },
    { label: 'Recovery Time', value: typeof recoveryHours === 'number' && !Number.isNaN(recoveryHours) ? `${recoveryHours} hours` : '—' },
  ];

  const infraSection = reportVM?.infrastructures?.find((i) => i.code === infra.categoryCode);
  const hasReportForSection = infraSection != null;
  const vulnerabilities = infraSection?.vulnerabilities ?? [];
  const whyThisMattersText = (() => {
    const seen = new Set<string>();
    const lines = vulnerabilities
      .map((v) => (v.why_this_matters ?? '').trim())
      .filter(Boolean)
      .filter((line) => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (lines.length > 0) return lines.slice(0, 2).join(' ');

    const metricParts: string[] = [];
    if (typeof timeToImpact === 'number' && !Number.isNaN(timeToImpact)) {
      metricParts.push(`severe impact can begin in ${timeToImpact} hour${timeToImpact === 1 ? '' : 's'}`);
    }
    if (typeof lossNoBackup === 'number' && !Number.isNaN(lossNoBackup)) {
      metricParts.push(`modeled loss can reach about ${Math.round(lossNoBackup * 100)}% without alternate capability`);
    }
    if (typeof recoveryHours === 'number' && !Number.isNaN(recoveryHours)) {
      metricParts.push(`recovery can require about ${recoveryHours} hour${recoveryHours === 1 ? '' : 's'}`);
    }
    if (metricParts.length === 0) return '';
    const closes: Record<CategoryCode, string> = {
      ELECTRIC_POWER: 'This narrows decision time to protect critical loads and maintain operational stability.',
      COMMUNICATIONS: 'This constrains coordination speed and can delay escalation across operational stakeholders.',
      INFORMATION_TECHNOLOGY: 'This increases risk of business application interruption and access-control friction.',
      WATER: 'This shortens the operating window for water-dependent functions under external service interruption.',
      WASTEWATER: 'This increases risk of early curtailment when wastewater handling capacity is constrained.',
      CRITICAL_PRODUCTS: 'This raises the likelihood of throughput disruption when supply conditions tighten.',
    };
    return `${infra.title}: ${metricParts.join('; ')}. ${closes[infra.categoryCode]}`;
  })();

  return (
    <div>
      {/* Dependency Profile — from assessment data only; no placeholders */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Dependency Profile
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
          {profileItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--cisa-gray-light)',
                borderRadius: 'var(--border-radius)',
              }}
            >
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
                {item.label}
              </p>
              <p style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0, color: infra.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Vulnerabilities — title + summary + up to 3 OFCs each */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
          Vulnerabilities
        </h4>
        {!hasReportForSection ? (
          <div
            style={{
              padding: 'var(--spacing-md)',
              borderLeft: `4px solid ${infra.color}`,
              backgroundColor: 'var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--color-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Complete the dependency assessment and run the report to see vulnerabilities for this infrastructure.
          </div>
        ) : vulnerabilities.length === 0 ? (
          <div
            style={{
              padding: 'var(--spacing-md)',
              borderLeft: `4px solid ${infra.color}`,
              backgroundColor: 'var(--cisa-gray-light)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--color-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            No vulnerabilities identified for this infrastructure based on provided inputs.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {vulnerabilities.map((v) => (
              <VulnerabilityBlock key={v.id} vuln={v} />
            ))}
          </div>
        )}
      </div>

      {whyThisMattersText && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--cisa-gray-light)',
            borderRadius: 'var(--border-radius)',
            borderLeft: `4px solid ${infra.color}`,
          }}
        >
          <h5 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
            Why This Matters
          </h5>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-secondary)', margin: 0, lineHeight: 1.6 }}>
            {whyThisMattersText}
          </p>
        </div>
      )}
    </div>
  );
}
