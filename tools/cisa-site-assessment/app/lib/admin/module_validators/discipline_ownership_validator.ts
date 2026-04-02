/**
 * Discipline Ownership Validator
 * 
 * Ensures module questions are assigned to valid discipline/subtype pairs
 * based on capability semantics in the question text.
 * 
 * HARD FAIL on violations - this is a mandatory validator.
 */

import { getRuntimePool } from "@/app/lib/db/runtime_client";
import type { ModuleQuestion } from "../module_import_v2";

export type DisciplineOwnershipValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Authoritative discipline ownership rules (hardcoded, not inferred)
 * 
 * These rules map semantic keywords in question text to allowed/disallowed disciplines.
 * Discipline codes are matched against the database discipline.code field.
 * 
 * NOTE: Discipline codes must match exactly what's in the database (e.g., "ACS", "VSS", "EMR", "SMG").
 */
const DISCIPLINE_RULES: Array<{
  keywords: string[];
  allowed_disciplines?: string[];
  disallowed_disciplines?: string[];
}> = [
  {
    keywords: ["lighting", "illumination", "visibility", "adequate lighting", "lighting implemented"],
    allowed_disciplines: [], // No specific discipline required, but VSS is disallowed
    disallowed_disciplines: ["VSS"] // Lighting is NOT video surveillance
  },
  {
    keywords: ["camera", "video", "surveillance", "recording", "video coverage", "coverage implemented"],
    allowed_disciplines: ["VSS"], // Must be Video Surveillance Systems
  },
  {
    keywords: ["panic", "duress", "intercom", "assistance", "call for help", "request assistance", "report an emergency", "user-accessible method"],
    allowed_disciplines: ["EMR"], // Emergency Management & Resilience
  },
  {
    keywords: ["procedure", "responsibilities", "coordination", "defined roles", "documented process", "process to inspect"],
    allowed_disciplines: ["SMG"], // Security Management & Governance
  },
  {
    keywords: ["access", "restricted", "authorized personnel", "physical access"],
    allowed_disciplines: ["ACS"], // Access Control Systems
  },
  {
    keywords: ["maintenance", "inspect", "inspection", "maintained", "managed"],
    allowed_disciplines: ["SMG"], // Security Management & Governance
  },
  {
    keywords: ["restore", "restoration", "disruption", "outage", "safe operation"],
    allowed_disciplines: ["EMR"], // Emergency Management & Resilience
  }
];

/**
 * Generic subtype names that should be rejected
 */
const GENERIC_SUBTYPE_NAMES = [
  "general", "other", "miscellaneous", "misc", "unspecified", "unknown", "default"
];

/**
 * Validate discipline ownership for a single module question
 */
