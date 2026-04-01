import { UI_CONFIG, getFieldHelp } from 'schema';
import type { CategoryCode } from 'schema';

/**
 * Build the assessor reference dump: category -> field -> { help, examples? }.
 * Used only for draft export (ui_help_dump.json); not in final report.
 */
export function buildUiHelpDump(): Record<string, Record<string, { help: string | null; examples?: string[] }>> {
  const dump: Record<string, Record<string, { help: string | null; examples?: string[] }>> = {};
  for (const cat of UI_CONFIG) {
    const categoryKey = cat.category as CategoryCode;
    dump[categoryKey] = {};
    for (const field of cat.fields) {
      const resolved = getFieldHelp(categoryKey, field.key, field.help, field.examples);
      dump[categoryKey][field.key] = {
        help: resolved.help,
        ...(resolved.examples?.length ? { examples: resolved.examples } : {}),
      };
    }
  }
  return dump;
}
