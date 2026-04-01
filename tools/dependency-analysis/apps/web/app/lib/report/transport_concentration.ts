/**
 * Physical transport concentration narrative.
 * Uses ONLY physical fields: transport_connection_count, transport_building_entry_diversity, transport_route_independence.
 *
 * LOGIC CONTRACT (provider diversity ≠ path diversity ≠ route independence):
 * - Provider count must NOT be used as evidence of path or route independence.
 * - When any transport field is present, narrative MUST reflect what is known (e.g. same entry, same POP).
 * - Use direct "unknown/unconfirmed" language for missing fields.
 */

export type TransportConcentrationInput = {
  transport_connection_count?: number | null;
  transport_building_entry_diversity?: 'SAME_ENTRY' | 'SEPARATE_ENTRY' | 'UNKNOWN';
  transport_route_independence?: 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNKNOWN';
  /** Optional: physical_path_diversity (e.g. same_conduit) for narrative. */
  physical_path_diversity?: { same_conduit?: boolean; same_pop?: boolean } | null;
  upstream_pop_diversity?: 'SAME_POP' | 'DIFFERENT_POP' | 'UNKNOWN';
};

/**
 * Returns a sentence describing transport concentration for IT (or Comms) narrative, or null when no concentration claim.
 * Reflects known fields; uses direct "unknown/unconfirmed" language for absent/UNKNOWN fields.
 */
export function describeTransportConcentration(input: TransportConcentrationInput): string | null {
  const count = input.transport_connection_count;
  const entry = input.transport_building_entry_diversity ?? 'UNKNOWN';
  const route = input.transport_route_independence ?? 'UNKNOWN';
  const pathDiv = input.physical_path_diversity;
  const sameConduit = pathDiv?.same_conduit === true;
  const popDiv = input.upstream_pop_diversity ?? 'UNKNOWN';

  if (count == null && entry === 'UNKNOWN' && route === 'UNKNOWN') {
    return 'Internet transport path diversity is unknown.';
  }

  if (count === 1) {
    return 'A single transport connection is present. Single-path dependency concentrates failure exposure.';
  }

  if (count != null && count >= 2) {
    if (route === 'CONFIRMED' && entry === 'SEPARATE_ENTRY') {
      return null;
    }
    const parts: string[] = ['Multiple transport connections are present.'];
    if (entry === 'SAME_ENTRY') parts.push('Same building entry.');
    else if (entry === 'SEPARATE_ENTRY') parts.push('Separate building entries.');
    if (sameConduit) parts.push('Same conduit.');
    if (popDiv === 'SAME_POP') parts.push('Same upstream POP.');
    else if (popDiv === 'DIFFERENT_POP') parts.push('Different upstream POPs.');
    if (route === 'UNKNOWN') parts.push('Route independence is unknown.');
    else if (route === 'NOT_CONFIRMED') parts.push('Route independence not confirmed.');
    parts.push('Concentrated failure exposure cannot be ruled out.');
    return parts.join(' ');
  }

  return null;
}

/**
 * Resolve transport concentration input from category data (IT or Comms).
 * Maps circuit_count (ONE/TWO/THREE_PLUS) to transport_connection_count when present so narrative reflects known data.
 */
export function getTransportConcentrationInput(categoryData: Record<string, unknown> | undefined): TransportConcentrationInput {
  if (!categoryData?.it_transport_resilience || typeof categoryData.it_transport_resilience !== 'object') {
    return {};
  }
  const tr = categoryData.it_transport_resilience as Record<string, unknown>;
  let count: number | null | undefined = tr.transport_connection_count as number | null | undefined;
  if (count == null && tr.circuit_count != null) {
    const cc = String(tr.circuit_count).toUpperCase();
    if (cc === 'ONE') count = 1;
    else if (cc === 'TWO') count = 2;
    else if (cc === 'THREE_PLUS') count = 3;
  }
  let entry = tr.transport_building_entry_diversity as TransportConcentrationInput['transport_building_entry_diversity'];
  if (entry == null && tr.building_entry_diversity != null) {
    const leg = tr.building_entry_diversity as string;
    entry = leg === 'SEPARATE_ENTRIES' ? 'SEPARATE_ENTRY' : (leg === 'SAME_ENTRY' || leg === 'UNKNOWN' ? leg : 'UNKNOWN');
  }
  const pathDiv = tr.physical_path_diversity as { same_conduit?: boolean; same_pop?: boolean } | undefined;
  const popDiv = (tr.upstream_pop_diversity as TransportConcentrationInput['upstream_pop_diversity']) ?? undefined;
  return {
    transport_connection_count: count,
    transport_building_entry_diversity: entry ?? 'UNKNOWN',
    transport_route_independence: (tr.transport_route_independence as TransportConcentrationInput['transport_route_independence']) ?? 'UNKNOWN',
    physical_path_diversity: pathDiv != null ? pathDiv : null,
    upstream_pop_diversity: popDiv,
  };
}
