/**
 * Question Presentation Logic
 * 
 * Determines how questions should be presented in the UI.
 */

import { isTechSelectorDiscipline } from '../capabilitySelectorConfig';

/**
 * Determine if a spine question should be rendered as an individual question card.
 * 
 * Rules:
 * - If discipline uses capability selector AND subtype_code is not null:
 *   return false (hidden; handled by capability selector)
 * - Else:
 *   return true (show as normal question)
 * 
 * NOTE: Discipline-level questions (subtype_code = null) always display.
 */
export function shouldRenderSpineAsQuestion(
  discipline_code: string | null | undefined,
  subtype_code: string | null | undefined
): boolean {
  // Discipline-level questions (no subtype) always render
  if (!subtype_code) {
    return true;
  }

  // If discipline uses tech capability selector, hide subtype spines
  if (isTechSelectorDiscipline(discipline_code)) {
    return false;
  }

  // Default: show as question
  return true;
}
