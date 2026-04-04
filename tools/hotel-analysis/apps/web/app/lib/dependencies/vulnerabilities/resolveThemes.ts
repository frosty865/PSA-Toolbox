/**
 * Dispatcher for theme-based findings.
 * Replaces raw "one trigger = one vulnerability" with 2–3 themed findings per dependency.
 */
import type { ThemeResolverInput, ThemedFinding } from './themeTypes';
import { resolveCommsThemes } from './theme_combiners/comms';
import { resolveEnergyThemes } from './theme_combiners/energy';
import { resolveItThemes } from './theme_combiners/it';
import { resolveWaterThemes } from './theme_combiners/water';
import { resolveWastewaterThemes } from './theme_combiners/wastewater';

export function resolveThemedFindings(input: ThemeResolverInput): ThemedFinding[] {
  switch (input.category) {
    case 'COMMUNICATIONS':
      return resolveCommsThemes(input);
    case 'INFORMATION_TECHNOLOGY':
      return resolveItThemes(input);
    case 'WATER':
      return resolveWaterThemes(input);
    case 'WASTEWATER':
      return resolveWastewaterThemes(input);
    case 'ENERGY':
      return resolveEnergyThemes(input);
    default:
      return [];
  }
}
