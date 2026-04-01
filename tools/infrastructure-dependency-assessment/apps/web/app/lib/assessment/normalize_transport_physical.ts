/**
 * Normalize physical transport fields on load/save.
 * - Copies legacy building_entry_diversity → transport_building_entry_diversity (schema preprocess handles inside it_transport_resilience).
 * - Copies category.redundancy_activation.mode → it_transport_resilience.transport_failover_mode (category-level).
 * - Optionally sets transport_connection_count from legacy "multiple connections" ONLY when that boolean was explicitly captured; never from provider count.
 * Does NOT derive independence from provider count. Leaves UNKNOWN/null when not specified.
 */

import type { Assessment } from 'schema';

type TransportFailoverMode = 'AUTOMATIC' | 'MANUAL_ONSITE' | 'MANUAL_REMOTE' | 'UNKNOWN';

function mapRedundancyModeToTransportFailover(mode: string | undefined): TransportFailoverMode {
  if (mode === 'AUTOMATIC' || mode === 'MANUAL_ONSITE' || mode === 'MANUAL_REMOTE') return mode;
  return 'UNKNOWN';
}

export function normalizeTransportPhysical(assessment: Assessment): Assessment {
  const categories = assessment.categories ?? {};
  const itCat = categories.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  if (!itCat || typeof itCat !== 'object') return assessment;

  const transport = itCat.it_transport_resilience as Record<string, unknown> | undefined;
  if (!transport || typeof transport !== 'object') return assessment;

  const outTransport = { ...transport };
  let changed = false;

  // redundancy_activation is on category, not inside transport
  const ra = itCat.redundancy_activation as { mode?: string } | undefined;
  const mode = ra?.mode;
  if (mode != null && (outTransport.transport_failover_mode == null || outTransport.transport_failover_mode === 'UNKNOWN')) {
    outTransport.transport_failover_mode = mapRedundancyModeToTransportFailover(mode);
    changed = true;
  }

  // transport_connection_count: only from legacy circuit_count (already in schema preprocess) or from explicit IT-3_multiple_connections
  if (outTransport.transport_connection_count == null && outTransport.circuit_count == null) {
    const multipleConn = itCat['IT-3_multiple_connections'] ?? (itCat.answers as Record<string, unknown>)?.['IT-3_multiple_connections'];
    if (multipleConn === true || multipleConn === 'yes' || multipleConn === 'Yes') {
      outTransport.transport_connection_count = 2;
      changed = true;
    }
    // If multipleConn is false/no/unknown/absent, leave null — do NOT infer
  }

  if (!changed) return assessment;

  const outCategories = { ...categories };
  (outCategories as Record<string, unknown>).INFORMATION_TECHNOLOGY = { ...itCat, it_transport_resilience: outTransport };
  return { ...assessment, categories: outCategories };
}
