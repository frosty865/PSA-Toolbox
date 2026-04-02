/**
 * Module Question Inference - Convergence Bridge
 * 
 * Deterministic inference that:
 * - Detects cyber/fraud drivers in content
 * - Stores them as context (module_risk_drivers)
 * - Generates PSA-scope questions addressing physical impact readiness
 * - Does NOT generate cyber control requirements
 */

export type QuestionIntent =
  | "PHYSICAL_CONTROL"
  | "GOVERNANCE_INTERFACE"
  | "CONTINUITY_OPERATIONS"
  | "DETECTION_ALERTING_PHYSICAL";

export type RiskDriverType = "CYBER_DRIVER" | "FRAUD_DRIVER";

export interface InferredQuestion {
  module_question_id: string;
  question_text: string;
  question_intent: QuestionIntent;
  question_order: number;
}

export interface DetectedDriver {
  driver_type: RiskDriverType;
  driver_text: string;
}

// Cyber driver detection keywords
const CYBER_KEYWORDS = [
  "cyber",
  "ransomware",
  "malware",
  "network",
  "api",
  "breach",
  "authentication",
  "encryption",
  "traffic",
  "remote access",
  "intrusion",
  "vulnerability",
  "exploit",
  "hack",
  "attack",
  "data breach",
  "unauthorized access",
  "system compromise",
];

// Fraud driver detection keywords
const FRAUD_KEYWORDS = [
  "skimming",
  "fraud",
  "payment",
  "transaction",
  "card",
  "identity theft",
  "financial",
  "theft",
  "unauthorized transaction",
];

// Bridge question templates (deterministic)
const BRIDGE_QUESTIONS: Record<QuestionIntent, string[]> = {
  GOVERNANCE_INTERFACE: [
    "Are roles and responsibilities defined for coordinating physical security response when technology-enabled services that support physical security are disrupted?",
    "Is there a documented escalation path and contact method with responsible service providers for technology-enabled systems that affect physical security?",
  ],
  CONTINUITY_OPERATIONS: [
    "Are procedures in place to maintain controlled access and visitor processing during outages or disruptions of technology-enabled systems that support physical security?",
    "Are compensating measures identified for maintaining monitoring and response when technology-enabled systems supporting physical security are degraded or unavailable?",
  ],
  DETECTION_ALERTING_PHYSICAL: [
    "Are there mechanisms to detect and report abnormal conditions at physical-security-relevant equipment locations (e.g., enclosures, cabinets, control points) that could indicate tampering or disruption?",
  ],
  PHYSICAL_CONTROL: [
    "Is physical access to system components that support physical security restricted to authorized personnel?",
  ],
};

// Keywords that trigger DETECTION_ALERTING_PHYSICAL questions
const DETECTION_TRIGGERS = [
  "tamper",
  "unauthorized access",
  "cabinet",
  "hardware",
  "enclosure",
  "panel",
  "equipment",
  "component",
];

/**
 * Detect risk drivers in text content
 */
export function detectRiskDrivers(text: string): DetectedDriver[] {
  const drivers: DetectedDriver[] = [];
  const lowerText = text.toLowerCase();

  // Check for cyber drivers
  const hasCyberDriver = CYBER_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
  if (hasCyberDriver) {
    // Extract relevant sentences (limit to first 2 sentences containing keywords)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const relevantSentences = sentences
      .filter((s) =>
        CYBER_KEYWORDS.some((kw) =>
          s.toLowerCase().includes(kw.toLowerCase())
        )
      )
      .slice(0, 2)
      .map((s) => s.trim())
      .join(" ");
    
    if (relevantSentences) {
      drivers.push({
        driver_type: "CYBER_DRIVER",
        driver_text: relevantSentences.substring(0, 500), // Limit length
      });
    }
  }

  // Check for fraud drivers
  const hasFraudDriver = FRAUD_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
  if (hasFraudDriver) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const relevantSentences = sentences
      .filter((s) =>
        FRAUD_KEYWORDS.some((kw) => s.toLowerCase().includes(kw.toLowerCase()))
      )
      .slice(0, 2)
      .map((s) => s.trim())
      .join(" ");
    
    if (relevantSentences) {
      drivers.push({
        driver_type: "FRAUD_DRIVER",
        driver_text: relevantSentences.substring(0, 500),
      });
    }
  }

  return drivers;
}

/**
 * Infer module questions from vulnerabilities/options content
 * Generates PSA-scope questions addressing physical impact readiness
 */
