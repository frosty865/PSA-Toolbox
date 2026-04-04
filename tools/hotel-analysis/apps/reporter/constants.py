"""
Constants and regex patterns for the reporter (extracted from main.py).
"""
import re

# Category codes and display names for chart titles (charts only for these five)
CHART_CATEGORIES = (
    "ELECTRIC_POWER",
    "COMMUNICATIONS",
    "INFORMATION_TECHNOLOGY",
    "WATER",
    "WASTEWATER",
)
CATEGORY_DISPLAY = {
    "ELECTRIC_POWER": "Electric Power",
    "COMMUNICATIONS": "Communications",
    "INFORMATION_TECHNOLOGY": "Information Technology",
    "WATER": "Water",
    "WASTEWATER": "Wastewater",
    "CRITICAL_PRODUCTS": "Critical Products",  # no chart; contributes to VOFC only
}

# Canonical sector order for Part II (Technical Annex) — deterministic page breaks
SECTOR_ORDER = [
    "Electric Power",
    "Communications",
    "Information Technology",
    "Water",
    "Wastewater",
]
SECTOR_DISPLAY_TO_CODE = {CATEGORY_DISPLAY[c]: c for c in CHART_CATEGORIES}
# Template contract: narrative-only anchors (single template ADA/report template.docx)
CHART_ANCHORS = [f"[[CHART_{c}]]" for c in CHART_CATEGORIES]
TABLE_ANCHOR = "[[TABLE_SUMMARY]]"
DEP_SUMMARY_TABLE_ANCHOR = "[[DEP_SUMMARY_TABLE]]"
TABLE_DEPENDENCY_SUMMARY_ANCHOR = "[[TABLE_DEPENDENCY_SUMMARY]]"
IT_TRANSPORT_SECTION_ANCHOR = "[[IT_TRANSPORT_SECTION]]"
IT_HOSTED_SECTION_ANCHOR = "[[IT_HOSTED_SECTION]]"
VULN_NARRATIVE_ANCHOR = "[[VULN_NARRATIVE]]"
STRUCTURAL_PROFILE_SUMMARY_ANCHOR = "[[STRUCTURAL_PROFILE_SUMMARY]]"
DESIGNATION_SERVICES_ANCHOR = "[[DESIGNATION_SERVICES]]"
VULNERABILITY_COUNT_SUMMARY_ANCHOR = "[[VULNERABILITY_COUNT_SUMMARY]]"
VULNERABILITY_BLOCKS_ANCHOR = "[[VULNERABILITY_BLOCKS]]"
CROSS_INFRA_ANALYSIS_ANCHOR = "[[CROSS_INFRA_ANALYSIS]]"
SLA_PRA_SUMMARY_ANCHOR = "[[SLA_PRA_SUMMARY]]"
CROSS_DEPENDENCY_SUMMARY_ANCHOR = "[[CROSS_DEPENDENCY_SUMMARY]]"
NARRATIVE_SOURCES_ANCHOR = "[[NARRATIVE_SOURCES]]"
EXECUTIVE_SUMMARY_START_ANCHOR = "[[EXECUTIVE_SUMMARY_START]]"
VISUALIZATION_START_ANCHOR = "[[VISUALIZATION_START]]"

ANCHORS = {
    "CHART_ELECTRIC_POWER": "[[CHART_ELECTRIC_POWER]]",
    "CHART_COMMUNICATIONS": "[[CHART_COMMUNICATIONS]]",
    "CHART_INFORMATION_TECHNOLOGY": "[[CHART_INFORMATION_TECHNOLOGY]]",
    "CHART_WATER": "[[CHART_WATER]]",
    "CHART_WASTEWATER": "[[CHART_WASTEWATER]]",
    "VULN_NARRATIVE": VULN_NARRATIVE_ANCHOR,
    "TABLE_SUMMARY": "[[TABLE_SUMMARY]]",
    "SLA_PRA_SUMMARY": SLA_PRA_SUMMARY_ANCHOR,
}

# Headers that must NOT appear in output (export-style tables)
EXPORT_TABLE_BAD_HEADERS = {
    "Requires Service",
    "Time to Impact",
    "Time to Impact (hrs)",
    "Loss of Function",
    "Recovery Time",
    "Percent",
    "Capacity After Impact (No Backup)",
}

# Narrative blanks: "____" or longer underscores
UNDERSCORE_RE = re.compile(r"_{3,}")

