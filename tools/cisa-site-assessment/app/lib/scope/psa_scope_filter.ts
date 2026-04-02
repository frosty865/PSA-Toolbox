/**
 * PSA scope filter: tiered detectors for convergence (OK) vs deep network/technical cyber (not OK).
 * SCO outputs must remain facility-operational and existence-based.
 * Convergence language is permitted only as "coordination / roles / procedures" statements.
 */

const DEEP_NETWORK_TERMS = [
  "wan",
  "lan",
  "wlan",
  "vlan",
  "ip ",
  "tcp",
  "udp",
  "dns",
  "dhcp",
  "routing",
  "router",
  "switch",
  "nat",
  "port ",
  "ports",
  "protocol",
  "api",
  "endpoint",
  "certificate",
  "tls",
  "ssh",
  "vpn",
  "zero trust",
  "firewall",
  "ids/ips",
  "intrusion prevention",
  "siem",
  "edr",
  "xdr",
  "malware",
  "ransomware",
  "scada",
  "ics",
  "ot",
  "it network",
  "network architecture",
  "network segregation",
  "segmentation",
  "firmware",
  "software update",
  "patch",
  "cve",
  "digital signature",
  "signing",
  "hash",
  "checksum",
  "secure boot",
  "code signing",
  "supply chain",
  "authentication terminal",
  "server management interface",
  "cpo central system",
];

const PURPOSE_ROLE_TECH =
  /\b(purpose|role)\s+of\b/i;
// Technical terms that with "purpose of" / "role of" indicate deep cyber. Exclude "interface" alone so governance "interface between physical security and IT" is allowed.
const PURPOSE_ROLE_TECH_TERMS =
  /\b(wan|lan|vlan|ip|firmware|software|server|terminal|protocol|api|signature|certificate|encryption)\b/i;

/** Short terms that must match as whole words only (e.g. "ot" in "ICS/OT", "nat" not in "coordination"). */
const DEEP_NETWORK_TERMS_WORD_BOUNDARY = ["ot", "ip", "nat", "siem", "edr", "xdr", "ics"];

/** Normalize term for word-boundary check (trim so "ip " matches list "ip"). */
function termNeedsWordBoundary(term: string): boolean {
  return DEEP_NETWORK_TERMS_WORD_BOUNDARY.includes(term.trim());
}

/**
 * Returns true if text contains deep network/technical cyber content (must be excluded from SCO generation).
 */
export function containsDeepNetworkCyber(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  for (const term of DEEP_NETWORK_TERMS) {
    const trimmed = term.trim();
    if (termNeedsWordBoundary(term)) {
      if (new RegExp(`\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))
        return true;
    } else if (lower.includes(term)) return true;
  }
  if (PURPOSE_ROLE_TECH.test(text) && PURPOSE_ROLE_TECH_TERMS.test(text)) return true;
  return false;
}

const CONVERGENCE_TERMS = [
  "convergence",
  "coordination",
  "interface",
  "liaison",
  "roles and responsibilities",
  "escalation",
  "incident coordination",
  "joint",
  "cross-functional",
  "interdepartmental",
  "physical security and it",
  "security and it",
  "security and operations",
  "change management",
  "maintenance coordination",
  "vendor coordination",
];

/**
 * Returns true if text contains convergence/coordination terms WITHOUT triggering containsDeepNetworkCyber.
 * Use to allow governance-level convergence content; do not use to reject (convergence is allowed).
 */
export function containsConvergenceOnly(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  if (containsDeepNetworkCyber(text)) return false;
  const lower = text.toLowerCase();
  for (const term of CONVERGENCE_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}

/**
 * Returns true if trimmed text starts with "plan element exists:" (case-insensitive).
 * Such prefix is forbidden in SCO criteria output.
 */
export function containsForbiddenPlanElementPrefix(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return /^\s*plan element exists:\s*/i.test(text.trim());
}
