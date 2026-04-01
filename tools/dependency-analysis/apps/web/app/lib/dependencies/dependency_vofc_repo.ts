/**
 * Repository interface for dependency VOFC lookup.
 * WEB-ONLY: File-based lookup (local JSON) will be replaced with database API when available.
 */
import type { DepInfra } from './condition_codes';

export interface DependencyVofcRow {
  condition_code: string;
  infrastructure: DepInfra;
  vulnerability_text: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
  source_type: 'VOFC_XLS' | 'CISA_GUIDE' | 'NIST' | 'OTHER' | 'LIBRARY_RAG';
  source_reference: string;
  approved: boolean;
  version: string;
}

export interface DependencyVofcRepo {
  getApprovedByConditionCodes(codes: string[]): Promise<DependencyVofcRow[]>;
}
