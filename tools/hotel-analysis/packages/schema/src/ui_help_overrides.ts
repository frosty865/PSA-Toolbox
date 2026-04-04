/**
 * Overrides may ONLY change help/examples. Never label or defaultValue.
 * Key format: "<CATEGORY_CODE>.<fieldKey>"
 * Compile-time: label and defaultValue are forbidden (never).
 */
export type UIHelpOverride = {
  help: string;
  examples?: string[];
  label?: never;
  defaultValue?: never;
};

export const UI_HELP_OVERRIDES: Record<string, UIHelpOverride> = {
  'ELECTRIC_POWER.time_to_impact_hours': {
    help: 'Override: hours until impact (0–72).',
    examples: ['24 = one day', '72 = three days'],
  },
};
