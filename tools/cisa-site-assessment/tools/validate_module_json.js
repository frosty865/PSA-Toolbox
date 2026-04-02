#!/usr/bin/env node
/**
 * Module JSON Validator & Auto-Corrector CLI Tool
 * 
 * Validates and optionally auto-corrects module import JSON files.
 * 
 * Usage:
 *   node tools/validate_module_json.js <input.json> [--fix] [--output <output.json>]
 */

const fs = require('fs');
const path = require('path');

// Import the validator (we'll need to adapt it for Node.js)
// For now, we'll implement a simplified version here

function validateModuleJson(json, autoFix = false) {
  const issues = [];
  let correctedJson = json ? JSON.parse(JSON.stringify(json)) : null;
  
  if (!json || typeof json !== "object") {
    return {
      valid: false,
      issues: [{
        level: "error",
        field: "root",
        message: "Invalid JSON: must be an object",
        autoFixable: false
      }],
      correctedJson: undefined
    };
  }
  
  // Check module_code
  if (!json.module_code) {
    issues.push({
      level: "error",
      field: "module_code",
      message: "module_code is required",
      autoFixable: false
    });
  } else if (!json.module_code.startsWith("MODULE_")) {
    issues.push({
      level: "error",
      field: "module_code",
      message: `module_code must start with "MODULE_"`,
      suggestion: `Change to "MODULE_${json.module_code}"`,
      autoFixable: true
    });
    if (autoFix) {
      correctedJson.module_code = `MODULE_${json.module_code}`;
    }
  }
  
  // Check title
  if (!json.title || typeof json.title !== "string" || json.title.trim().length === 0) {
    issues.push({
      level: "error",
      field: "title",
      message: "title is required and must be a non-empty string",
      autoFixable: false
    });
  }
  
  // Validate module_questions
  if (Array.isArray(json.module_questions)) {
    json.module_questions.forEach((q, idx) => {
      const prefix = `module_questions[${idx}]`;
      
      // Check question ID
      if (!q.id) {
        issues.push({
          level: "error",
          field: `${prefix}.id`,
          message: "id is required",
          autoFixable: false
        });
      } else if (q.id.startsWith("BASE-")) {
        issues.push({
          level: "error",
          field: `${prefix}.id`,
          message: `Question ID "${q.id}" starts with "BASE-" which is not allowed`,
          suggestion: `Change to "MODULEQ_${q.id.replace("BASE-", "")}"`,
          autoFixable: true
        });
        if (autoFix) {
          correctedJson.module_questions[idx].id = `MODULEQ_${q.id.replace("BASE-", "")}`;
        }
      } else if (!q.id.startsWith("MODULEQ_")) {
        issues.push({
          level: "error",
          field: `${prefix}.id`,
          message: `Question ID "${q.id}" must start with "MODULEQ_"`,
          suggestion: `Change to "MODULEQ_${q.id}"`,
          autoFixable: true
        });
        if (autoFix) {
          correctedJson.module_questions[idx].id = `MODULEQ_${q.id}`;
        }
      }
      
      // Check event_trigger
      if (!q.event_trigger) {
        issues.push({
          level: "error",
          field: `${prefix}.event_trigger`,
          message: "event_trigger is required",
          autoFixable: false
        });
      } else {
        const validTriggers = ["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"];
        const triggerUpper = q.event_trigger.toUpperCase();
        if (!validTriggers.includes(triggerUpper)) {
          let suggested = "TAMPERING";
          if (triggerUpper === "SAFETY_EVENT" || triggerUpper === "EMERGENCY") {
            suggested = "OTHER";
          } else if (triggerUpper === "THEFT" || triggerUpper === "CRIMINAL_ACTIVITY") {
            suggested = "TAMPERING";
          }
          
          issues.push({
            level: "error",
            field: `${prefix}.event_trigger`,
            message: `Invalid event_trigger "${q.event_trigger}". Valid options: ${validTriggers.join(", ")}`,
            suggestion: `Change to "${suggested}"`,
            autoFixable: true
          });
          if (autoFix) {
            correctedJson.module_questions[idx].event_trigger = suggested;
          }
        }
      }
      
      // Check placeholder UUIDs
      if (q.discipline_id && /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(q.discipline_id)) {
        issues.push({
          level: "error",
          field: `${prefix}.discipline_id`,
          message: "Placeholder UUID detected. Replace with actual discipline UUID from database.",
          suggestion: "Run 'node scripts/get_discipline_uuids_for_modules.js' to get valid UUIDs",
          autoFixable: false
        });
      }
      
      if (q.discipline_subtype_id && /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(q.discipline_subtype_id)) {
        issues.push({
          level: "error",
          field: `${prefix}.discipline_subtype_id`,
          message: "Placeholder UUID detected. Replace with actual subtype UUID from database.",
          suggestion: "Run 'node scripts/get_discipline_uuids_for_modules.js' to get valid UUIDs",
          autoFixable: false
        });
      }
      
      // Check required fields
      if (!q.text || typeof q.text !== "string" || q.text.trim().length === 0) {
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
      
      if (!q.asset_or_location || typeof q.asset_or_location !== "string" || q.asset_or_location.trim().length === 0) {
        issues.push({
          level: "error",
          field: `${prefix}.asset_or_location`,
          message: "asset_or_location is required and must be a non-empty string",
          autoFixable: false
        });
      }
    });
  }
  
  // Validate module_ofcs
  if (Array.isArray(json.module_ofcs)) {
    json.module_ofcs.forEach((o, idx) => {
      const prefix = `module_ofcs[${idx}]`;
      
      if (!o.ofc_id) {
        issues.push({
          level: "error",
          field: `${prefix}.ofc_id`,
          message: "ofc_id is required",
          autoFixable: false
        });
      } else if (o.ofc_id.startsWith("IST_OFC_") || o.ofc_id.startsWith("BASE-")) {
        issues.push({
          level: "error",
          field: `${prefix}.ofc_id`,
          message: `OFC ID "${o.ofc_id}" uses invalid prefix. Must use "MOD_OFC_"`,
          suggestion: `Change to "MOD_OFC_${o.ofc_id.replace(/^(IST_OFC_|BASE-)/, "")}"`,
          autoFixable: true
        });
        if (autoFix) {
          correctedJson.module_ofcs[idx].ofc_id = `MOD_OFC_${o.ofc_id.replace(/^(IST_OFC_|BASE-)/, "")}`;
        }
      } else if (!o.ofc_id.startsWith("MOD_OFC_")) {
        issues.push({
          level: "error",
          field: `${prefix}.ofc_id`,
          message: `OFC ID "${o.ofc_id}" must start with "MOD_OFC_"`,
          suggestion: `Change to "MOD_OFC_${o.ofc_id}"`,
          autoFixable: true
        });
        if (autoFix) {
          correctedJson.module_ofcs[idx].ofc_id = `MOD_OFC_${o.ofc_id}`;
        }
      }
    });
  }
  
  // Validate risk_drivers
  if (Array.isArray(json.risk_drivers)) {
    json.risk_drivers.forEach((d, idx) => {
      const prefix = `risk_drivers[${idx}]`;
      
      if (!d.driver_type) {
        issues.push({
          level: "error",
          field: `${prefix}.driver_type`,
          message: "driver_type is required",
          autoFixable: false
        });
      } else if (!["CYBER_DRIVER", "FRAUD_DRIVER"].includes(d.driver_type)) {
        let suggested = "CYBER_DRIVER";
        const text = (d.driver_text || "").toLowerCase();
        if (text.includes("theft") || text.includes("fraud") || text.includes("skimming") || text.includes("property crime")) {
          suggested = "FRAUD_DRIVER";
        }
        
        issues.push({
          level: "error",
          field: `${prefix}.driver_type`,
          message: `Invalid driver_type "${d.driver_type}". Must be "CYBER_DRIVER" or "FRAUD_DRIVER"`,
          suggestion: `Change to "${suggested}"`,
          autoFixable: true
        });
        if (autoFix) {
          correctedJson.risk_drivers[idx].driver_type = suggested;
        }
      }
      
      if (!d.driver_text || typeof d.driver_text !== "string" || d.driver_text.trim().length === 0) {
        issues.push({
          level: "error",
          field: `${prefix}.driver_text`,
          message: "driver_text is required and must be a non-empty string",
          autoFixable: false
        });
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

function formatIssues(issues) {
  if (issues.length === 0) {
    return "✅ No issues found";
  }
  
  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warning");
  
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
  
  return output.trim();
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Module JSON Validator & Auto-Corrector

Usage:
  node tools/validate_module_json.js <input.json> [options]

Options:
  --fix              Auto-fix issues where possible
  --output <file>    Write corrected JSON to file (requires --fix)
  --help, -h         Show this help message

Examples:
  node tools/validate_module_json.js module.json
  node tools/validate_module_json.js module.json --fix --output module_fixed.json
`);
    process.exit(0);
  }
  
  const inputFile = args[0];
  const autoFix = args.includes("--fix");
  const outputIndex = args.indexOf("--output");
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : null;
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    process.exit(1);
  }
  
  let json;
  try {
    json = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  } catch (e) {
    console.error(`❌ Error: Invalid JSON file: ${e.message}`);
    process.exit(1);
  }
  
  console.log(`\n🔍 Validating: ${inputFile}\n`);
  
  const result = validateModuleJson(json, autoFix);
  
  console.log(formatIssues(result.issues));
  console.log();
  
  if (result.valid) {
    console.log("✅ Validation passed! JSON is ready for import.\n");
    process.exit(0);
  } else {
    const autoFixableCount = result.issues.filter(i => i.autoFixable && i.level === "error").length;
    if (autoFixableCount > 0 && !autoFix) {
      console.log(`💡 Tip: ${autoFixableCount} error(s) can be auto-fixed. Use --fix to apply corrections.\n`);
    }
    
    if (autoFix && result.correctedJson) {
      const output = outputFile || inputFile.replace(/\.json$/, "_fixed.json");
      fs.writeFileSync(output, JSON.stringify(result.correctedJson, null, 2), "utf-8");
      console.log(`✅ Auto-fixed JSON written to: ${output}\n`);
      
      // Re-validate to show remaining issues
      const recheck = validateModuleJson(result.correctedJson, false);
      if (recheck.valid) {
        console.log("✅ All issues fixed! JSON is ready for import.\n");
      } else {
        console.log("⚠️ Some issues remain (cannot be auto-fixed):\n");
        console.log(formatIssues(recheck.issues));
        console.log();
      }
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateModuleJson, formatIssues };
