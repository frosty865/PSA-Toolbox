export type DigitalServiceId =
  | "aws"
  | "azure"
  | "gcp"
  | "oracle_cloud"
  | "cloudflare"
  | "m365"
  | "office_365"
  | "teams"
  | "google_workspace"
  | "entra_id"
  | "okta"
  | "ping"
  | "zscaler"
  | "prisma_access"
  | "cisco_secure_client"
  | "fortinet_sase"
  | "cloudflare_zero_trust"
  | "sap_erp"
  | "oracle_erp"
  | "workday_hris"
  | "adp_hris"
  | "salesforce_crm"
  | "stripe"
  | "paypal"
  | "shopify"
  | "zoom"
  | "ringcentral"
  | "webex"
  | "genesys_cloud"
  | "twilio"
  | "servicenow"
  | "jira_confluence"
  | "datadog"
  | "onedrive_sharepoint"
  | "google_drive"
  | "dropbox_business"
  | "veeam_cloud_connect"
  | "web_eoc"
  | "physical_security_systems"
  | "other";

export type DigitalServiceGroup =
  | "Cloud infrastructure / hosting"
  | "Email / productivity"
  | "Identity / access"
  | "Network edge / remote access"
  | "Core business systems"
  | "Payments / e-commerce"
  | "Communications / contact center"
  | "IT service / monitoring"
  | "Backups / storage"
  | "Other";

export interface DigitalServiceOption {
  id: DigitalServiceId;
  label: string;
  group: DigitalServiceGroup;
  provider?: string;
  hint?: string;
}

export const DIGITAL_SERVICE_OPTIONS: DigitalServiceOption[] = [
  { id: "aws", label: "Amazon Web Services (AWS)", group: "Cloud infrastructure / hosting", provider: "Amazon" },
  { id: "azure", label: "Microsoft Azure", group: "Cloud infrastructure / hosting", provider: "Microsoft" },
  { id: "gcp", label: "Google Cloud Platform (GCP)", group: "Cloud infrastructure / hosting", provider: "Google" },
  { id: "oracle_cloud", label: "Oracle Cloud", group: "Cloud infrastructure / hosting", provider: "Oracle" },
  { id: "cloudflare", label: "Cloudflare", group: "Cloud infrastructure / hosting", provider: "Cloudflare" },

  { id: "m365", label: "Microsoft 365 (Exchange/Teams/SharePoint)", group: "Email / productivity", provider: "Microsoft" },
  { id: "office_365", label: "Office 365", group: "Email / productivity", provider: "Microsoft" },
  { id: "teams", label: "Microsoft Teams", group: "Communications / contact center", provider: "Microsoft" },
  { id: "google_workspace", label: "Google Workspace (Gmail/Drive/Meet)", group: "Email / productivity", provider: "Google" },

  { id: "entra_id", label: "Microsoft Entra ID (Azure AD)", group: "Identity / access", provider: "Microsoft" },
  { id: "okta", label: "Okta", group: "Identity / access", provider: "Okta" },
  { id: "ping", label: "Ping Identity", group: "Identity / access", provider: "Ping Identity" },

  { id: "zscaler", label: "Zscaler", group: "Network edge / remote access", provider: "Zscaler" },
  { id: "prisma_access", label: "Palo Alto Prisma Access", group: "Network edge / remote access", provider: "Palo Alto Networks" },
  { id: "cisco_secure_client", label: "Cisco Secure Client (AnyConnect)", group: "Network edge / remote access", provider: "Cisco" },
  { id: "fortinet_sase", label: "Fortinet SASE / FortiSASE", group: "Network edge / remote access", provider: "Fortinet" },
  { id: "cloudflare_zero_trust", label: "Cloudflare Zero Trust", group: "Network edge / remote access", provider: "Cloudflare" },

  { id: "sap_erp", label: "ERP (SAP)", group: "Core business systems", provider: "SAP" },
  { id: "oracle_erp", label: "ERP (Oracle)", group: "Core business systems", provider: "Oracle" },
  { id: "workday_hris", label: "HRIS (Workday)", group: "Core business systems", provider: "Workday" },
  { id: "adp_hris", label: "HRIS (ADP Workforce Now)", group: "Core business systems", provider: "ADP" },
  { id: "salesforce_crm", label: "CRM (Salesforce)", group: "Core business systems", provider: "Salesforce" },

  { id: "stripe", label: "Stripe", group: "Payments / e-commerce", provider: "Stripe" },
  { id: "paypal", label: "PayPal", group: "Payments / e-commerce", provider: "PayPal" },
  { id: "shopify", label: "Shopify", group: "Payments / e-commerce", provider: "Shopify" },

  { id: "zoom", label: "Zoom", group: "Communications / contact center", provider: "Zoom" },
  { id: "ringcentral", label: "RingCentral", group: "Communications / contact center", provider: "RingCentral" },
  { id: "webex", label: "Cisco Webex", group: "Communications / contact center", provider: "Cisco" },
  { id: "genesys_cloud", label: "Genesys Cloud", group: "Communications / contact center", provider: "Genesys" },
  { id: "twilio", label: "Twilio", group: "Communications / contact center", provider: "Twilio" },

  { id: "servicenow", label: "ServiceNow", group: "IT service / monitoring", provider: "ServiceNow" },
  { id: "jira_confluence", label: "Atlassian Jira / Confluence", group: "IT service / monitoring", provider: "Atlassian" },
  { id: "datadog", label: "Datadog", group: "IT service / monitoring", provider: "Datadog" },

  { id: "onedrive_sharepoint", label: "Microsoft OneDrive/SharePoint", group: "Backups / storage", provider: "Microsoft" },
  { id: "google_drive", label: "Google Drive", group: "Backups / storage", provider: "Google" },
  { id: "dropbox_business", label: "Dropbox Business", group: "Backups / storage", provider: "Dropbox" },
  { id: "veeam_cloud_connect", label: "Veeam Cloud Connect", group: "Backups / storage", provider: "Veeam" },

  { id: "web_eoc", label: "WEB EOC", group: "Core business systems", provider: "Juvare" },
  { id: "physical_security_systems", label: "Physical Security Systems", group: "Core business systems", provider: undefined },

  { id: "other", label: "Other (specify)", group: "Other" },
];

export function getDigitalServiceOption(id: string | undefined | null): DigitalServiceOption | undefined {
  if (!id) return undefined;
  return DIGITAL_SERVICE_OPTIONS.find((o) => o.id === id);
}