# Canonical mapping: internal IDs / synonyms -> report display category
REPORT_CATEGORY_CANONICAL = {
    "ENERGY": "Energy",
    "ELECTRIC_POWER": "Energy",
    "ELECTRIC POWER": "Energy",
    "ELECTRIC_POWER_SUPPLY": "Energy",
    "POWER": "Energy",
    "COMMUNICATIONS": "Communications",
    "COMMS": "Communications",
    "INFORMATION_TECHNOLOGY": "Information Technology",
    "INFORMATION TECHNOLOGY": "Information Technology",
    "IT": "Information Technology",
    "INTERNET_PROVIDER": "Information Technology",
    "INTERNET PROVIDER": "Information Technology",
    "WATER": "Water",
    "WASTEWATER": "Wastewater",
    "SEWER": "Wastewater",
    "CRITICAL_PRODUCTS": "Critical Products",
    "CRITICAL PRODUCTS": "Critical Products",
}

# Dependency-only categories: fail fast if VOFC row is out-of-scope (e.g. physical security)
ALLOWED_DEP_CATEGORIES = {
    "Energy", "Communications", "Information Technology",
    "Water", "Wastewater", "Critical Products",
}

# Physical security keywords: reject from dependency VOFC table (wrong domain)
PHYSICAL_SECURITY_KEYWORDS = (
    "cctv", "ids", "badging", "keycard", "access levels", "terminated personnel",
    "exterior ids", "interior ids", "surveillance", "access control",
)

# Placeholder patterns that must not appear in output (Gate A)
FORBIDDEN_PLACEHOLDERS = ("TBD", "Insert ", "Region__", "Insert City", "Insert PSA")
# Gate A: Placeholder phrases (case-insensitive match)
GATE_A_PLACEHOLDER_PHRASES = ("choose an item", "insert", "tbd", "lorem ipsum", "trigger conditions met")
# Gate A: Unresolved anchor pattern
GATE_A_ANCHOR_RE = re.compile(r"\[\[[A-Z0-9_]+\]\]")
# Gate A: Deprecated terms (case-insensitive). "safe" = whole-word only (block SAFE acronym, allow "unsafe"/"safety")
GATE_A_DEPRECATED_TERMS = ("safe", "security assessment at first entry")
GATE_A_SAFE_WORD_BOUNDARY_RE = re.compile(r"\bsafe\b")

NOT_IDENTIFIED = "Not identified"  # Only when user explicitly answered NO
NOT_CONFIRMED = "not confirmed"   # When unknown, unset, or no data
SUMMARY_NOT_CONFIRMED_TEXT = "not confirmed"  # Notes when no explicit source data

# Known ISP/transport provider names (normalized). Used to route IT-1 providers to Internet Transport only.
_TRANSPORT_ISP_NORMALIZED = frozenset({
    "comcast", "xfinity", "at&t", "att", "at&t internet", "at&t fiber", "att internet", "att fiber",
    "verizon", "verizon fios", "verizon fios internet", "spectrum", "charter", "cox", "centurylink",
    "lumen", "frontier", "windstream", "earthlink", "optimum", "altice", "cogent", "zayo", "level3",
    "l3", "crown castle", "lumen technologies",
})

