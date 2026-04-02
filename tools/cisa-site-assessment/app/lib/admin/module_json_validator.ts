/**
 * Module JSON Validator & Auto-Corrector
 * 
 * Validates module import JSON and provides suggestions for fixing common mistakes.
 * Can be used both in UI (real-time validation) and as a standalone tool.
 */

export type ValidationIssue = {
  level: "error" | "warning" | "info";
  field: string;
  message: string;
  suggestion?: string;
  autoFixable?: boolean;
};

/** Mutable module-import-like object used during validation/fix. */
export type ModuleImportJson = {
  module_code?: string;
  title?: string;
  module_questions?: Array<Record<string, unknown>>;
  module_ofcs?: Array<Record<string, unknown>>;
  risk_drivers?: Array<Record<string, unknown>>;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  correctedJson?: ModuleImportJson;
};

/**
 * Common mistake patterns and their fixes
 */
const COMMON_FIXES: Array<{
  pattern: RegExp | ((value: unknown) => boolean);
  check: (json: ModuleImportJson) => ValidationIssue[];
  fix?: (json: ModuleImportJson) => ModuleImportJson;
}> = [
  // Invalid event triggers
  {
    pattern: () => true, // Always check
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      const validTriggers = ["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"];
      
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>, idx: number) => {
          if (q.event_trigger) {
            const triggerUpper = String(q.event_trigger).toUpperCase();
            if (!validTriggers.includes(triggerUpper)) {
              let suggested = "TAMPERING";
              if (triggerUpper === "SAFETY_EVENT" || triggerUpper === "EMERGENCY") {
                suggested = "OTHER";
              } else if (triggerUpper === "THEFT" || triggerUpper === "CRIMINAL_ACTIVITY") {
                suggested = "TAMPERING";
              }
              
              issues.push({
                level: "error",
                field: `module_questions[${idx}].event_trigger`,
                message: `Invalid event_trigger "${String(q.event_trigger)}". Valid options are: ${validTriggers.join(", ")}.`,
                suggestion: `Change to "${suggested}"`,
                autoFixable: true
              });
            }
          }
        });
      }
      return issues;
    },
    fix: (json: ModuleImportJson) => {
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>) => {
          const triggerUpper = String(q.event_trigger ?? "").toUpperCase();
          if (triggerUpper === "THEFT" || triggerUpper === "CRIMINAL_ACTIVITY") {
            q.event_trigger = "TAMPERING";
          } else if (triggerUpper === "SAFETY_EVENT" || triggerUpper === "EMERGENCY") {
            q.event_trigger = "OTHER";
          }
        });
      }
      return json;
    }
  },
  // Invalid risk driver types
  {
    pattern: (value: unknown) => typeof value === "string" && !["CYBER_DRIVER", "FRAUD_DRIVER"].includes(value),
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      if (Array.isArray(json.risk_drivers)) {
        json.risk_drivers.forEach((d: Record<string, unknown>, idx: number) => {
          if (d.driver_type && !["CYBER_DRIVER", "FRAUD_DRIVER"].includes(String(d.driver_type))) {
            let suggested = "CYBER_DRIVER";
            const text = String(d.driver_text ?? "").toLowerCase();
            if (text.includes("theft") || text.includes("fraud") || text.includes("skimming") || text.includes("property crime")) {
              suggested = "FRAUD_DRIVER";
            } else if (text.includes("hacking") || text.includes("unauthorized access") || text.includes("cyber")) {
              suggested = "CYBER_DRIVER";
            }
            issues.push({
              level: "error",
              field: `risk_drivers[${idx}].driver_type`,
              message: `Invalid driver_type "${String(d.driver_type)}". Must be "CYBER_DRIVER" or "FRAUD_DRIVER".`,
              suggestion: `Change to "${suggested}"`,
              autoFixable: true
            });
          }
        });
      }
      return issues;
    },
    fix: (json: ModuleImportJson) => {
      if (Array.isArray(json.risk_drivers)) {
        json.risk_drivers.forEach((d: Record<string, unknown>) => {
          if (d.driver_type && !["CYBER_DRIVER", "FRAUD_DRIVER"].includes(String(d.driver_type))) {
            const text = String(d.driver_text ?? "").toLowerCase();
            if (text.includes("theft") || text.includes("fraud") || text.includes("skimming") || text.includes("property crime")) {
              d.driver_type = "FRAUD_DRIVER";
            } else {
              d.driver_type = "CYBER_DRIVER";
            }
          }
        });
      }
      return json;
    }
  },
  // Placeholder UUIDs
  {
    pattern: (value: unknown) => typeof value === "string" && /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value),
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>, idx: number) => {
          if (q.discipline_id && /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(String(q.discipline_id))) {
            issues.push({
              level: "error",
              field: `module_questions[${idx}].discipline_id`,
              message: "Placeholder UUID detected. Replace with actual discipline UUID from database.",
              suggestion: "Run 'node scripts/get_discipline_uuids_for_modules.js' to get valid UUIDs",
              autoFixable: false
            });
          }
          if (q.discipline_subtype_id && /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(String(q.discipline_subtype_id))) {
            issues.push({
              level: "error",
              field: `module_questions[${idx}].discipline_subtype_id`,
              message: "Placeholder UUID detected. Replace with actual subtype UUID from database.",
              suggestion: "Run 'node scripts/get_discipline_uuids_for_modules.js' to get valid UUIDs",
              autoFixable: false
            });
          }
        });
      }
      return issues;
    }
  },
  // Question IDs not starting with MODULEQ_
  {
    pattern: (value: unknown) => typeof value === "string" && value.startsWith("BASE-"),
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>, idx: number) => {
          const id = q.id != null ? String(q.id) : undefined;
          if (id && id.startsWith("BASE-")) {
            issues.push({
              level: "error",
              field: `module_questions[${idx}].id`,
              message: `Question ID "${id}" starts with "BASE-" which is not allowed. Module questions must use "MODULEQ_" prefix.`,
              suggestion: `Change to "MODULEQ_${id.replace("BASE-", "").replace(/^MODULE_/, "")}"`,
              autoFixable: true
            });
          } else if (id && !id.startsWith("MODULEQ_")) {
            issues.push({
              level: "error",
              field: `module_questions[${idx}].id`,
              message: `Question ID "${id}" must start with "MODULEQ_"`,
              suggestion: `Change to "MODULEQ_${id}"`,
              autoFixable: true
            });
          }
        });
      }
      return issues;
    },
    fix: (json: ModuleImportJson) => {
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>) => {
          const id = q.id != null ? String(q.id) : undefined;
          if (id && id.startsWith("BASE-")) {
            q.id = `MODULEQ_${id.replace("BASE-", "").replace(/^MODULE_/, "")}`;
          } else if (id && !id.startsWith("MODULEQ_")) {
            q.id = `MODULEQ_${id}`;
          }
        });
      }
      return json;
    }
  },
  // OFC IDs not starting with MOD_OFC_
  {
    pattern: (value: unknown) => typeof value === "string" && (value.startsWith("IST_OFC_") || value.startsWith("BASE-")),
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      if (Array.isArray(json.module_ofcs)) {
        json.module_ofcs.forEach((o: Record<string, unknown>, idx: number) => {
          const ofcId = o.ofc_id != null ? String(o.ofc_id) : undefined;
          if (ofcId && (ofcId.startsWith("IST_OFC_") || ofcId.startsWith("BASE-"))) {
            issues.push({
              level: "error",
              field: `module_ofcs[${idx}].ofc_id`,
              message: `OFC ID "${ofcId}" uses invalid prefix. Module OFCs must use "MOD_OFC_" prefix.`,
              suggestion: `Change to "MOD_OFC_${ofcId.replace(/^(IST_OFC_|BASE-)/, "").replace(/^MODULE_/, "")}"`,
              autoFixable: true
            });
          } else if (ofcId && !ofcId.startsWith("MOD_OFC_")) {
            issues.push({
              level: "error",
              field: `module_ofcs[${idx}].ofc_id`,
              message: `OFC ID "${ofcId}" must start with "MOD_OFC_"`,
              suggestion: `Change to "MOD_OFC_${ofcId}"`,
              autoFixable: true
            });
          }
        });
      }
      return issues;
    },
    fix: (json: ModuleImportJson) => {
      if (Array.isArray(json.module_ofcs)) {
        json.module_ofcs.forEach((o: Record<string, unknown>) => {
          const ofcId = o.ofc_id != null ? String(o.ofc_id) : undefined;
          if (ofcId && (ofcId.startsWith("IST_OFC_") || ofcId.startsWith("BASE-"))) {
            o.ofc_id = `MOD_OFC_${ofcId.replace(/^(IST_OFC_|BASE-)/, "").replace(/^MODULE_/, "")}`;
          } else if (ofcId && !ofcId.startsWith("MOD_OFC_")) {
            o.ofc_id = `MOD_OFC_${ofcId}`;
          }
        });
      }
      return json;
    }
  },
  // Missing required fields
  {
    pattern: () => true, // Always check
    check: (json: ModuleImportJson) => {
      const issues: ValidationIssue[] = [];
      
      // Check module_code
      const moduleCode = json.module_code;
      if (!moduleCode) {
        issues.push({
          level: "error",
          field: "module_code",
          message: "module_code is required",
          autoFixable: false
        });
      } else if (!String(moduleCode).startsWith("MODULE_")) {
        issues.push({
          level: "error",
          field: "module_code",
          message: `module_code must start with "MODULE_"`,
          suggestion: `Change to "MODULE_${moduleCode}"`,
          autoFixable: true
        });
      }
      
      // Check title
      const title = json.title;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        issues.push({
          level: "error",
          field: "title",
          message: "title is required and must be a non-empty string",
          autoFixable: false
        });
      }
      
      // Check module_questions
      if (Array.isArray(json.module_questions)) {
        json.module_questions.forEach((q: Record<string, unknown>, idx: number) => {
          const prefix = `module_questions[${idx}]`;
          const qText = q.text;
          const qAsset = q.asset_or_location;
          if (!q.id) {
            issues.push({
              level: "error",
              field: `${prefix}.id`,
              message: "id is required",
              autoFixable: false
            });
          }
          if (!qText || typeof qText !== "string" || qText.trim().length === 0) {
            issues.push({
              level: "error",
              field: `${prefix}.text`,
              message: "text is required and must be a non-empty string",
              autoFixable: false
            });
          }
          if (!q.discipline_id) {
            issues.push({
              level: "error",
              field: `${prefix}.discipline_id`,
              message: "discipline_id is required",
              autoFixable: false
            });
          }
          if (!q.discipline_subtype_id) {
            issues.push({
              level: "error",
              field: `${prefix}.discipline_subtype_id`,
              message: "discipline_subtype_id is required",
              autoFixable: false
            });
          }
          if (!qAsset || typeof qAsset !== "string" || qAsset.trim().length === 0) {
            issues.push({
              level: "error",
              field: `${prefix}.asset_or_location`,
              message: "asset_or_location is required and must be a non-empty string",
              autoFixable: false
            });
          }
          if (!q.event_trigger) {
            issues.push({
              level: "error",
              field: `${prefix}.event_trigger`,
              message: "event_trigger is required",
              autoFixable: false
            });
          }
        });
      }
      return issues;
    }
  }
];

