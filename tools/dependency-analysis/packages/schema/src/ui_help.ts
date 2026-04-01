import type { CategoryCode } from './assessment';
import { UI_HELP_OVERRIDES } from './ui_help_overrides';

export interface FieldHelpResult {
  help: string | null;
  examples?: string[];
}

/**
 * Resolve final help for a field: overrides win over base (generated) help.
 * Returns { help, examples } for display; null help means no help to show.
 */
export function getFieldHelp(
  category: CategoryCode,
  fieldKey: string,
  baseHelp: string | null,
  baseExamples?: string[] | null
): FieldHelpResult {
  const overrideKey = `${category}.${fieldKey}`;
  const override = UI_HELP_OVERRIDES[overrideKey];
  if (override) {
    return {
      help: override.help,
      examples: override.examples && override.examples.length > 0 ? override.examples.slice(0, 3) : undefined,
    };
  }
  if (baseHelp != null && baseHelp.trim() !== '') {
    const examples =
      baseExamples && baseExamples.length > 0 ? baseExamples.slice(0, 3) : undefined;
    return { help: baseHelp.trim(), examples };
  }
  return { help: null, examples: undefined };
}