# Service Loss: plain-language description of what is lost if the hosted service is unreachable.
SERVICE_LOSS_DESCRIPTIONS = {
    "aws": "Loss of hosted compute used to run business applications and services.",
    "azure": "Loss of hosted compute used to run business applications and services.",
    "gcp": "Loss of hosted compute used to run business applications and services.",
    "oracle_cloud": "Loss of hosted compute used to run business applications and services.",
    "cloudflare": "Loss of name resolution and/or content delivery that supports public and internal services.",
    "cloudflare_zero_trust": "Loss of controlled access to external internet and remote access policy enforcement.",
    "m365": "Loss of email, calendaring, and collaboration tooling used for coordination.",
    "office_365": "Loss of email, calendaring, and collaboration tooling used for coordination.",
    "teams": "Loss of video and chat collaboration used for coordination.",
    "google_workspace": "Loss of email, calendaring, and collaboration tooling used for coordination.",
    "entra_id": "Loss of centralized authentication/authorization used for application access.",
    "okta": "Loss of centralized authentication/authorization used for application access.",
    "ping": "Loss of centralized authentication/authorization used for application access.",
    "zscaler": "Loss of controlled access to external internet and remote access policy enforcement.",
    "prisma_access": "Loss of controlled access to external internet and remote access policy enforcement.",
    "cisco_secure_client": "Loss of secure remote access used for workforce connectivity.",
    "fortinet_sase": "Loss of controlled access to external internet and remote access policy enforcement.",
    "sap_erp": "Loss of ERP and core business operations systems.",
    "oracle_erp": "Loss of ERP and core business operations systems.",
    "workday_hris": "Loss of HR and payroll management systems.",
    "adp_hris": "Loss of HR and payroll management systems.",
    "salesforce_crm": "Loss of customer relationship management and customer operations.",
    "stripe": "Loss of payments and e-commerce processing.",
    "paypal": "Loss of payments and e-commerce processing.",
    "shopify": "Loss of e-commerce platform operations.",
    "zoom": "Loss of video and voice meetings.",
    "ringcentral": "Loss of voice, video, and messaging.",
    "webex": "Loss of video and voice meetings.",
    "genesys_cloud": "Loss of contact center and customer engagement.",
    "twilio": "Loss of voice, SMS, and communications API capabilities.",
    "servicenow": "Loss of IT service management and ticketing.",
    "jira_confluence": "Loss of project tracking and documentation.",
    "datadog": "Loss of infrastructure and application monitoring.",
    "onedrive_sharepoint": "Loss of access to stored files/objects used for operations and applications.",
    "google_drive": "Loss of access to stored files/objects used for operations and applications.",
    "dropbox_business": "Loss of access to stored files/objects used for operations and applications.",
    "veeam_cloud_connect": "Loss of backup and disaster recovery capabilities.",
    "web_eoc": "Loss of emergency operations and crisis management tooling.",
    "physical_security_systems": "Loss of access control and video surveillance capabilities.",
}

# Legacy map (service type labels); used only when SERVICE_LOSS_DESCRIPTIONS has no match for backward compat.
SERVICE_LOSS_MAP = {
    "aws": "Virtual Servers / Cloud Compute Infrastructure",
    "azure": "Virtual Servers / Cloud Compute Infrastructure",
    "gcp": "Virtual Servers / Cloud Compute Infrastructure",
    "oracle_cloud": "Virtual Servers / Cloud Compute Infrastructure",
    "cloudflare": "DNS / CDN / Edge Security Services",
    "cloudflare_zero_trust": "Secure Internet Gateway / Zero Trust Network Access",
    "m365": "Email / Collaboration / Document Storage",
    "office_365": "Email / Collaboration / Document Storage",
    "teams": "Video and Chat Collaboration",
    "google_workspace": "Email / Collaboration / Document Storage",
    "entra_id": "Identity / Authentication / SSO",
    "okta": "Identity / Authentication / SSO",
    "ping": "Identity / Authentication / SSO",
    "zscaler": "Secure Internet Gateway / Zero Trust Network Access",
    "prisma_access": "Secure Internet Gateway / Remote Access",
    "cisco_secure_client": "Secure Remote Access / VPN",
    "fortinet_sase": "Secure Internet Gateway / Remote Access",
    "sap_erp": "ERP / Core Business Operations",
    "oracle_erp": "ERP / Core Business Operations",
    "workday_hris": "HR / Payroll Management System",
    "adp_hris": "HR / Payroll Management System",
    "salesforce_crm": "CRM / Customer Operations",
    "stripe": "Payments / E-commerce",
    "paypal": "Payments / E-commerce",
    "shopify": "E-commerce Platform",
    "zoom": "Video / Voice Meetings",
    "ringcentral": "Voice / Video / Messaging",
    "webex": "Video / Voice Meetings",
    "genesys_cloud": "Contact Center / Customer Engagement",
    "twilio": "Voice / SMS / Communications API",
    "servicenow": "IT Service Management / Ticketing",
    "jira_confluence": "Project Tracking / Documentation",
    "datadog": "Infrastructure / Application Monitoring",
    "onedrive_sharepoint": "File Storage / Document Collaboration",
    "google_drive": "File Storage / Document Collaboration",
    "dropbox_business": "File Storage / Sync",
    "veeam_cloud_connect": "Backup / Disaster Recovery",
    "web_eoc": "Emergency Operations / Crisis Management",
    "physical_security_systems": "Access Control / Video Surveillance",
}