async function validateQuestionOwnership(
  question: ModuleQuestion,
  _questionIndex: number  
): Promise<string[]> {
  const errors: string[] = [];
  const questionId = question.id;
  
  // Normalize question text to lowercase for keyword matching
  const questionText = (question.text || "").toLowerCase().trim();
  const assetOrLocation = (question.asset_or_location || "").toLowerCase().trim();
  const combinedText = `${questionText} ${assetOrLocation}`.trim();

  // Get discipline code from database
  const runtimePool = getRuntimePool();
  const disciplineResult = await runtimePool.query(
    `SELECT code FROM public.disciplines WHERE id = $1 AND is_active = true`,
    [question.discipline_id]
  );

  // Enforce subtype presence
  if (!question.discipline_subtype_id || typeof question.discipline_subtype_id !== "string") {
    errors.push(`${questionId}: discipline_subtype_id is required`);
    return errors;
  }

  if (!disciplineResult.rowCount || disciplineResult.rowCount === 0) {
    errors.push(`${questionId}: Invalid discipline_id (not found or inactive): ${question.discipline_id}`);
    return errors;
  }

  const disciplineCode = disciplineResult.rows[0].code as string;

  // Check if subtype belongs to discipline and get subtype details
  const subtypeResult = await runtimePool.query(
    `SELECT ds.code as subtype_code, ds.name as subtype_name, d.code as discipline_code
     FROM public.discipline_subtypes ds
     JOIN public.disciplines d ON ds.discipline_id = d.id
     WHERE ds.id = $1 AND ds.is_active = true AND d.is_active = true`,
    [question.discipline_subtype_id]
  );

  if (!subtypeResult.rowCount || subtypeResult.rowCount === 0) {
    errors.push(`${questionId}: Invalid discipline_subtype_id (not found or inactive): ${question.discipline_subtype_id}`);
    return errors;
  }

  const subtypeRow = subtypeResult.rows[0];
  const subtypeCode = subtypeRow.subtype_code as string;
  const subtypeName = (subtypeRow.subtype_name || "").toLowerCase();
  const subtypeDisciplineCode = subtypeRow.discipline_code as string;
  
  if (subtypeDisciplineCode !== disciplineCode) {
    errors.push(
      `${questionId}: Discipline mismatch - question.discipline_id maps to "${disciplineCode}" ` +
      `but discipline_subtype_id belongs to "${subtypeDisciplineCode}"`
    );
    return errors;
  }

  // Reject generic subtypes
  const isGeneric = GENERIC_SUBTYPE_NAMES.some(generic => 
    subtypeName.includes(generic) || subtypeCode.toLowerCase().includes(generic)
  );
  
  if (isGeneric) {
    errors.push(
      `${questionId}: Generic subtypes (e.g., "General", "Other") are not allowed. ` +
      `Found subtype: "${subtypeName}" (${subtypeCode}). ` +
      `Module questions must use specific, capability-anchored subtypes.`
    );
    return errors;
  }

  // Check semantic rules (prioritize longer/more specific keywords)
  // Sort rules by keyword length (longest first) to prioritize specific matches
  const sortedRules = [...DISCIPLINE_RULES].sort((a, b) => {
    const aMaxLen = Math.max(...a.keywords.map(k => k.length));
    const bMaxLen = Math.max(...b.keywords.map(k => k.length));
    return bMaxLen - aMaxLen;
  });

  const matchingRules: typeof DISCIPLINE_RULES = [];
  
  for (const rule of sortedRules) {
    const hasKeyword = rule.keywords.some(keyword => 
      combinedText.includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      matchingRules.push(rule);
    }
  }

  // If we have matching rules, validate against them
  if (matchingRules.length > 0) {
    // First check: disallowed disciplines (hard fail)
    for (const rule of matchingRules) {
      if (rule.disallowed_disciplines && rule.disallowed_disciplines.includes(disciplineCode)) {
        // Get suggested discipline/subtype from allowed disciplines
        let suggestedText = "";
        if (rule.allowed_disciplines && rule.allowed_disciplines.length > 0) {
          // Try to find appropriate subtype for the first allowed discipline
          const suggestedDiscipline = rule.allowed_disciplines[0];
          const suggestedSubtypeResult = await runtimePool.query(
            `SELECT ds.code, ds.name 
             FROM public.discipline_subtypes ds
             JOIN public.disciplines d ON ds.discipline_id = d.id
             WHERE d.code = $1 AND ds.is_active = true AND d.is_active = true
             ORDER BY ds.name ASC
             LIMIT 1`,
            [suggestedDiscipline]
          );
          
          if (suggestedSubtypeResult.rowCount && suggestedSubtypeResult.rowCount > 0) {
            const suggestedSubtype = suggestedSubtypeResult.rows[0];
            suggestedText = `${suggestedDiscipline} / ${suggestedSubtype.name}`;
          } else {
            suggestedText = suggestedDiscipline;
          }
        }
        
        const foundText = `${disciplineCode} / ${subtypeRow.subtype_name || subtypeCode}`;
        const errorMsg = suggestedText 
          ? `${questionId}: ${rule.keywords[0]}-related questions must use ${suggestedText}. Found: ${foundText}.`
          : `${questionId}: Question text contains "${rule.keywords.join('" or "')}" but is assigned to disallowed discipline "${disciplineCode}". This capability is not appropriate for "${disciplineCode}".`;
        
        errors.push(errorMsg);
        return errors; // Hard fail on disallowed
      }
    }

    // Second check: allowed disciplines (only fail if ALL matching rules require specific disciplines)
    const rulesWithAllowed = matchingRules.filter(r => r.allowed_disciplines && r.allowed_disciplines.length > 0);
    
    if (rulesWithAllowed.length > 0) {
      // Check if discipline matches ANY allowed list
      const matchesAnyAllowed = rulesWithAllowed.some(rule => 
        rule.allowed_disciplines && rule.allowed_disciplines.includes(disciplineCode)
      );

      if (!matchesAnyAllowed) {
        // Get all unique allowed disciplines from matching rules
        const allAllowed = new Set<string>();
        rulesWithAllowed.forEach(rule => {
          if (rule.allowed_disciplines) {
            rule.allowed_disciplines.forEach(d => allAllowed.add(d));
          }
        });

        // Try to get suggested subtype for first allowed discipline
        const suggestedDiscipline = Array.from(allAllowed)[0];
        const suggestedSubtypeResult = await runtimePool.query(
          `SELECT ds.code, ds.name 
           FROM public.discipline_subtypes ds
           JOIN public.disciplines d ON ds.discipline_id = d.id
           WHERE d.code = $1 AND ds.is_active = true AND d.is_active = true
           ORDER BY ds.name ASC
           LIMIT 1`,
          [suggestedDiscipline]
        );
        
        let suggestedText = suggestedDiscipline;
        if (suggestedSubtypeResult.rowCount && suggestedSubtypeResult.rowCount > 0) {
          const suggestedSubtype = suggestedSubtypeResult.rows[0];
          suggestedText = `${suggestedDiscipline} / ${suggestedSubtype.name}`;
        }
        
        const foundText = `${disciplineCode} / ${subtypeRow.subtype_name || subtypeCode}`;
        errors.push(
          `${questionId}: ${rulesWithAllowed[0].keywords[0]}-related questions must use ${suggestedText}. Found: ${foundText}.`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate discipline ownership for all module questions
 */
export async function validateDisciplineOwnership(
  questions: ModuleQuestion[]
): Promise<DisciplineOwnershipValidationResult> {
  const errors: string[] = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: true, errors: [] };
  }

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const questionErrors = await validateQuestionOwnership(questions[i], i);
    errors.push(...questionErrors);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
