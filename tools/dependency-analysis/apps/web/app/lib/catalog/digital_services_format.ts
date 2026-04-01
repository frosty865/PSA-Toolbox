import { getDigitalServiceOption } from "./digital_services_catalog";

export function formatDigitalServiceName(row: {
  service_id?: string;
  service_other?: string;
  /** Legacy: free-text name before catalog migration. */
  asset_name_or_id?: string;
}): string {
  const id = row.service_id ?? "";
  if (id === "other") return (row.service_other ?? "").trim() || "Other (unspecified)";
  const opt = getDigitalServiceOption(id);
  if (opt) return opt.label;
  const legacy = (row.asset_name_or_id ?? "").trim();
  if (legacy) return legacy;
  return "Unknown service";
}