# Primary function: descriptive, impact-oriented text per IT-2 service_id (what it does; impact if unavailable).
IT_SERVICE_ID_TO_PRIMARY_FUNCTION = {
    "aws": "Hosts applications and data; outage affects dependent systems and operations",
    "azure": "Hosts applications and data; outage affects dependent systems and operations",
    "gcp": "Hosts applications and data; outage affects dependent systems and operations",
    "oracle_cloud": "Hosts applications and data; outage affects dependent systems and operations",
    "cloudflare": "CDN and DDoS protection; outage affects web availability and attack resilience",
    "m365": "Email, collaboration, and file storage; outage affects internal communication and document access",
    "office_365": "Email, collaboration, and file storage; outage affects internal communication and document access",
    "teams": "Video and chat collaboration; outage affects meetings and real-time communication",
    "google_workspace": "Email, collaboration, and file storage; outage affects internal communication and document access",
    "entra_id": "Authentication and single sign-on; outage can lock users out of multiple systems",
    "okta": "Authentication and single sign-on; outage can lock users out of multiple systems",
    "ping": "Authentication and single sign-on; outage can lock users out of multiple systems",
    "zscaler": "Secure remote access and web filtering; outage affects remote workforce and secure internet access",
    "prisma_access": "Secure remote access and web filtering; outage affects remote workforce and secure internet access",
    "cisco_secure_client": "Secure remote access (VPN); outage affects remote workforce connectivity",
    "fortinet_sase": "Secure remote access and web filtering; outage affects remote workforce and secure internet access",
    "cloudflare_zero_trust": "Secure remote access and web filtering; outage affects remote workforce and secure internet access",
    "sap_erp": "ERP (finance, supply chain); outage affects core business processes and reporting",
    "oracle_erp": "ERP (finance, supply chain); outage affects core business processes and reporting",
    "workday_hris": "Payroll and HR; outage affects pay runs and HR operations",
    "adp_hris": "Payroll and HR; outage affects pay runs and HR operations",
    "salesforce_crm": "Customer relationship management; outage affects sales and customer support",
    "stripe": "Payment processing; outage affects revenue and transaction completion",
    "paypal": "Payment processing; outage affects revenue and transaction completion",
    "shopify": "E-commerce platform; outage affects online sales and order fulfillment",
    "zoom": "Video and voice meetings; outage affects internal and external communication",
    "ringcentral": "Voice, video, and messaging; outage affects internal and customer communication",
    "webex": "Video and voice meetings; outage affects internal and external communication",
    "genesys_cloud": "Contact center and customer engagement; outage affects customer support and routing",
    "twilio": "Voice, SMS, and communications API; outage affects customer contact and notifications",
    "servicenow": "IT service management and ticketing; outage affects incident and change management",
    "jira_confluence": "Project tracking and documentation; outage affects development and knowledge sharing",
    "datadog": "Infrastructure and application monitoring; outage affects visibility and incident detection",
    "onedrive_sharepoint": "File storage and collaboration; outage affects document access and sharing",
    "google_drive": "File storage and collaboration; outage affects document access and sharing",
    "dropbox_business": "File storage and sync; outage affects document access and sharing",
    "veeam_cloud_connect": "Backup and disaster recovery; outage affects recovery capability and RTO",
    "web_eoc": "Emergency operations and crisis management; outage affects incident coordination and situational awareness",
    "physical_security_systems": "Access control, video surveillance, and alarms (web-dependent); outage affects site security and monitoring",
    "other": None,  # Use service_other or "Other"
}

# Word insertion: fixed width+height (2.82:1) to preserve Excel ratio
CHART_W_INCHES = 6.0
CHART_H_INCHES = 6.0 / 2.82  # ≈ 2.13
CHART_SPACING_PT = 6
CHART_HEADING_SPACE_BEFORE_PT = 12
CHART_HEADING_SPACE_AFTER_PT = 6
CHART_IMAGE_SPACING_PT = 6

# Exact sector names for Section C headings (Heading 3)
SECTION_C_SECTOR_HEADINGS = {
    "ELECTRIC_POWER": "ELECTRIC POWER",
    "COMMUNICATIONS": "COMMUNICATIONS",
    "INFORMATION_TECHNOLOGY": "INFORMATION TECHNOLOGY",
    "WATER": "WATER",
    "WASTEWATER": "WASTEWATER",
}

