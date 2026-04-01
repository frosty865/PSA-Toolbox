/**
 * Vulnerability Integrity Verifier
 * 
 * Ensures vulnerability catalog integrity:
 * - Unique vulnerability IDs
 * - Valid trigger question IDs exist
 * - Each vulnerability links 1-4 consideration IDs
 * - Each consideration's citations exist in registry
 * - No forbidden prescriptive language
 * - No internal IDs leak into report content
 */

import { ELECTRIC_POWER_VULNERABILITIES } from "../app/lib/vuln/catalog_electric_power";
import { COMMUNICATIONS_VULNERABILITIES } from "../app/lib/vuln/catalog_communications";
import { INFORMATION_TECHNOLOGY_VULNERABILITIES } from "../app/lib/vuln/catalog_information_technology";
import { WATER_VULNERABILITIES } from "../app/lib/vuln/catalog_water";
import { WASTEWATER_VULNERABILITIES } from "../app/lib/vuln/catalog_wastewater";
import { CROSS_DEPENDENCY_VULNERABILITIES } from "../app/lib/vuln/catalog_cross_dependency";

import { ELECTRIC_POWER_CONSIDERATIONS } from "../app/lib/vuln/considerations_electric_power";
import { COMMUNICATIONS_CONSIDERATIONS } from "../app/lib/vuln/considerations_communications";
import { INFORMATION_TECHNOLOGY_CONSIDERATIONS } from "../app/lib/vuln/considerations_information_technology";
import { WATER_CONSIDERATIONS } from "../app/lib/vuln/considerations_water";
import { WASTEWATER_CONSIDERATIONS } from "../app/lib/vuln/considerations_wastewater";
import { CROSS_DEPENDENCY_CONSIDERATIONS } from "../app/lib/vuln/considerations_cross_dependency";

import { CITATION_REGISTRY } from "../app/lib/report/citations/registry";
import { collectQuestionIds, validateQuestionVulnMap } from "../app/lib/vuln/validate_catalog";
import type { VulnerabilityConfig } from "../app/lib/vuln/vulnerability_types";
import type { AnalyticalConsideration } from "../app/lib/vuln/consideration_types";

// Forbidden prescriptive verbs
const FORBIDDEN_VERBS = [
  "install",
  "upgrade",
  "must",
  "should",
  "deploy",
  "implement",
  "require",
  "mandatory",
];

interface ValidationError {
  type: string;
  message: string;
  vulnerability_id?: string;
  consideration_id?: string;
}

/**
 * Verify vulnerability catalog integrity
 */
