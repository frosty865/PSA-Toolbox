/**
 * Resolve critical element seeds from section title intent (generic plan types).
 * NOT a plan pack: broad, reusable intents. Ensures at least one element per section.
 */

export type IntentElementSeed = {
  element_title: string;
  observation: string;
};

function flatDoc(s: string): string {
  const t = (s ?? "").trim();
  if (t.endsWith("is not documented.") || t.endsWith("is not specified.")) return t;
  return t ? `${t} is not documented.` : "is not documented.";
}

export function resolveIntentElements(sectionTitle: string): IntentElementSeed[] {
  const t = sectionTitle.toLowerCase();

  if (t.includes("applicability") || t.includes("scope")) {
    return [{ element_title: "Applicability and scope", observation: "Applicability and scope are not documented." }];
  }

  if (t.includes("roles") || t.includes("responsibilities")) {
    return [
      { element_title: "Roles and responsibilities", observation: "Roles and responsibilities are not documented." },
      { element_title: "Points of contact", observation: "Points of contact are not documented." },
    ];
  }

  if (t.includes("communications") || t.includes("notification") || t.includes("alert")) {
    return [
      { element_title: "Internal notification procedures", observation: "Internal notification procedures are not documented." },
      { element_title: "External notification procedures", observation: "External notification procedures are not documented." },
      { element_title: "Communications roles and responsibilities", observation: "Communications roles and responsibilities are not documented." },
    ];
  }

  if (t.includes("evacuation") || t.includes("lockdown") || t.includes("shelter")) {
    return [
      { element_title: "Decision authority", observation: "Decision authority is not specified." },
      { element_title: "Evacuation procedures", observation: "Evacuation procedures are not documented." },
      { element_title: "Lockdown procedures", observation: "Lockdown procedures are not documented." },
      { element_title: "Shelter-in-place procedures", observation: "Shelter-in-place procedures are not documented." },
    ];
  }

  if (t.includes("floor plan") || t.includes("maps") || t.includes("site plan") || t.includes("diagrams")) {
    return [{ element_title: "Facility-specific plans and maps", observation: "Facility-specific plans and maps are not documented." }];
  }

  if (t.includes("access") && (t.includes("emergency") || t.includes("responder"))) {
    return [{ element_title: "Emergency access preparedness", observation: "Emergency access preparedness is not documented." }];
  }

  if (t.includes("response") || t.includes("procedures")) {
    return [{ element_title: "Response procedures", observation: "Response procedures are not documented." }];
  }

  if (t.includes("accountability") || t.includes("reunification") || t.includes("headcount")) {
    return [{ element_title: "Personnel accountability procedures", observation: "Personnel accountability procedures are not documented." }];
  }

  if (t.includes("recovery") || t.includes("reconstitution")) {
    return [{ element_title: "Recovery procedures", observation: "Recovery procedures are not documented." }];
  }

  if (t.includes("training") || t.includes("exercise") || t.includes("drill")) {
    return [
      { element_title: "Training activities", observation: "Training activities are not documented." },
      { element_title: "Exercises or drills", observation: "Exercises or drills are not documented." },
    ];
  }

  if (t.includes("maintenance") || t.includes("revision") || t.includes("record of revisions") || t.includes("plan approval") || t.includes("approval")) {
    return [{ element_title: "Plan approval and revision history", observation: "Plan approval and revision history are not documented." }];
  }

  return [{ element_title: sectionTitle, observation: flatDoc(sectionTitle) }];
}
