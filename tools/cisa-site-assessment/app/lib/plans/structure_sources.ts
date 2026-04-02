/**
 * Structure source allowlist for Active Assailant EAP.
 * Use simple includes() to avoid punctuation edge cases like "(Guide)".
 */

export function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

/**
 * True when title/label indicates a template or guide source for structure extraction
 * (e.g. "Active Shooter/Assailant Emergency Action Plan (Guide)", "Active Assailant EAP Template").
 */
export function isActiveAssailantStructureSource(titleOrLabel: string): boolean {
  const t = norm(titleOrLabel);

  const isPlanType = t.includes("active shooter") || t.includes("active assailant");
  if (!isPlanType) return false;

  const hasTemplate = t.includes("template");
  const hasGuide = t.includes("guide");
  return hasTemplate || hasGuide;
}
