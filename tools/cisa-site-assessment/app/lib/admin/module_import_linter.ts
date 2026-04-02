/**
 * Module Import Linter - Hard Fail Rules
 * 
 * Validates module import payloads with strict rules:
 * - No baseline question/OFC references
 * - Module questions must be non-generic and discipline-anchored
 * - OFCs must not contain cyber-control terms
 * - All required fields must be present
 */

export type LinterResult = {
  ok: boolean;
  errors: string[];
};

export type ModuleQuestionInput = {
  id: string;
  text: string;
  order: number;
  discipline_id?: string;
  discipline_subtype_id?: string;
  asset_or_location?: string;
  event_trigger?: string;
};

export type ModuleOFCInput = {
  ofc_id: string;
  ofc_text: string;
  order_index: number;
  ofc_num?: number | null;
  source_system?: string | null;
  source_ofc_id?: string | null;
  source_ofc_num?: number | null;
  sources?: Array<{ url: string; label?: string | null }>;
};

export type RiskDriverInput = {
  driver_type: "CYBER_DRIVER" | "FRAUD_DRIVER";
  driver_text: string;
};

export type ModuleImportPayloadInput = {
  module_code?: string;
  title?: string;
  description?: string;
  import_source?: string;
  mode?: "REPLACE" | "APPEND";
  module_questions?: ModuleQuestionInput[];
  module_ofcs?: ModuleOFCInput[];
  risk_drivers?: RiskDriverInput[];
  // Legacy fields that should be rejected
  questions?: unknown;
  curated_ofcs?: unknown;
  baseline_references?: unknown;
};

// Generic question text patterns that should be rejected
const GENERIC_PATTERNS = [
  "supports physical security",
  "technology-enabled services",
  "abnormal conditions",
  "visitor processing",
];

// Cyber-control terms that should not appear in OFCs
const CYBER_CONTROL_TERMS = [
  "encryption",
  "2fa",
  "two-factor",
  "authentication",
  "network traffic",
  "packet",
  "malware",
  "ransomware",
  "soc",
  "ids",
  "ips",
  "segmentation",
];

// Event trigger enum
const EVENT_TRIGGERS = ["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"];

/**
 * Lint module import payload
 */