/**
 * Validate and optionally auto-correct module import JSON
 */
export function validateModuleJson(
  json: unknown,
  autoFix: boolean = false
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let correctedJson: ModuleImportJson | null = null;
  
  if (!json || typeof json !== "object") {
    return {
      valid: false,
      issues: [{
        level: "error",
        field: "root",
        message: "Invalid JSON: must be an object",
        autoFixable: false
      }]
    };
  }
  correctedJson = JSON.parse(JSON.stringify(json)) as ModuleImportJson; // Deep clone
  
  // Run all checks - collect all issues
  for (const fix of COMMON_FIXES) {
    const checkIssues = fix.check(correctedJson);
    if (checkIssues.length > 0) {
      issues.push(...checkIssues);
      
      // Apply fix if auto-fixable and requested
      if (autoFix && fix.fix) {
        const hasAutoFixable = checkIssues.some(i => i.autoFixable);
        if (hasAutoFixable) {
          correctedJson = fix.fix(correctedJson);
        }
      }
    }
  }
  
  // Check for duplicate question IDs
  if (Array.isArray(correctedJson.module_questions)) {
    const questionIds = new Set<string>();
    correctedJson.module_questions.forEach((q: Record<string, unknown>, idx: number) => {
      const id = q.id != null ? String(q.id) : undefined;
      if (id) {
        if (questionIds.has(id)) {
          issues.push({
            level: "error",
            field: `module_questions[${idx}].id`,
            message: `Duplicate question ID "${id}"`,
            autoFixable: false
          });
        }
        questionIds.add(id);
      }
    });
  }
  // Check for duplicate OFC IDs
  if (Array.isArray(correctedJson.module_ofcs)) {
    const ofcIds = new Set<string>();
    correctedJson.module_ofcs.forEach((o: Record<string, unknown>, idx: number) => {
      const ofcId = o.ofc_id != null ? String(o.ofc_id) : undefined;
      if (ofcId) {
        if (ofcIds.has(ofcId)) {
          issues.push({
            level: "error",
            field: `module_ofcs[${idx}].ofc_id`,
            message: `Duplicate OFC ID "${ofcId}"`,
            autoFixable: false
          });
        }
        ofcIds.add(ofcId);
      }
    });
  }
  const errors = issues.filter(i => i.level === "error");
  const valid = errors.length === 0;
  return {
    valid,
    issues,
    correctedJson: autoFix && correctedJson ? correctedJson : undefined
  };
}

/**
 * Format validation issues for display
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return "✅ No issues found";
  }
  
  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warning");
  const infos = issues.filter(i => i.level === "info");
  
  let output = "";
  
  if (errors.length > 0) {
    output += `❌ ${errors.length} Error(s):\n`;
    errors.forEach((issue, idx) => {
      output += `  ${idx + 1}. [${issue.field}] ${issue.message}`;
      if (issue.suggestion) {
        output += `\n     💡 Suggestion: ${issue.suggestion}`;
      }
      output += "\n";
    });
  }
  
  if (warnings.length > 0) {
    output += `⚠️ ${warnings.length} Warning(s):\n`;
    warnings.forEach((issue, idx) => {
      output += `  ${idx + 1}. [${issue.field}] ${issue.message}`;
      if (issue.suggestion) {
        output += `\n     💡 Suggestion: ${issue.suggestion}`;
      }
      output += "\n";
    });
  }
  
  if (infos.length > 0) {
    output += `ℹ️ ${infos.length} Info:\n`;
    infos.forEach((issue, idx) => {
      output += `  ${idx + 1}. [${issue.field}] ${issue.message}\n`;
    });
  }
  
  return output.trim();
}
