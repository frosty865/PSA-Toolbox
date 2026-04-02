/**
 * Standard class = structure (OBJECT vs PLAN), not topic.
 * Topic is module_code / module_title only.
 *
 * When kind is PLAN (e.g. PHYSICAL_SECURITY_PLAN), the authoritative assessment model
 * is defined in @/app/lib/plan-mode (PLAN_MODE_MODEL.md): Capability → Checklist Items → OFCs (unchecked only).
 */

export type ModuleStandardClass =
  | "PHYSICAL_SECURITY_MEASURES" // OBJECT
  | "PHYSICAL_SECURITY_PLAN"; // PLAN

export type ModuleKind = "OBJECT" | "PLAN";

export function kindFromStandardClass(
  sc: ModuleStandardClass | string | null | undefined
): ModuleKind {
  const v = (sc || "").toUpperCase().trim();
  if (v === "PHYSICAL_SECURITY_PLAN") return "PLAN";
  return "OBJECT";
}

export function defaultStandardClassForKind(
  kind: ModuleKind
): ModuleStandardClass {
  return kind === "PLAN" ? "PHYSICAL_SECURITY_PLAN" : "PHYSICAL_SECURITY_MEASURES";
}

/** True if key is a structural standard class (not a topic name). */
export function isStandardClassKey(key: string | null | undefined): boolean {
  const v = (key || "").toUpperCase().trim();
  return (
    v === "PHYSICAL_SECURITY_MEASURES" || v === "PHYSICAL_SECURITY_PLAN"
  );
}

/** True when standard is PLAN mode (formulaic plan assessment). Use plan-mode model for structure and quality gates. */
export function isPlanMode(standardKey: string | null | undefined): boolean {
  return kindFromStandardClass(standardKey) === "PLAN";
}
