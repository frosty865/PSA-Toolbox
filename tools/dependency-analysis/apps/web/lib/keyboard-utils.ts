/**
 * Check if an event target is an editable text element (input, textarea, contenteditable).
 * Use before preventDefault for Space/Enter in buttons or clickable divs so we don't
 * block typing when the user is in a text field.
 */
export function isEditableTextElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const el = target;
  const tagName = el.tagName;
  if (tagName === 'TEXTAREA') return true;
  if (tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    return ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(type);
  }
  return el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '';
}
