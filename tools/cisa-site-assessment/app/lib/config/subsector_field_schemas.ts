export type FieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "multiselect";

export type FieldSchema = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
};

export type SubsectorSchema = {
  subsector_code: string;
  title: string;
  fields: FieldSchema[];
  allowed_modules?: string[]; // module codes allowed for this subsector
};

export const SUBSECTOR_SCHEMAS: Record<string, SubsectorSchema> = {
  // Example: Mass Gathering / Public Venues
  "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES": {
    subsector_code: "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES",
    title: "Mass Gathering / Public Venues",
    fields: [
      { key: "event_type", label: "Event type", type: "select", options: [
        { value: "SPORTS", label: "Sports" },
        { value: "CONCERT", label: "Concert" },
        { value: "FESTIVAL", label: "Festival" },
        { value: "CONFERENCE", label: "Conference" },
        { value: "OTHER", label: "Other" }
      ]},
      { key: "max_occupancy", label: "Max occupancy (if known)", type: "number" },
      { key: "avg_attendance", label: "Average attendance (if known)", type: "number" },
      { key: "open_to_public", label: "Open to the public", type: "checkbox" }
    ],
    allowed_modules: [
      "MODULE_PUBLIC_VENUE_CROWD_MANAGEMENT",
      "MODULE_PUBLIC_VENUE_CREDENTIALING",
      "MODULE_PUBLIC_INFORMATION",
      "MODULE_MEDICAL_SUPPORT",
      "MODULE_INSIDER_THREAT"
    ]
  }
};
