/**
 * Risk Driver Validator
 * 
 * Normalizes and deduplicates risk drivers to ensure:
 * - One driver per vulnerability type
 * - No duplication per option
 * - Drivers remain context-only (never become questions or OFCs)
 * 
 * HARD FAIL on violations - this is a mandatory validator.
 */

export type RiskDriver = {
  driver_type: "CYBER_DRIVER" | "FRAUD_DRIVER";
  driver_text: string;
  source_locator?: {
    vulnerability?: string;
    vulnerability_index?: number;
    option_index?: number;
  };
};

export type RiskDriverValidationResult = {
  ok: boolean;
  errors: string[];
  normalized_drivers: RiskDriver[];
};

/**
 * Normalize risk driver text
 * - Trim whitespace
 * - Normalize capitalization (sentence case)
 * - Remove trailing periods if present
 */
function normalizeDriverText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "") // Remove trailing period
    .trim();
}

/**
 * Check if two driver texts are semantically equivalent
 * (for deduplication purposes)
 */
function areDriversEquivalent(text1: string, text2: string): boolean {
  const norm1 = normalizeDriverText(text1).toLowerCase();
  const norm2 = normalizeDriverText(text2).toLowerCase();
  
  // Exact match after normalization
  if (norm1 === norm2) {
    return true;
  }

  // Check if one is a substring of the other (with word boundaries)
  // This catches cases like "Unauthorized Access" vs "Unauthorized access to EV charging systems..."
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length < norm2.length ? norm2 : norm1;
  
  // If shorter is a complete phrase in longer, consider equivalent
  // But only if shorter is at least 3 words or 15 characters
  if (shorter.length >= 15 || shorter.split(/\s+/).length >= 3) {
    // Check if shorter appears as a complete phrase in longer
    const shorterWords = shorter.split(/\s+/);
    const longerWords = longer.split(/\s+/);
    
    // Check if all words of shorter appear consecutively in longer
    for (let i = 0; i <= longerWords.length - shorterWords.length; i++) {
      const slice = longerWords.slice(i, i + shorterWords.length);
      if (slice.join(" ") === shorterWords.join(" ")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if driver text contains garbage concatenation patterns
 */
function isGarbageConcatenation(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  
  // Check for multiple commas with no sentence structure (e.g., "X, Y, Z" without verbs)
  const commaCount = (normalized.match(/,/g) || []).length;
  if (commaCount >= 3) {
    // Check if it looks like a list rather than a sentence
    const hasVerb = /\b(is|are|may|can|will|should|must|enable|allow|prevent|reduce|increase|cause|lead|result)\b/i.test(text);
    if (!hasVerb && commaCount >= 3) {
      return true;
    }
  }
  
  // Check for repeated vulnerability names (e.g., "Unauthorized Access Unauthorized Access")
  const words = normalized.split(/\s+/);
  if (words.length >= 4) {
    const firstTwoWords = words.slice(0, 2).join(" ");
    const lastTwoWords = words.slice(-2).join(" ");
    if (firstTwoWords === lastTwoWords) {
      return true;
    }
  }
  
  // Check for option lists pattern: "Implement X, Install Y, Conduct Z"
  // Look for multiple action verbs followed by nouns, separated by commas
  const actionVerbs = /\b(implement|install|conduct|deploy|establish|create|add|provide|ensure|enable|use|apply|maintain|manage|monitor|review|update|upgrade|replace|remove|disable|configure|set|define|assign|train|brief|coordinate|integrate|test|verify|validate|document|record|log|report|notify|alert|respond|restore|recover|mitigate|prevent|reduce|eliminate|minimize|maximize|optimize|improve|enhance|strengthen|secure|protect|defend|detect|identify|assess|evaluate|analyze|investigate|examine|inspect|audit)\b/gi;
  const verbMatches = text.match(actionVerbs);
  if (verbMatches && verbMatches.length >= 3 && commaCount >= 2) {
    return true;
  }
  
  return false;
}

/**
 * Validate and normalize risk drivers
 */
export function validateRiskDrivers(
  drivers: RiskDriver[]
): RiskDriverValidationResult {
  const errors: string[] = [];
  const normalized: RiskDriver[] = [];
  const seen = new Map<string, Set<string>>(); // driver_type -> Set of normalized texts
  const vulnerabilityMap = new Map<string, Map<string, number>>(); // vulnerability -> driver_type -> count

  if (!Array.isArray(drivers)) {
    return {
      ok: false,
      errors: ["risk_drivers must be an array"],
      normalized_drivers: []
    };
  }

  for (let i = 0; i < drivers.length; i++) {
    const driver = drivers[i];
    const prefix = `risk_drivers[${i}]`;

    // Validate driver_type
    if (!driver.driver_type || !["CYBER_DRIVER", "FRAUD_DRIVER"].includes(driver.driver_type)) {
      errors.push(`${prefix}.driver_type must be "CYBER_DRIVER" or "FRAUD_DRIVER"`);
      continue;
    }

    // Validate driver_text
    if (!driver.driver_text || typeof driver.driver_text !== "string" || driver.driver_text.trim().length === 0) {
      errors.push(`${prefix}.driver_text is required and must be a non-empty string`);
      continue;
    }

    // Normalize text
    const normalizedText = normalizeDriverText(driver.driver_text);
    
    if (normalizedText.length === 0) {
      errors.push(`${prefix}.driver_text is empty after normalization`);
      continue;
    }
    
    // C) Reject garbage concatenation
    if (isGarbageConcatenation(driver.driver_text)) {
      errors.push(
        `${prefix}: Risk driver text must describe a single initiating cause with physical-security impact. ` +
        `Found garbage concatenation: "${driver.driver_text.substring(0, 100)}${driver.driver_text.length > 100 ? '...' : ''}"`
      );
      continue;
    }
    
    // B) One driver per vulnerability validation
    if (driver.source_locator?.vulnerability) {
      const vulnerability = driver.source_locator.vulnerability.trim();
      if (vulnerability) {
        const vulnTypeMap = vulnerabilityMap.get(vulnerability) || new Map<string, number>();
        const currentCount = vulnTypeMap.get(driver.driver_type) || 0;
        vulnTypeMap.set(driver.driver_type, currentCount + 1);
        vulnerabilityMap.set(vulnerability, vulnTypeMap);
        
        if (currentCount > 0) {
          errors.push(
            `${prefix}: Multiple drivers of type "${driver.driver_type}" found for vulnerability "${vulnerability}". ` +
            `Only one driver per vulnerability per type is allowed.`
          );
          continue;
        }
      }
    }

    // Check for duplicates within the same driver_type
    const driverTypeSet = seen.get(driver.driver_type) || new Set<string>();
    
    // Check if this driver is equivalent to any existing driver of the same type
    let isDuplicate = false;
    for (const existingText of driverTypeSet) {
      if (areDriversEquivalent(normalizedText, existingText)) {
        isDuplicate = true;
        errors.push(
          `${prefix}: Duplicate risk driver detected. ` +
          `Driver text "${normalizedText}" is equivalent to existing "${existingText}" ` +
          `for driver_type "${driver.driver_type}". ` +
          `Risk drivers must be unique per vulnerability type.`
        );
        break;
      }
    }

    if (!isDuplicate) {
      driverTypeSet.add(normalizedText);
      seen.set(driver.driver_type, driverTypeSet);
      
      normalized.push({
        driver_type: driver.driver_type,
        driver_text: normalizedText
      });
    }
  }

  // Additional validation: ensure we don't have too many drivers per type
  // (one per vulnerability type is the rule, but if no vulnerability specified, allow one per type total)
  const cyberCount = normalized.filter(d => d.driver_type === "CYBER_DRIVER").length;
  const fraudCount = normalized.filter(d => d.driver_type === "FRAUD_DRIVER").length;
  
  // Only enforce "one per type" if vulnerabilities are not specified
  const hasVulnerabilityInfo = drivers.some(d => d.source_locator?.vulnerability);
  
  if (!hasVulnerabilityInfo) {
    if (cyberCount > 1) {
      errors.push(
        `Multiple CYBER_DRIVER entries found (${cyberCount}). ` +
        `Risk drivers must be one per vulnerability type. Consolidate into a single CYBER_DRIVER entry.`
      );
    }

    if (fraudCount > 1) {
      errors.push(
        `Multiple FRAUD_DRIVER entries found (${fraudCount}). ` +
        `Risk drivers must be one per vulnerability type. Consolidate into a single FRAUD_DRIVER entry.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized_drivers: normalized
  };
}
