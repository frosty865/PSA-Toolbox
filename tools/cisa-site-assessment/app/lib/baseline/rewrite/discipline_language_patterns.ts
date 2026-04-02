/**
 * Doctrine: language patterns by discipline for baseline existence questions.
 * Guidance only; does not expand scope or reference technology, vendors, or standards.
 */

export const DISCIPLINE_LANGUAGE_PATTERNS = {
  ACS: {
    defaultVerb: "used to control access",
    nounHandling: "system_or_process",
    examples: [
      "Are door readers used to control access to designated areas?",
      "Is electronic access control used to manage entry to controlled spaces?",
    ],
  },

  IDS: {
    defaultVerb: "used to detect or monitor",
    nounHandling: "detection_system",
    examples: [
      "Is intrusion detection used to monitor the facility perimeter?",
      "Are sensors used to detect unauthorized entry?",
    ],
  },

  INT: {
    defaultVerb: "used to restrict movement or provide protected space",
    nounHandling: "physical_space_or_barrier",
    examples: [
      "Are there designated secure rooms within the facility?",
      "Are hard interior barriers used to restrict movement within the facility?",
    ],
  },

  PER: {
    defaultVerb: "used to define or protect the perimeter",
    nounHandling: "boundary_or_barrier",
    examples: [
      "Is perimeter fencing used to define the facility boundary?",
      "Are gates used to control vehicle or pedestrian access?",
    ],
  },

  COM: {
    defaultVerb: "used to communicate or notify",
    nounHandling: "communication_method",
    examples: [
      "Is there a way for staff to communicate during incidents?",
      "Is there a way to notify occupants when protective actions are required?",
    ],
  },

  ISC: {
    defaultVerb: "identified for coordination or support",
    nounHandling: "relationship_or_point",
    examples: [
      "Are external coordination points identified for security or emergency support?",
    ],
  },
} as const;

export type DisciplineCode = keyof typeof DISCIPLINE_LANGUAGE_PATTERNS;

export function getDisciplinePattern(
  code: string | null | undefined
): (typeof DISCIPLINE_LANGUAGE_PATTERNS)[DisciplineCode] | null {
  if (!code || typeof code !== "string") return null;
  const key = code.trim().toUpperCase();
  return key in DISCIPLINE_LANGUAGE_PATTERNS
    ? (DISCIPLINE_LANGUAGE_PATTERNS as Record<string, (typeof DISCIPLINE_LANGUAGE_PATTERNS)[DisciplineCode]>)[key]
    : null;
}