# When mitigated loss is unknown, replace the 5th-blank clause with this (no "Not identified % loss").
MITIGATED_UNKNOWN_CLAUSE = "may reduce operational loss; the mitigated loss percentage was not confirmed."

# Column widths in inches (match template; total ~6.5 for printable width)
VOFC_COL_WIDTHS = [1.4, 2.4, 2.7]
CHOOSE_AN_ITEM = "Choose an item."
GATE_D_MAX_FINDINGS_PER_SECTOR = 6
REPORT_MAX_FINDINGS_PER_SECTOR_MAIN = 6  # Main report (CRITICAL INFRASTRUCTURE) can show up to 6 per sector
GATE_D_TRUNCATION_NOTE = "Additional findings exist but are not displayed in this brief."
NEUTRAL_OFC = "The facility may consider reviewing this condition to determine whether risk reduction actions are feasible."
# Terms that indicate cyber program content (IT category only); do not change vulnerability text.
CYBER_TERMS_RE = re.compile(
    r"\b(cyber|cybersecurity|incident|NIST|ICS-CERT|US-CERT|ISAC|plan|training|exercise|scan|segmentation)\b",
    re.IGNORECASE,
)
DEPENDENCY_VOFC_HEADING = "Infrastructure Dependency Vulnerabilities and Options for Consideration"  # Legacy; replaced by SECTOR_REPORTS_HEADING
SECTOR_REPORTS_HEADING = "Sector Reports"
ANNEX_OVERVIEW_HEADING = "Annex Overview"
CYBER_VOFC_HEADING = "Cybersecurity Program & Resilience Vulnerabilities and Options for Consideration"

# Franklin-based typography for Part II vulnerability blocks (government-doc look)
FRANKLIN_FONT_DEMI = "Franklin Gothic Demi"
FRANKLIN_FONT_MEDIUM = "Franklin Gothic Medium"
FRANKLIN_FONT_BOOK = "Franklin Gothic Book"
ADA_VULN_STYLE_NAMES = (
    "ADA_Vuln_Header",
    "ADA_Vuln_Severity",
    "ADA_Vuln_Meta",
    "ADA_Vuln_Label",
    "ADA_Vuln_Body",
    "ADA_Vuln_Bullets",
    "ADA_Vuln_Numbered",
)
REQUIRED_ADA_STYLES = [
    "ADA_Vuln_Header",
    "ADA_Vuln_Severity",
    "ADA_Vuln_Meta",
    "ADA_Vuln_Label",
    "ADA_Vuln_Body",
    "ADA_Vuln_Bullets",
    "ADA_Vuln_Numbered",
]

# Canonical category order for Part II themed findings (matches export)
_PART2_CATEGORY_ORDER = (
    "ELECTRIC_POWER",
    "COMMUNICATIONS",
    "INFORMATION_TECHNOLOGY",
    "WATER",
    "WASTEWATER",
)
_SEVERITY_ORDER = ("HIGH", "ELEVATED", "MODERATE", "LOW")

# Sector page structure: Chart, Chart Synopsis, Vulnerabilities, OFCs, References (per vuln block)
VULNERABILITIES_HEADING = "Vulnerabilities"
CHART_SYNOPSIS_HEADING = "Chart Synopsis"

# Narrative-only: inject at each INFRA_* anchor; Part II uses [[VULN_NARRATIVE]]. Order matches SECTOR_ORDER.
INFRA_ANCHOR_SECTORS = [
    ("[[INFRA_ENERGY]]", "ELECTRIC_POWER", "Electric Power"),
    ("[[INFRA_COMMS]]", "COMMUNICATIONS", "Communications"),
    ("[[INFRA_IT]]", "INFORMATION_TECHNOLOGY", "Information Technology"),
    ("[[INFRA_WATER]]", "WATER", "Water"),
    ("[[INFRA_WASTEWATER]]", "WASTEWATER", "Wastewater"),
]
INFRA_MAP = {
    "[[INFRA_ENERGY]]": "INFRA_ENERGY",
    "[[INFRA_COMMS]]": "INFRA_COMMS",
    "[[INFRA_IT]]": "INFRA_IT",
    "[[INFRA_WATER]]": "INFRA_WATER",
    "[[INFRA_WASTEWATER]]": "INFRA_WASTEWATER",
}

