/**
 * Event Trigger Validator
 * 
 * Ensures module questions have appropriate event triggers based on their semantic content.
 * 
 * HARD FAIL on violations - this is a mandatory validator.
 */

import type { ModuleQuestion } from "../module_import_v2";

export type EventTriggerValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Event trigger rules mapping keywords to required triggers
 */
const EVENT_TRIGGER_RULES = [
  {
    keywords: ["access", "restricted", "authorized personnel", "physical access", "enclosures", "service panels", "cabinets"],
    required_triggers: ["TAMPERING"],
    description: "access, inspection, cable, hardware questions"
  },
  {
    keywords: ["lighting", "illumination", "visibility", "adequate lighting", "lighting implemented", "sightlines", "deter"],
    required_triggers: ["TAMPERING"],
    description: "lighting / visibility deterrence"
  },
  {
    keywords: ["panic", "duress", "intercom", "assistance", "call for help", "request assistance", "report an emergency", "user-accessible method", "emergency"],
    required_triggers: ["OTHER"],
    description: "panic / duress / assistance"
  },
  {
    keywords: ["restore", "restoration", "disruption", "outage", "safe operation", "recovery", "continuity", "coordination", "service providers"],
    required_triggers: ["OUTAGE"],
    description: "recovery / restoration / continuity"
  },
  {
    keywords: ["inspect", "inspection", "maintained", "managed", "damage", "tampering indicators", "unsafe conditions", "documented process"],
    required_triggers: ["TAMPERING"],
    description: "inspection and maintenance"
  }
];

/**
 * Valid event triggers (must match ModuleQuestion type)
 */
const VALID_TRIGGERS = ["FIRE", "TAMPERING", "IMPACT", "OUTAGE", "OTHER"];

/**
 * Validate event trigger for a single module question
 */
function validateQuestionEventTrigger(
  question: ModuleQuestion,
  _questionIndex: number  
): string[] {
  const errors: string[] = [];
  const questionId = question.id;
  
  // Normalize question text to lowercase for keyword matching
  const questionText = (question.text || "").toLowerCase().trim();
  const assetOrLocation = (question.asset_or_location || "").toLowerCase().trim();
  const combinedText = `${questionText} ${assetOrLocation}`.trim();
  
  // Validate event_trigger is present and valid
  if (!question.event_trigger || typeof question.event_trigger !== "string") {
    errors.push(`${questionId}: event_trigger is required`);
    return errors;
  }
  
  if (!VALID_TRIGGERS.includes(question.event_trigger)) {
    errors.push(
      `${questionId}: Invalid event_trigger "${question.event_trigger}". ` +
      `Must be one of: ${VALID_TRIGGERS.join(", ")}`
    );
    return errors;
  }
  
  // Check semantic rules (prioritize longer/more specific keywords)
  const sortedRules = [...EVENT_TRIGGER_RULES].sort((a, b) => {
    const aMaxLen = Math.max(...a.keywords.map(k => k.length));
    const bMaxLen = Math.max(...b.keywords.map(k => k.length));
    return bMaxLen - aMaxLen;
  });
  
  const matchingRules: typeof EVENT_TRIGGER_RULES = [];
  
  for (const rule of sortedRules) {
    const hasKeyword = rule.keywords.some(keyword => 
      combinedText.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      matchingRules.push(rule);
    }
  }
  
  // If we have matching rules, validate event trigger
  if (matchingRules.length > 0) {
    // Check if the question's event_trigger matches any required trigger from matching rules
    const allRequiredTriggers = new Set<string>();
    matchingRules.forEach(rule => {
      rule.required_triggers.forEach(t => allRequiredTriggers.add(t));
    });
    
    if (!allRequiredTriggers.has(question.event_trigger)) {
      const ruleDescriptions = matchingRules.map(r => r.description).join(", ");
      errors.push(
        `${questionId}: Question text contains keywords matching ${ruleDescriptions} ` +
        `but event_trigger is "${question.event_trigger}". ` +
        `Expected triggers: ${Array.from(allRequiredTriggers).join(" or ")}`
      );
    }
  }
  
  return errors;
}

/**
 * Validate event triggers for all module questions
 */
export function validateEventTriggers(
  questions: ModuleQuestion[]
): EventTriggerValidationResult {
  const errors: string[] = [];
  
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: true, errors: [] };
  }
  
  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const questionErrors = validateQuestionEventTrigger(questions[i], i);
    errors.push(...questionErrors);
  }
  
  return {
    ok: errors.length === 0,
    errors
  };
}
