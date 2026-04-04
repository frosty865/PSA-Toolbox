/**
 * Knowledge gap resolver for Information Technology (externally hosted services).
 */
import type { KnowledgeGap, GapResolverInput } from './gapTypes';
import { isNoOrUnknown, isYes } from '../vulnerabilities/themeUtils';

function hasItProviderInInput(input: GapResolverInput): boolean {
  const sources = input.categoryInput?.supply?.sources;
  if (Array.isArray(sources) && sources.some((s) => (s?.provider_name && String(s.provider_name).trim()) || (s?.service_provider && String(s.service_provider).trim())))
    return true;
  const it1 = (input.categoryInput as Record<string, unknown> | undefined)?.['IT-1_service_providers'];
  if (Array.isArray(it1) && it1.some((p: unknown) => (p as Record<string, unknown>)?.provider_name && String((p as Record<string, unknown>).provider_name).trim()))
    return true;
  if (it1 && typeof it1 === 'object' && !Array.isArray(it1))
    return Object.values(it1).some((p: unknown) => (p as Record<string, unknown>)?.provider_name && String((p as Record<string, unknown>).provider_name).trim());
  return false;
}

export function resolveItGaps(input: GapResolverInput): KnowledgeGap[] {
  const { answers } = input;
  const gaps: KnowledgeGap[] = [];

  if (isNoOrUnknown(answers['IT-1_can_identify_providers']) && !hasItProviderInInput(input)) {
    gaps.push({
      id: 'IT_PROVIDERS_NOT_IDENTIFIED',
      title: 'IT service providers not identified',
      description: 'External IT service provider(s) have not been identified.',
      question_ids: ['IT-1'],
      severity: 'HIGH',
    });
  } else if (hasItProviderInInput(input)) {
    const it4 = answers['IT-4_physically_separated'];
    if (it4 === 'unknown' || it4 == null) {
      gaps.push({
        id: 'IT_ROUTE_INDEPENDENCE_NOT_DOCUMENTED',
        title: 'Route independence not documented',
        description: 'Provider(s) are identified; physical separation and route independence are not confirmed.',
        question_ids: ['IT-4'],
        severity: 'MEDIUM',
      });
    }
  }

  const it2 = answers['IT-2_can_identify_assets'];
  if (it2 !== 'na') {
    const it2Assets = (answers['IT-2_upstream_assets'] as unknown[]) ?? [];
    const documentedCount = it2Assets.filter((row: unknown) => {
      if (row == null || typeof row !== 'object') return false;
      const r = row as Record<string, unknown>;
      const id = (r.service_id ?? '').toString().trim();
      if (id && id !== 'other') return true;
      if (id === 'other' && (r.service_other ?? '').toString().trim()) return true;
      const legacy = (r.asset_name_or_id ?? '').toString().trim();
      return !!legacy;
    }).length;
    if (isNoOrUnknown(it2) || (it2 === 'yes' && documentedCount === 0)) {
      gaps.push({
        id: 'IT_CRITICAL_EXTERNAL_SERVICES_UNKNOWN',
        title: 'Critical external services not identified',
        description: 'Critical externally hosted or managed digital services have not been identified.',
        question_ids: ['IT-2'],
        severity: 'MEDIUM',
      });
    }
  }

  if (answers['IT-3_multiple_connections'] === 'unknown') {
      gaps.push({
        id: 'IT_PROVIDER_CONCENTRATION_UNKNOWN',
        title: 'Provider concentration status unknown',
        description: 'Whether critical operations rely on a single external IT provider is unknown.',
        question_ids: ['IT-3'],
        severity: 'MEDIUM',
      });
  }

  const it8 = answers['IT-8_backup_available'];
  const it9 = answers['IT-9_sustainment_plan'];
  const it8Unknown = it8 === 'unknown' || it8 == null;
  const it9Unknown = it9 === 'unknown' || it9 == null;
  if (it8Unknown || it9Unknown) {
      gaps.push({
        id: 'IT_FALLBACK_AVAILABILITY_UNKNOWN',
        title: 'Fallback availability status unknown',
        description: 'Whether an alternate method exists or would remain available during widespread outages is unknown.',
        question_ids: ['IT-8', 'IT-9'],
        severity: 'MEDIUM',
      });
  }

  const planExists = isYes(answers['it_continuity_plan_exists']);
  const planExercised = answers['it_plan_exercised'];
  const exercisedNo =
    planExercised === 'no' ||
    planExercised === 'unknown' ||
    planExercised === 'yes_over_12_months_ago' ||
    planExercised == null;
  if (planExists && exercisedNo) {
    gaps.push({
      id: 'IT_CONTINUITY_NOT_EXERCISED_OR_UNKNOWN',
      title: 'IT continuity plan not exercised or status unknown',
      description: 'IT continuity or recovery plan exists but has not been exercised or status is unknown.',
      question_ids: ['it_plan_exercised'],
      severity: 'MEDIUM',
    });
  }

  return gaps.slice(0, 6); // cap at 6
}