export function lintModuleImport(payload: ModuleImportPayloadInput): LinterResult {
  const errors: string[] = [];

  // A) Structural validation
  if (!payload.module_code || typeof payload.module_code !== "string") {
    errors.push("module_code is required and must be a string");
  } else if (!payload.module_code.startsWith("MODULE_")) {
    errors.push(`module_code must start with "MODULE_": ${payload.module_code}`);
  } else {
    // IST bulk import safeguard for EV charging module
    const importSource = (payload.import_source || "").toLowerCase();
    const isISTBulkImport = 
      importSource.includes("ist vofc") || 
      importSource.includes("ist_vofc") ||
      importSource.includes("html viewer") ||
      importSource.includes("bulk");
    
    if (payload.module_code.startsWith("MODULE_EV_") && isISTBulkImport) {
      const allowISTBulk = (payload as Record<string, unknown>).allow_ist_bulk === true;
      if (!allowISTBulk) {
        errors.push(
          `IST bulk imports are not allowed for ${payload.module_code} unless explicitly permitted. ` +
          `If this is intentional, add "allow_ist_bulk": true to the payload.`
        );
      }
    }
  }

  if (!payload.title || typeof payload.title !== "string" || payload.title.trim().length === 0) {
    errors.push("title is required and must be a non-empty string");
  }

  // Reject legacy fields
  if (payload.questions !== undefined) {
    errors.push('Legacy field "questions" is not allowed. Use "module_questions" instead.');
  }
  if (payload.curated_ofcs !== undefined) {
    errors.push('Legacy field "curated_ofcs" is not allowed. Use "module_ofcs" instead.');
  }
  if (payload.baseline_references !== undefined) {
    errors.push('Legacy field "baseline_references" is not allowed. Modules are additive and do not reference baseline.');
  }
  if ((payload as Record<string, unknown>).vulnerabilities !== undefined) {
    errors.push('Legacy field "vulnerabilities" is not allowed. Use "module_ofcs" and "risk_drivers" instead.');
  }

  // B) Module questions validation
  if (!Array.isArray(payload.module_questions)) {
    errors.push("module_questions must be an array");
  } else {
    // Require at least one question (can be relaxed if needed)
    if (payload.module_questions.length === 0) {
      errors.push("module_questions must contain at least one question");
    }

    payload.module_questions.forEach((q, idx) => {
      const prefix = `module_questions[${idx}]`;

      // ID validation
      if (!q.id || typeof q.id !== "string") {
        errors.push(`${prefix}.id is required and must be a string`);
      } else {
        if (!q.id.startsWith("MODULEQ_")) {
          errors.push(`${prefix}.id must start with "MODULEQ_": ${q.id}`);
        }
        if (q.id.includes("BASE-") || q.id.startsWith("BASE-")) {
          errors.push(`${prefix}.id cannot contain or start with "BASE-": ${q.id}`);
        }
      }

      // Text validation
      if (!q.text || typeof q.text !== "string" || q.text.trim().length === 0) {
        errors.push(`${prefix}.text is required and must be a non-empty string`);
      } else {
        const questionText = q.text.toLowerCase();
        const assetOrLocation = (q.asset_or_location || "").toLowerCase();

        // Check for generic patterns
        for (const pattern of GENERIC_PATTERNS) {
          if (questionText.includes(pattern.toLowerCase())) {
            // Exception: "abnormal conditions" is allowed if asset_or_location is specific (length >= 6) and appears in text
            if (pattern === "abnormal conditions") {
              if (assetOrLocation.length < 6 || !questionText.includes(assetOrLocation)) {
                errors.push(`${prefix}.text contains generic pattern "${pattern}" without specific asset/location context`);
              }
            }
            // Exception: "visitor processing" is allowed if module_code includes VISITOR
            else if (pattern === "visitor processing") {
              if (!payload.module_code?.includes("VISITOR")) {
                errors.push(`${prefix}.text contains generic pattern "${pattern}" (only allowed for VISITOR modules)`);
              }
            } else {
              errors.push(`${prefix}.text contains generic pattern "${pattern}"`);
            }
          }
        }

        // Check that asset_or_location appears in question text
        if (q.asset_or_location && q.asset_or_location.trim().length > 0) {
          const assetTokens = q.asset_or_location
            .toLowerCase()
            .split(/[\s\/,]+/)
            .filter((t) => t.length >= 4);
          
          if (assetTokens.length > 0) {
            const hasAssetInText = assetTokens.some((token) =>
              questionText.includes(token)
            );
            if (!hasAssetInText) {
              errors.push(
                `${prefix}.text must include at least one concrete noun from asset_or_location ("${q.asset_or_location}")`
              );
            }
          }
        }
      }

      // Order validation
      if (typeof q.order !== "number" || q.order < 0) {
        errors.push(`${prefix}.order must be a non-negative number`);
      }

      // Required ownership fields
      if (!q.discipline_id || typeof q.discipline_id !== "string") {
        errors.push(`${prefix}.discipline_id is required and must be a UUID string`);
      } else {
        // Basic UUID format check
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(q.discipline_id)) {
          errors.push(`${prefix}.discipline_id must be a valid UUID: ${q.discipline_id}`);
        }
      }

      if (!q.discipline_subtype_id || typeof q.discipline_subtype_id !== "string") {
        errors.push(`${prefix}.discipline_subtype_id is required and must be a UUID string`);
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(q.discipline_subtype_id)) {
          errors.push(`${prefix}.discipline_subtype_id must be a valid UUID: ${q.discipline_subtype_id}`);
        }
      }

      // Asset/location validation
      if (!q.asset_or_location || typeof q.asset_or_location !== "string" || q.asset_or_location.trim().length === 0) {
        errors.push(`${prefix}.asset_or_location is required and must be a non-empty string`);
      }

      // Event trigger validation
      if (!q.event_trigger || typeof q.event_trigger !== "string") {
        errors.push(`${prefix}.event_trigger is required`);
      } else if (!EVENT_TRIGGERS.includes(q.event_trigger)) {
        errors.push(`${prefix}.event_trigger must be one of: ${EVENT_TRIGGERS.join(", ")}`);
      }
    });
  }

  // C) Module OFCs validation
  if (payload.module_ofcs !== undefined) {
    if (!Array.isArray(payload.module_ofcs)) {
      errors.push("module_ofcs must be an array if present");
    } else {
      payload.module_ofcs.forEach((ofc, idx) => {
        const prefix = `module_ofcs[${idx}]`;

        if (!ofc.ofc_id || typeof ofc.ofc_id !== "string") {
          errors.push(`${prefix}.ofc_id is required and must be a string`);
        } else {
          // Reject IST_OFC IDs - modules must use module-specific IDs
          if (ofc.ofc_id.startsWith("IST_OFC_") || ofc.ofc_id.includes("IST_OFC_")) {
            errors.push(
              `${prefix}.ofc_id cannot use IST_OFC IDs (${ofc.ofc_id}). Modules must use module-specific IDs (e.g., MOD_OFC_EV_CHARGING_001).`
            );
          }
          // Enforce MOD_OFC prefix for module-owned OFCs
          if (!ofc.ofc_id.startsWith("MOD_OFC_")) {
            errors.push(
              `${prefix}.ofc_id must start with "MOD_OFC_" (module-owned OFCs). Got: ${ofc.ofc_id}`
            );
          }
        }

        if (!ofc.ofc_text || typeof ofc.ofc_text !== "string" || ofc.ofc_text.trim().length === 0) {
          errors.push(`${prefix}.ofc_text is required and must be a non-empty string`);
        } else {
          // Check for cyber-control terms
          const ofcTextLower = ofc.ofc_text.toLowerCase();
          for (const term of CYBER_CONTROL_TERMS) {
            if (ofcTextLower.includes(term.toLowerCase())) {
              errors.push(
                `${prefix}.ofc_text contains cyber-control term "${term}". Cyber controls are not allowed in PSA modules. Move to risk_drivers if this is context-only.`
              );
            }
          }
        }

        if (typeof ofc.order_index !== "number" || ofc.order_index < 0) {
          errors.push(`${prefix}.order_index must be a non-negative number`);
        }

        // Validate sources if present
        if (ofc.sources !== undefined) {
          if (!Array.isArray(ofc.sources)) {
            errors.push(`${prefix}.sources must be an array if present`);
          } else {
            ofc.sources.forEach((src, sIdx) => {
              // Allow empty URL if label exists (for reference-only sources)
              if (!src) {
                errors.push(`${prefix}.sources[${sIdx}] is required`);
              } else {
                // URL can be empty string if label exists
                if (src.url !== undefined && typeof src.url !== "string") {
                  errors.push(`${prefix}.sources[${sIdx}].url must be a string`);
                }
                // If URL is empty, label must exist
                if ((!src.url || src.url.trim().length === 0) && (!src.label || src.label.trim().length === 0)) {
                  errors.push(
                    `${prefix}.sources[${sIdx}] must have either url or label (or both)`
                  );
                }
              }
            });
          }
        }
      });
    }
  }

  // D) Risk drivers validation (optional but validate if present)
  if (payload.risk_drivers !== undefined) {
    if (!Array.isArray(payload.risk_drivers)) {
      errors.push("risk_drivers must be an array if present");
    } else {
      payload.risk_drivers.forEach((driver, idx) => {
        const prefix = `risk_drivers[${idx}]`;

        if (!driver.driver_type || !["CYBER_DRIVER", "FRAUD_DRIVER"].includes(driver.driver_type)) {
          errors.push(`${prefix}.driver_type must be "CYBER_DRIVER" or "FRAUD_DRIVER"`);
        }

        if (!driver.driver_text || typeof driver.driver_text !== "string" || driver.driver_text.trim().length === 0) {
          errors.push(`${prefix}.driver_text is required and must be a non-empty string`);
        }
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