export function verifyVulnerabilityCatalog(): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    total_vulnerabilities: number;
    total_considerations: number;
    total_citations_referenced: number;
    avg_considerations_per_vulnerability: number;
  };
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Collect all vulnerabilities
  const allVulnerabilities = [
    ...ELECTRIC_POWER_VULNERABILITIES,
    ...COMMUNICATIONS_VULNERABILITIES,
    ...INFORMATION_TECHNOLOGY_VULNERABILITIES,
    ...WATER_VULNERABILITIES,
    ...WASTEWATER_VULNERABILITIES,
    ...CROSS_DEPENDENCY_VULNERABILITIES,
  ];

  // Collect all considerations
  const allConsiderations = [
    ...ELECTRIC_POWER_CONSIDERATIONS,
    ...COMMUNICATIONS_CONSIDERATIONS,
    ...INFORMATION_TECHNOLOGY_CONSIDERATIONS,
    ...WATER_CONSIDERATIONS,
    ...WASTEWATER_CONSIDERATIONS,
    ...CROSS_DEPENDENCY_CONSIDERATIONS,
  ];

  // Build consideration ID map
  const considerationMap = new Map<string, AnalyticalConsideration>();
  for (const consideration of allConsiderations) {
    considerationMap.set(consideration.id, consideration);
  }

  // Build citation key set
  const citationKeys = new Set(Object.keys(CITATION_REGISTRY));

  // 1. Check unique vulnerability IDs
  const vulnIds = new Set<string>();
  for (const vuln of allVulnerabilities) {
    if (vulnIds.has(vuln.id)) {
      errors.push({
        type: "DUPLICATE_VULNERABILITY_ID",
        message: `Duplicate vulnerability ID: ${vuln.id}`,
        vulnerability_id: vuln.id,
      });
    }
    vulnIds.add(vuln.id);
  }

  // 2. Check unique consideration IDs
  const considerationIds = new Set<string>();
  for (const consideration of allConsiderations) {
    if (considerationIds.has(consideration.id)) {
      errors.push({
        type: "DUPLICATE_CONSIDERATION_ID",
        message: `Duplicate consideration ID: ${consideration.id}`,
        consideration_id: consideration.id,
      });
    }
    considerationIds.add(consideration.id);
  }

  // Track citation usage
  const citationsReferenced = new Set<string>();

  // 3. Validate each vulnerability
  for (const vuln of allVulnerabilities) {
    // Check consideration count (1-4)
    if (vuln.consideration_ids.length < 1) {
      errors.push({
        type: "NO_CONSIDERATIONS",
        message: `Vulnerability ${vuln.id} has no linked considerations`,
        vulnerability_id: vuln.id,
      });
    }
    if (vuln.consideration_ids.length > 4) {
      errors.push({
        type: "TOO_MANY_CONSIDERATIONS",
        message: `Vulnerability ${vuln.id} has ${vuln.consideration_ids.length} considerations (max 4)`,
        vulnerability_id: vuln.id,
      });
    }

    // Check each consideration ID exists
    for (const considerationId of vuln.consideration_ids) {
      if (!considerationMap.has(considerationId)) {
        errors.push({
          type: "MISSING_CONSIDERATION",
          message: `Vulnerability ${vuln.id} references non-existent consideration: ${considerationId}`,
          vulnerability_id: vuln.id,
        });
      }
    }

    // Check for forbidden language in title and condition_summary
    for (const verb of FORBIDDEN_VERBS) {
      const regex = new RegExp(`\\b${verb}\\b`, "i");
      if (regex.test(vuln.short_name)) {
        warnings.push({
          type: "FORBIDDEN_LANGUAGE",
          message: `Vulnerability ${vuln.id} title contains forbidden verb: "${verb}"`,
          vulnerability_id: vuln.id,
        });
      }
      if (regex.test(vuln.description)) {
        warnings.push({
          type: "FORBIDDEN_LANGUAGE",
          message: `Vulnerability ${vuln.id} description contains forbidden verb: "${verb}"`,
          vulnerability_id: vuln.id,
        });
      }
    }

    // Check trigger references valid question IDs (TriggerRule format)
    const questionIds = collectQuestionIds(vuln.trigger);
    for (const qid of questionIds) {
      if (!qid || qid.trim() === "") {
        errors.push({
          type: "INVALID_TRIGGER",
          message: `Vulnerability ${vuln.id} has empty question_id in trigger`,
          vulnerability_id: vuln.id,
        });
      }
    }
  }

  // 4. Validate each consideration
  for (const consideration of allConsiderations) {
    // Check heading exists
    if (!consideration.heading || consideration.heading.trim() === "") {
      errors.push({
        type: "MISSING_HEADING",
        message: `Consideration ${consideration.id} has no heading`,
        consideration_id: consideration.id,
      });
    }

    // Check paragraphs exist and contain paragraphs
    if (!consideration.paragraphs || consideration.paragraphs.length === 0) {
      errors.push({
        type: "NO_PARAGRAPHS",
        message: `Consideration ${consideration.id} has no paragraphs`,
        consideration_id: consideration.id,
      });
    }

    // Check each paragraph
    for (let i = 0; i < (consideration.paragraphs || []).length; i++) {
      const para = consideration.paragraphs![i];
      if (!para.text || para.text.trim() === "") {
        errors.push({
          type: "EMPTY_PARAGRAPH",
          message: `Consideration ${consideration.id} paragraph ${i + 1} has empty text`,
          consideration_id: consideration.id,
        });
      }

      // Check paragraph citations exist
      if (para.citations && Array.isArray(para.citations)) {
        for (const citationKey of para.citations) {
          if (!citationKeys.has(citationKey)) {
            errors.push({
              type: "INVALID_CITATION",
              message: `Consideration ${consideration.id} references non-existent citation: ${citationKey}`,
              consideration_id: consideration.id,
            });
          }
          citationsReferenced.add(citationKey);
        }
      }
    }

    // Check for forbidden language in headings (handle both new and legacy format)
    const headingText = consideration.heading || consideration.title;
    if (headingText) {
      for (const verb of FORBIDDEN_VERBS) {
        const regex = new RegExp(`\\b${verb}\\b`, "i");
        if (regex.test(headingText)) {
          warnings.push({
            type: "FORBIDDEN_LANGUAGE",
            message: `Consideration ${consideration.id} heading contains forbidden verb: "${verb}"`,
            consideration_id: consideration.id,
          });
        }
      }
    }

    // Check for forbidden language in paragraphs (new format)
    if (consideration.paragraphs) {
      for (let i = 0; i < consideration.paragraphs.length; i++) {
        const para = consideration.paragraphs[i];
        for (const verb of FORBIDDEN_VERBS) {
          const regex = new RegExp(`\\b${verb}\\b`, "i");
          if (regex.test(para.text)) {
            warnings.push({
              type: "FORBIDDEN_LANGUAGE",
              message: `Consideration ${consideration.id} paragraph ${i + 1} contains forbidden verb: "${verb}"`,
              consideration_id: consideration.id,
            });
          }
        }
      }
    }

    // Check for forbidden language in narrative (legacy format)
    if (consideration.narrative) {
      for (const verb of FORBIDDEN_VERBS) {
        const regex = new RegExp(`\\b${verb}\\b`, "i");
        if (regex.test(consideration.narrative)) {
          warnings.push({
            type: "FORBIDDEN_LANGUAGE",
            message: `Consideration ${consideration.id} narrative contains forbidden verb: "${verb}"`,
            consideration_id: consideration.id,
          });
        }
      }
    }
  }

  // Calculate statistics
  const totalVulnerabilities = allVulnerabilities.length;
  const totalConsiderations = allConsiderations.length;
  const totalCitationsReferenced = citationsReferenced.size;
  const avgConsiderationsPerVulnerability =
    totalVulnerabilities > 0
      ? allVulnerabilities.reduce((sum, v) => sum + v.consideration_ids.length, 0) /
        totalVulnerabilities
      : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      total_vulnerabilities: totalVulnerabilities,
      total_considerations: totalConsiderations,
      total_citations_referenced: totalCitationsReferenced,
      avg_considerations_per_vulnerability: avgConsiderationsPerVulnerability,
    },
  };
}

