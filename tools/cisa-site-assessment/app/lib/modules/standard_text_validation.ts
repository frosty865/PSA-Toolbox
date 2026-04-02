/**
 * Standard Text Validation
 * 
 * Validates that standard criteria and OFC text does not contain
 * forbidden terms that drag standards into code compliance / technology prescription.
 * 
 * Standards must describe WHAT capability should exist (PSA-scope),
 * not HOW to implement or what the code says.
 */

export type ValidationError = { field: string; message: string };

const FORBIDDEN_TERMS = [
  // Regulatory / code audit language
  "code",
  "codes",
  "compliance",
  "ahj",
  "authority having jurisdiction",
  "nfpa",
  "ul",
  "nec",
  "iecc",
  "ibc",
  "ifc",
  "osha",
  // Manufacturer / vendor dependency
  "manufacturer",
  "vendor",
  "model number",
  "sku",
  // Overly prescriptive tech terms (keep capability-level)
  "sprinkler",
  "specific system",
  "dc fast charging",
  "de-energize",
  "fire-rated construction",
  "per local requirements",
  "per applicable",
  "in accordance with",
  "as required by",
];

/**
 * Validate standard text for forbidden terms
 * @param field - Field identifier (e.g., "criteria.EVP_001.question")
 * @param text - Text to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateStandardText(field: string, text: string): ValidationError[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const normalized = text.toLowerCase();
  const errors: ValidationError[] = [];

  for (const term of FORBIDDEN_TERMS) {
    // Use word boundaries to avoid false positives (e.g., "compliance" in "non-compliance")
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(normalized)) {
      errors.push({
        field,
        message: `Forbidden term in doctrine standard: "${term}". Standards must describe WHAT capability should exist (PSA-scope), not HOW to implement or what codes require.`,
      });
    }
  }

  return errors;
}

/**
 * Validate multiple standard text fields
 * @param fields - Array of { field, text } objects
 * @returns Array of all validation errors
 */
export function validateStandardTexts(
  fields: Array<{ field: string; text: string }>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const { field, text } of fields) {
    errors.push(...validateStandardText(field, text));
  }
  return errors;
}