# Fit within 6.5" printable width (letter 8.5" - 1" margins); fixed layout + noWrap on Category
SUMMARY_COL_WIDTHS = [1.35, 1.0, 0.8, 0.85, 0.85, 1.65]
SUMMARY_HEADERS_6 = (
    "Category",
    "Provider Identified",
    "Backup Present",
    "Time to Severe Impact (hrs)",
    "Recovery Time (hrs)",
    "Notes",
)

SLA_PRA_SUMMARY_TITLE = "Service Restoration Reliability Summary"
IT_SCOPE_CLARIFICATION = (
    "Scope Clarification: Information Technology evaluates externally hosted or managed digital services "
    "(SaaS, cloud applications, hosted identity, managed IT providers). Systems owned and operated by the "
    "facility are treated as critical assets and are not assessed as dependencies here. Communications "
    "evaluates carrier-based transport services (ISP circuits, fiber, wireless, satellite)."
)

# Sector headings for INFRA blocks (enforced in reporter for consistent layout)
INFRA_ANCHOR_TO_SECTOR_HEADING = {
    "[[INFRA_ENERGY]]": "ELECTRIC POWER",
    "[[INFRA_COMMS]]": "COMMUNICATIONS",
    "[[INFRA_IT]]": "INFORMATION TECHNOLOGY",
    "[[INFRA_WATER]]": "WATER",
    "[[INFRA_WASTEWATER]]": "WASTEWATER",
}

NO_VULNERABILITIES_TRIGGERED = "No vulnerabilities were triggered based on provided inputs."
VULN_BLOCK_SPACER_PT = 6
VULN_NARRATIVE_SPACING_PT = 6
VULN_OFC_ITEM_SPACING_PT = 3
VULN_DIVIDER_SPACING_PT = 9  # Between vulnerability blocks

# Standalone sector names that must not appear as orphan headings in Part I
ORPHAN_SECTOR_NAMES = frozenset({
    "Electric Power", "COMMUNICATIONS", "Information Technology", "Water", "Wastewater",
    "ELECTRIC POWER", "Communications", "INFORMATION TECHNOLOGY", "WATER", "WASTEWATER",
})
# Ghost sector lines: standalone labels that must not appear in Part I (template + renderer safeguard)
SECTOR_GHOST_LINES = frozenset({
    "ELECTRIC POWER",
    "COMMUNICATIONS",
    "INFORMATION TECHNOLOGY",
    "WATER",
    "WASTEWATER",
})

# ADA Report v2: anchors that get fallback text when no engine data (not removed). Part I no longer has INFRA_*.
PLACEHOLDER_ANCHORS_WITH_FALLBACK = (
    "[[SNAPSHOT_POSTURE]]",
    "[[SNAPSHOT_SUMMARY]]",
    "[[SNAPSHOT_DRIVERS]]",
    "[[SNAPSHOT_MATRIX]]",
    "[[SNAPSHOT_CASCADE]]",
    "[[SYNTHESIS]]",
    "[[PRIORITY_ACTIONS]]",
)
FALLBACK_NO_FINDINGS = "No structural vulnerabilities identified based on provided inputs."
FALLBACK_WITH_FINDINGS = ""

# Required anchors for narrative-only template (Part I + Part II). Used by qc_pipeline.
REQUIRED_ANCHORS = (
    "[[SNAPSHOT_POSTURE]]",
    "[[SNAPSHOT_SUMMARY]]",
    "[[SNAPSHOT_DRIVERS]]",
    "[[SNAPSHOT_MATRIX]]",
    "[[SNAPSHOT_CASCADE]]",
    "[[CHART_ELECTRIC_POWER]]",
    "[[CHART_COMMUNICATIONS]]",
    "[[CHART_INFORMATION_TECHNOLOGY]]",
    "[[CHART_WATER]]",
    "[[CHART_WASTEWATER]]",
    "[[SYNTHESIS]]",
    "[[PRIORITY_ACTIONS]]",
    "[[TABLE_DEPENDENCY_SUMMARY]]",
    "[[STRUCTURAL_PROFILE_SUMMARY]]",
    "[[VULNERABILITY_COUNT_SUMMARY]]",
    "[[VULNERABILITY_BLOCKS]]",
    "[[CROSS_INFRA_ANALYSIS]]",
)
OPTIONAL_ANCHORS = ("[[SLA_PRA_SUMMARY]]", "[[CROSS_DEPENDENCY_SUMMARY]]", "[[NARRATIVE_SOURCES]]", "[[DESIGNATION_SERVICES]]")