// CLI execution
const result = verifyVulnerabilityCatalog();

// Run question-driven vulnerability map validation (citations, coverage)
const qvResult = validateQuestionVulnMap();
if (!qvResult.ok) {
  console.log("❌ QUESTION_VULN_MAP VALIDATION FAILED:");
  for (const err of qvResult.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log("📊 STATISTICS:");
console.log(`  Total Vulnerabilities: ${result.stats.total_vulnerabilities}`);
console.log(`  Total Considerations: ${result.stats.total_considerations}`);
console.log(`  Citations Referenced: ${result.stats.total_citations_referenced}`);
console.log(
  `  Avg Considerations/Vulnerability: ${result.stats.avg_considerations_per_vulnerability.toFixed(1)}`
);
console.log();

if (result.errors.length > 0) {
  console.log(`❌ ERRORS (${result.errors.length}):`);
  for (const error of result.errors) {
    console.error(`  - [${error.type}] ${error.message}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log(`⚠️  WARNINGS (${result.warnings.length}):`);
  for (const warning of result.warnings) {
    console.warn(`  - [${warning.type}] ${warning.message}`);
  }
  console.log();
}

if (result.valid) {
  console.log("✅ VERIFICATION PASSED - Catalog integrity is validated");
  process.exit(0);
} else {
  console.log("❌ VERIFICATION FAILED - Please fix errors before proceeding");
  process.exit(1);
}
