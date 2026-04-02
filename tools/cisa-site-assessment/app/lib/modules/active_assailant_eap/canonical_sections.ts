/**
 * Canonical expected section list for Active Assailant EAP.
 * Use to sanity-check Ollama extraction; Ollama should extract from the document, not from this list.
 */

export const ACTIVE_ASSAILANT_EAP_CANONICAL_SECTIONS = [
  "Applicability and Scope",
  "Key Roles and Responsibilities",
  "Floor Plans and Maps",
  "Facility Emergency Access Preparedness",
  "Emergency Communications",
  "Procedures for Evacuation, Lockdown, and Shelter-in-Place",
  "Response Procedures During an Active Assailant Incident",
  "Accountability",
  "Recovery",
  "Training and Exercises",
] as const;

/** Optional sub-sections per major section (for reference; extractor may find different sub-headings). */
export const CANONICAL_SUBELEMENTS: Record<string, readonly string[]> = {
  "Emergency Communications": [
    "Emergency Response Notification",
    "Internal Alert Notification Procedures",
    "External Alert Notification Procedures",
    "Public Information Coordination and Dissemination",
  ],
  "Procedures for Evacuation, Lockdown, and Shelter-in-Place": [
    "Evacuation Procedures",
    "Lockdown/Shelter-in-Place Procedures",
  ],
  "Response Procedures During an Active Assailant Incident": [
    "Individual Response Procedures",
    "When Law Enforcement Arrives",
  ],
  Accountability: ["Personnel and Procedures"],
  Recovery: [
    "Recovery Planning",
    "Community Resources",
    "Short-Term Recovery",
    "Mid- to Long-Term Recovery",
    "Business Continuity",
  ],
  "Training and Exercises": [
    "Individuals Responsible for Training",
    "Training",
    "Exercises",
  ],
};
