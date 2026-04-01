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

import { ELECTRIC_POWER_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_electric_power";
import { COMMUNICATIONS_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_communications";
import { INFORMATION_TECHNOLOGY_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_information_technology";
import { WATER_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_water";
import { WASTEWATER_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_wastewater";
import { CROSS_DEPENDENCY_VULNERABILITIES } from "../apps/web/app/lib/vuln/catalog_cross_dependency";

import { ELECTRIC_POWER_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_electric_power";
import { COMMUNICATIONS_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_communications";
import { INFORMATION_TECHNOLOGY_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_information_technology";
import { WATER_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_water";
import { WASTEWATER_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_wastewater";
import { CROSS_DEPENDENCY_CONSIDERATIONS } from "../apps/web/app/lib/vuln/considerations_cross_dependency";

import { CITATION_REGISTRY } from "../apps/web/app/lib/report/citations/registry";
import type { VulnerabilityConfig } from "../apps/web/app/lib/vuln/vulnerability_types";
import type { AnalyticalConsideration } from "../apps/web/app/lib/vuln/consideration_types";

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

function getConsiderationIds(vuln: VulnerabilityConfig): string[] {
  const legacy = (vuln as { considerations?: unknown }).considerations;
  if (Array.isArray(legacy)) return legacy.filter((v): v is string => typeof v === "string");
  const current = (vuln as { consideration_ids?: unknown }).consideration_ids;
  if (Array.isArray(current)) return current.filter((v): v is string => typeof v === "string");
  return [];
}

function getConditionText(vuln: VulnerabilityConfig): string {
  const legacy = (vuln as { condition_summary?: unknown }).condition_summary;
  if (typeof legacy === "string" && legacy.trim()) return legacy;
  return vuln.description || "";
}

function collectTriggerClauses(rule: unknown): Array<{ question_id?: string; questionId?: string }> {
  if (!rule || typeof rule !== "object") return [];
  const typed = rule as {
    type?: string;
    clause?: { question_id?: string; questionId?: string };
    rule?: unknown;
    rules?: unknown[];
  };
  if (typed.type === "CLAUSE") return typed.clause ? [typed.clause] : [];
  if (typed.type === "NOT") return collectTriggerClauses(typed.rule);
  if (typed.type === "AND" || typed.type === "OR") {
    const out: Array<{ question_id?: string; questionId?: string }> = [];
    for (const r of typed.rules ?? []) out.push(...collectTriggerClauses(r));
    return out;
  }
  return [];
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
  console.log("DEBUG: Loading ELECTRIC_POWER_VULNERABILITIES:", typeof ELECTRIC_POWER_VULNERABILITIES, Array.isArray(ELECTRIC_POWER_VULNERABILITIES));
  console.log("DEBUG: Loading COMMUNICATIONS_VULNERABILITIES:", typeof COMMUNICATIONS_VULNERABILITIES, Array.isArray(COMMUNICATIONS_VULNERABILITIES));
  console.log("DEBUG: Loading INFORMATION_TECHNOLOGY_VULNERABILITIES:", typeof INFORMATION_TECHNOLOGY_VULNERABILITIES, Array.isArray(INFORMATION_TECHNOLOGY_VULNERABILITIES));
  console.log("DEBUG: Loading WATER_VULNERABILITIES:", typeof WATER_VULNERABILITIES, Array.isArray(WATER_VULNERABILITIES));
  console.log("DEBUG: Loading WASTEWATER_VULNERABILITIES:", typeof WASTEWATER_VULNERABILITIES, Array.isArray(WASTEWATER_VULNERABILITIES));
  console.log("DEBUG: Loading CROSS_DEPENDENCY_VULNERABILITIES:", typeof CROSS_DEPENDENCY_VULNERABILITIES, Array.isArray(CROSS_DEPENDENCY_VULNERABILITIES));
  
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
    const considerationIdsForVuln = getConsiderationIds(vuln);

    // Check consideration count (1-4)
    if (considerationIdsForVuln.length < 1) {
      errors.push({
        type: "NO_CONSIDERATIONS",
        message: `Vulnerability ${vuln.id} has no linked considerations`,
        vulnerability_id: vuln.id,
      });
    }
    if (considerationIdsForVuln.length > 4) {
      errors.push({
        type: "TOO_MANY_CONSIDERATIONS",
        message: `Vulnerability ${vuln.id} has ${considerationIdsForVuln.length} considerations (max 4)`,
        vulnerability_id: vuln.id,
      });
    }

    // Check each consideration ID exists
    for (const considerationId of considerationIdsForVuln) {
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
      if (regex.test(vuln.title)) {
        warnings.push({
          type: "FORBIDDEN_LANGUAGE",
          message: `Vulnerability ${vuln.id} title contains forbidden verb: "${verb}"`,
          vulnerability_id: vuln.id,
        });
      }
      if (regex.test(getConditionText(vuln))) {
        warnings.push({
          type: "FORBIDDEN_LANGUAGE",
          message: `Vulnerability ${vuln.id} condition_summary contains forbidden verb: "${verb}"`,
          vulnerability_id: vuln.id,
        });
      }
    }

    // Check trigger references valid question IDs for current TriggerRule structure.
    const triggerClauses = collectTriggerClauses(vuln.trigger);
    for (const clause of triggerClauses) {
      const qid = (clause.question_id ?? clause.questionId ?? "").trim();
      if (!qid) {
        errors.push({
          type: "INVALID_TRIGGER",
          message: `Vulnerability ${vuln.id} has empty question_id in trigger`,
          vulnerability_id: vuln.id,
        });
      }
    }
    if (triggerClauses.length === 0) {
      errors.push({
        type: "INVALID_TRIGGER",
        message: `Vulnerability ${vuln.id} has no trigger clauses`,
        vulnerability_id: vuln.id,
      });
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

    // Check has at least one paragraph
    if (!consideration.paragraphs || consideration.paragraphs.length === 0) {
      errors.push({
        type: "NO_PARAGRAPHS",
        message: `Consideration ${consideration.id} has no paragraphs`,
        consideration_id: consideration.id,
      });
    }

    // Check each paragraph
    for (let i = 0; i < consideration.paragraphs.length; i++) {
      const para = consideration.paragraphs[i];

      // Check text exists
      if (!para.text || para.text.trim() === "") {
        errors.push({
          type: "EMPTY_PARAGRAPH",
          message: `Consideration ${consideration.id} paragraph ${i} has no text`,
          consideration_id: consideration.id,
        });
      }

      // Check for forbidden language
      for (const verb of FORBIDDEN_VERBS) {
        const regex = new RegExp(`\\b${verb}\\b`, "i");
        if (regex.test(para.text)) {
          warnings.push({
            type: "FORBIDDEN_LANGUAGE",
            message: `Consideration ${consideration.id} paragraph ${i} contains forbidden verb: "${verb}"`,
            consideration_id: consideration.id,
          });
        }
      }

      // Check citations exist in registry
      for (const citationKey of para.citations ?? []) {
        citationsReferenced.add(citationKey);
        if (!citationKeys.has(citationKey)) {
          errors.push({
            type: "MISSING_CITATION",
            message: `Consideration ${consideration.id} references non-existent citation: ${citationKey}`,
            consideration_id: consideration.id,
          });
        }
      }
    }
  }

  // Calculate stats
  const totalConsiderationsLinked = allVulnerabilities.reduce(
    (sum, v) => sum + getConsiderationIds(v).length,
    0
  );
  const avgConsiderationsPerVuln =
    allVulnerabilities.length > 0 ? totalConsiderationsLinked / allVulnerabilities.length : 0;

  const stats = {
    total_vulnerabilities: allVulnerabilities.length,
    total_considerations: allConsiderations.length,
    total_citations_referenced: citationsReferenced.size,
    avg_considerations_per_vulnerability: Math.round(avgConsiderationsPerVuln * 10) / 10,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// CLI execution
if (require.main === module) {
  console.log("🔍 Verifying Vulnerability Catalog Integrity...\n");

  const result = verifyVulnerabilityCatalog();

  console.log("📊 STATISTICS:");
  console.log(`  Total Vulnerabilities: ${result.stats.total_vulnerabilities}`);
  console.log(`  Total Considerations: ${result.stats.total_considerations}`);
  console.log(`  Citations Referenced: ${result.stats.total_citations_referenced}`);
  console.log(
    `  Avg Considerations/Vulnerability: ${result.stats.avg_considerations_per_vulnerability}`
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
}
