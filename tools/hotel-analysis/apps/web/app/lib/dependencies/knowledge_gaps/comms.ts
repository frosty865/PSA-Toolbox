/**
 * Knowledge gap resolver for Communications.
 */
import type { KnowledgeGap, GapResolverInput } from './gapTypes';
import { isNoOrUnknown } from '../vulnerabilities/themeUtils';

function hasProviderInSupply(input: GapResolverInput): boolean {
  const sources = input.categoryInput?.supply?.sources;
  if (!Array.isArray(sources)) return false;
  return sources.some(
    (s) =>
      (s?.provider_name && String(s.provider_name).trim()) ||
      (s?.service_provider && String(s.service_provider).trim())
  );
}

function hasIndependenceUnknownInSupply(input: GapResolverInput): boolean {
  const sources = (input.categoryInput?.supply?.sources ?? []) as Array<{ independence?: string }>;
  if (!Array.isArray(sources) || sources.length === 0) return false;
  return sources.some((s) => s?.independence === 'UNKNOWN' || (s?.independence != null && String(s.independence).toUpperCase() === 'UNKNOWN'));
}

export function resolveCommsGaps(input: GapResolverInput): KnowledgeGap[] {
  const { answers } = input;
  const gaps: KnowledgeGap[] = [];

  if (isNoOrUnknown(answers['CO-1_can_identify_providers']) && !hasProviderInSupply(input)) {
    gaps.push({
      id: 'COMMS_PROVIDERS_NOT_IDENTIFIED',
      title: 'Communications providers not identified',
      description: 'Service provider(s) have not been identified or documented.',
      question_ids: ['CO-1'],
      severity: 'HIGH',
    });
  }
  if (hasProviderInSupply(input) && (hasIndependenceUnknownInSupply(input) || answers['CO-4_physically_separated'] === 'unknown' || answers['CO-4_physically_separated'] == null)) {
    gaps.push({
      id: 'COMMS_ROUTE_INDEPENDENCE_NOT_DOCUMENTED',
      title: 'Route independence not documented',
      description: 'Route independence not documented.',
      question_ids: ['CO-4'],
      severity: 'MEDIUM',
    });
  }

  const co9 = answers['CO-9_sustainment_plan'];
  const co9Unknown = co9 === 'unknown' || co9 == null;
  if (co9Unknown && !hasProviderInSupply(input)) {
    gaps.push({
      id: 'COMMS_DIVERSITY_UNKNOWN',
      title: 'Carrier diversity status unknown',
      description: 'Geographic separation or backup independence status is not documented.',
      question_ids: ['CO-4', 'CO-9'],
      severity: 'MEDIUM',
    });
  } else if (!hasProviderInSupply(input)) {
    const co4 = answers['CO-4_physically_separated'];
    const co4Unknown = co4 === 'unknown' || co4 == null;
    if (co4Unknown) {
      gaps.push({
        id: 'COMMS_DIVERSITY_UNKNOWN',
        title: 'Carrier diversity status unknown',
        description: 'Geographic separation or backup independence status is not documented.',
        question_ids: ['CO-4', 'CO-9'],
        severity: 'MEDIUM',
      });
    }
  }

  const co8 = answers['CO-8_backup_available'];
  const co8Capabilities = (answers['CO-8_backup_capabilities'] as unknown[]) ?? [];
  if (co8 === 'yes' && co8Capabilities.length === 0) {
    gaps.push({
      id: 'COMMS_BACKUP_DETAILS_UNKNOWN',
      title: 'Backup capability details not recorded',
      description: 'Alternate communications capability exists but details were not recorded.',
      question_ids: ['CO-8'],
      severity: 'LOW',
    });
  }

  if (answers['CO-11_restoration_coordination'] === 'unknown') {
    gaps.push({
      id: 'COMMS_RESTORATION_COORD_UNKNOWN',
      title: 'Restoration coordination status unknown',
      description: 'Coordination with the service provider for restoration is not documented.',
      question_ids: ['CO-11'],
      severity: 'MEDIUM',
    });
  }

  return gaps.slice(0, 6); // cap at 6
}
