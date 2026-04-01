/**
 * Dispatcher for knowledge gap resolution.
 */
import type { GapResolverInput, KnowledgeGap } from './gapTypes';
import { resolveCommsGaps } from './comms';
import { resolveEnergyGaps } from './energy';
import { resolveItGaps } from './it';
import { resolveWaterGaps } from './water';
import { resolveWastewaterGaps } from './wastewater';

export function resolveKnowledgeGaps(input: GapResolverInput): KnowledgeGap[] {
  switch (input.category) {
    case 'COMMUNICATIONS':
      return resolveCommsGaps(input);
    case 'INFORMATION_TECHNOLOGY':
      return resolveItGaps(input);
    case 'WATER':
      return resolveWaterGaps(input);
    case 'WASTEWATER':
      return resolveWastewaterGaps(input);
    case 'ENERGY':
      return resolveEnergyGaps(input);
    default:
      return [];
  }
}