export function inferModuleQuestions(
  moduleCode: string,
  vulnerabilities: Array<{
    vulnerability?: string;
    possible_impact?: string;
    options_for_consideration?: Array<{ option?: string; reference?: string }>;
  }>,
  detectedDrivers: DetectedDriver[]
): InferredQuestion[] {
  const questions: InferredQuestion[] = [];
  const questionTextSet = new Set<string>(); // For deduplication

  // Only generate questions if drivers were detected
  if (detectedDrivers.length === 0) {
    return questions;
  }

  // Extract all text content for analysis
  const allText = vulnerabilities
    .map((v) => [
      v.vulnerability || "",
      v.possible_impact || "",
      ...(v.options_for_consideration || []).map((o) => o.option || ""),
    ])
    .flat()
    .join(" ")
    .toLowerCase();

  const hasDetectionTriggers = DETECTION_TRIGGERS.some((trigger) =>
    allText.includes(trigger.toLowerCase())
  );

  // Generate minimal set of bridge questions
  let orderIndex = 1;

  // 1. PHYSICAL_CONTROL (always generated if drivers exist)
  const physicalControlQ = BRIDGE_QUESTIONS.PHYSICAL_CONTROL[0];
  if (!questionTextSet.has(physicalControlQ)) {
    questions.push({
      module_question_id: generateQuestionId(moduleCode, orderIndex),
      question_text: physicalControlQ,
      question_intent: "PHYSICAL_CONTROL",
      question_order: orderIndex++,
    });
    questionTextSet.add(physicalControlQ);
  }

  // 2. DETECTION_ALERTING_PHYSICAL (if triggers present)
  if (hasDetectionTriggers) {
    const detectionQ = BRIDGE_QUESTIONS.DETECTION_ALERTING_PHYSICAL[0];
    if (!questionTextSet.has(detectionQ)) {
      questions.push({
        module_question_id: generateQuestionId(moduleCode, orderIndex),
        question_text: detectionQ,
        question_intent: "DETECTION_ALERTING_PHYSICAL",
        question_order: orderIndex++,
      });
      questionTextSet.add(detectionQ);
    }
  }

  // 3. CONTINUITY_OPERATIONS (always generated if drivers exist)
  const continuityQ = BRIDGE_QUESTIONS.CONTINUITY_OPERATIONS[0];
  if (!questionTextSet.has(continuityQ)) {
    questions.push({
      module_question_id: generateQuestionId(moduleCode, orderIndex),
      question_text: continuityQ,
      question_intent: "CONTINUITY_OPERATIONS",
      question_order: orderIndex++,
    });
    questionTextSet.add(continuityQ);
  }

  // 4. GOVERNANCE_INTERFACE (always generated if drivers exist)
  const governanceQ = BRIDGE_QUESTIONS.GOVERNANCE_INTERFACE[0];
  if (!questionTextSet.has(governanceQ)) {
    questions.push({
      module_question_id: generateQuestionId(moduleCode, orderIndex),
      question_text: governanceQ,
      question_intent: "GOVERNANCE_INTERFACE",
      question_order: orderIndex++,
    });
    questionTextSet.add(governanceQ);
  }

  return questions;
}

/**
 * Generate deterministic module question ID
 * Format: MODULEQ_<MODULESHORT>_###
 */
function generateQuestionId(moduleCode: string, index: number): string {
  // Extract short name from module code (e.g., MODULE_EV_CHARGING -> EV_CHARGING)
  const shortName = moduleCode.replace(/^MODULE_/, "");
  const paddedIndex = String(index).padStart(3, "0");
  return `MODULEQ_${shortName}_${paddedIndex}`;
}

/**
 * Filter out cyber/fraud control options from being converted to questions
 * Returns count of filtered items
 */
export function filterCyberFraudControls(
  options: Array<{ option?: string; reference?: string }>
): {
  filtered: Array<{ option?: string; reference?: string }>;
  filteredCount: number;
} {
  const cyberFraudControlKeywords = [
    "encryption",
    "authentication",
    "2fa",
    "two-factor",
    "network monitoring",
    "traffic",
    "anomaly",
    "patching",
    "malware",
    "ids",
    "ips",
    "soc",
    "pci",
    "transaction security",
    "anti-skimming",
    "config baseline",
    "logging",
    "segmentation",
  ];

  const filtered: Array<{ option?: string; reference?: string }> = [];
  let filteredCount = 0;

  for (const opt of options) {
    const optionText = (opt.option || "").toLowerCase();
    const isCyberFraudControl = cyberFraudControlKeywords.some((keyword) =>
      optionText.includes(keyword.toLowerCase())
    );

    if (isCyberFraudControl) {
      filteredCount++;
      // Don't add to filtered array - we're just counting
    } else {
      filtered.push(opt);
    }
  }

  return { filtered, filteredCount };
}
