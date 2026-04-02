/**
 * Standard (SCO) questions prompt rules: allow convergence at governance level,
 * forbid deep network/technical cyber. Deterministic rules for injection into generator prompts.
 */

export const STANDARD_QUESTIONS_ALLOWED = `
ALLOWED:
- Convergence questions about coordination, roles, procedures, escalation, and documentation between physical security and IT/cyber functions.
`;

export const STANDARD_QUESTIONS_FORBIDDEN = `
FORBIDDEN:
- Any network/protocol/architecture questions (WAN/LAN/VLAN/IP, segmentation, firewall, IDS/IPS, VPN, TLS, certificates)
- Any firmware/software integrity mechanisms (digital signatures, code signing, secure boot, patching)
- Any "purpose of" or "role of" technical components (interfaces, servers, terminals)
`;

export const STANDARD_QUESTIONS_FORM_CONSTRAINTS = `
Question form constraints (must comply):
- Every criterion MUST be answerable Yes/No/N/A.
- Every criterion MUST start with Does/Do/Is/Are/Has/Have (never What/How/Why).
- Existence-based, facility-operational:
  "Does the facility have…?"
  "Is there a defined…?"
  "Are roles/responsibilities documented…?"
- Do not ask about the purpose/role of technical components; ask whether a facility has an operational capability/policy/process.
- No deep technical cyber/network controls.
- Prohibit:
  "What/How/Why…"
  "Is the purpose of…"
  "Is the role of…"
- Before outputting, scan criteria and rewrite any that start with What/How into Does/Is/Are form.
`;

export const STANDARD_QUESTIONS_POSITIVE_EXAMPLES = [
  "Are roles and responsibilities defined between physical security and IT for incident coordination affecting EV charging areas?",
  "Is there a documented escalation path between physical security and IT for issues that could affect charging station operations?",
];

export const STANDARD_QUESTIONS_NEGATIVE_EXAMPLES = [
  "Is the purpose of the WAN interface for enforcing access control?",
  "Is network segregation used to limit impacts?",
];

/** Full block to inject into standard/SCO criteria-generation prompts. */
export function getStandardQuestionsPromptRules(): string {
  return [
    STANDARD_QUESTIONS_ALLOWED,
    STANDARD_QUESTIONS_FORBIDDEN,
    STANDARD_QUESTIONS_FORM_CONSTRAINTS,
    "\nPositive examples (convergence-OK):",
    ...STANDARD_QUESTIONS_POSITIVE_EXAMPLES.map((e) => `- "${e}"`),
    "\nNegative examples (forbidden):",
    ...STANDARD_QUESTIONS_NEGATIVE_EXAMPLES.map((e) => `- "${e}"`),
  ].join("\n");
}
