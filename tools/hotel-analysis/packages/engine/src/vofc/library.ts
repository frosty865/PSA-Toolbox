/**
 * VOFC library loader. Reads VOFC_Library.xlsx and returns validated VOFC[].
 * Internal structure (with trigger_conditions) is not exposed outside the engine.
 * Path resolution: 1) VOFC_LIBRARY_PATH env, 2) <repo_root>/apps/web/assets/data/VOFC_Library.xlsx, 3) throw.
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import type { CategoryCode, VOFC } from "schema";
import type { InternalVofcEntry, TriggerConditions } from "./library_types";

export type { InternalVofcEntry, TriggerConditions } from "./library_types";

/**
 * Resolve VOFC library path: VOFC_LIBRARY_PATH env, else <repo_root>/apps/web/assets/data/VOFC_Library.xlsx.
 * Repo root is derived from this file's location (packages/engine/src/vofc -> 4 levels up).
 * Throws with clear Fix instructions if the file is not found.
 */
export function getVofcLibraryPath(): string {
  const envPath = process.env.VOFC_LIBRARY_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return path.resolve(envPath);
  }

  const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const relativePath = path.join(
    projectRoot,
    "apps",
    "web",
    "assets",
    "data",
    "VOFC_Library.xlsx"
  );

  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  throw new Error(
    [
      "VOFC library file not found.",
      "Expected at:",
      relativePath,
      "",
      "Fix:",
      "• Place VOFC_Library.xlsx at apps/web/assets/data/",
      "• OR set VOFC_LIBRARY_PATH to the absolute file path",
    ].join("\n")
  );
}


const FORMAT_NORMALIZED = "FORMAT_NORMALIZED";
const FORMAT_LEGACY = "FORMAT_LEGACY";
const FORMAT_SKIP = "FORMAT_SKIP";
type SheetFormat = typeof FORMAT_NORMALIZED | typeof FORMAT_LEGACY | typeof FORMAT_SKIP;

/** Normalize header for format detection: trim, lower, collapse whitespace. */
function normalizeHeader(s: string): string {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Check if a header matches any of the variants (after normalizing). */
function headerMatches(header: string, variants: string[]): boolean {
  const n = normalizeHeader(header);
  return variants.some((v) => {
    const vn = normalizeHeader(v);
    return n === vn || n.includes(vn) || vn.includes(n);
  });
}

/** Detect sheet format from header row (first row keys from sheet_to_json). */
function detectSheetFormat(sheetName: string, headers: string[]): SheetFormat {
  const hasVofcId = headers.some((h) => {
    const n = normalizeHeader(h);
    return n === "vofc_id" || n === "vofc id" || n.replace(/\s/g, "").includes("vofcid");
  });
  if (hasVofcId) return FORMAT_NORMALIZED;

  const vNumVariants = ["v #", "v#", "vulnerability #"];
  const ofcNumVariants = ["ofc #", "ofc#", "ofc number"];
  const hasVNum = headers.some((h) => headerMatches(h, vNumVariants));
  const hasOfcNum = headers.some((h) => headerMatches(h, ofcNumVariants));
  const hasVuln = headers.some((h) => {
    const n = normalizeHeader(h);
    return n === "vulnerability" || (n.includes("vulnerability") && !n.includes("#"));
  });
  const hasOfc = headers.some((h) => {
    const n = normalizeHeader(h);
    return n.includes("option for consideration") || n === "option for consideration";
  });
  if (hasVNum && hasOfcNum && (hasVuln || hasOfc)) return FORMAT_LEGACY;

  return FORMAT_SKIP;
}

/** Slugify sheet name for stable sheet code: ENTRY_CONTROLS, DEPENDENCIES_ELECTRIC. */
function sheetCode(sheetName: string): string {
  return sheetName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase() || "SHEET";
}

const CATEGORY_CODES = new Set<string>([
  "ELECTRIC_POWER",
  "COMMUNICATIONS",
  "INFORMATION_TECHNOLOGY",
  "WATER",
  "WASTEWATER",
  "CRITICAL_PRODUCTS",
]);

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getCell(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const keys = Object.keys(row);
  const normMap = new Map(keys.map((k) => [normalizeKey(k), row[k]]));
  for (const c of candidates) {
    const v = normMap.get(normalizeKey(c));
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

function parseNum(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).trim());
  return Number.isNaN(n) ? undefined : n;
}

const LEGACY_MISSING_VOFC_ID_MESSAGE =
  "VOFC library appears to be LEGACY format (V # / OFC #) but loader is expecting normalized format. Implement legacy parser or add vofc_id column.";

function parseRow(
  row: Record<string, unknown>,
  rowIndex: number,
  sheetName?: string
): InternalVofcEntry {
  const vofc_id = getCell(row, "vofc_id", "vofc id", "id");
  if (vofc_id == null || String(vofc_id).trim() === "") {
    throw new Error(LEGACY_MISSING_VOFC_ID_MESSAGE);
  }

  const categoryRaw = getCell(row, "category");
  const categoryStr = categoryRaw != null ? String(categoryRaw).trim().toUpperCase().replace(/\s+/g, "_") : "";
  if (!CATEGORY_CODES.has(categoryStr)) {
    throw new Error(
      `VOFC library: invalid category "${categoryStr}" at row ${rowIndex + 1}; must be one of: ${[...CATEGORY_CODES].join(", ")}`
    );
  }
  const category = categoryStr as CategoryCode;

  const vulnerability = getCell(row, "vulnerability");
  const vulnStr = vulnerability != null ? String(vulnerability).trim() : "";
  if (vulnStr === "") {
    throw new Error(`VOFC library: empty vulnerability at row ${rowIndex + 1} (vofc_id=${vofc_id})`);
  }

  const optionRaw = getCell(row, "option_for_consideration", "option for consideration", "option");
  const optionStr = optionRaw != null ? String(optionRaw).trim() : "";
  if (optionStr === "") {
    throw new Error(`VOFC library: empty option_for_consideration at row ${rowIndex + 1} (vofc_id=${vofc_id})`);
  }

  const title = getCell(row, "title");
  const titleStr = title != null ? String(title).trim() : "";

  const impactRaw = getCell(row, "impact");
  const impact = impactRaw != null && String(impactRaw).trim() !== "" ? String(impactRaw).trim() : null;

  const severityRaw = getCell(row, "severity");
  const severityStr = severityRaw != null ? String(severityRaw).trim().toUpperCase() : "";
  const severity = severityStr === "LOW" || severityStr === "MODERATE" || severityStr === "HIGH" ? severityStr : "MODERATE";

  const applicabilityRaw = getCell(row, "applicability");
  const applicabilityStr = applicabilityRaw != null ? String(applicabilityRaw).trim().toUpperCase() : "";
  const applicability = applicabilityStr === "CONFIRMED" || applicabilityStr === "POTENTIAL" ? applicabilityStr : "POTENTIAL";

  const source_ref = getCell(row, "source_ref", "source ref");
  const sourceRefStr = source_ref != null && String(source_ref).trim() !== "" ? String(source_ref).trim() : undefined;

  const source_registry_id = getCell(row, "source_registry_id", "source registry id");
  const sourceRegistryIdStr =
    source_registry_id != null && String(source_registry_id).trim() !== "" ? String(source_registry_id).trim() : undefined;
  const source_tier = getCell(row, "source_tier", "source tier");
  const sourceTierNum = parseNum(source_tier);
  const sourceTierVal =
    sourceTierNum !== undefined && sourceTierNum >= 1 && sourceTierNum <= 3
      ? (sourceTierNum as 1 | 2 | 3)
      : undefined;
  const source_publisher = getCell(row, "source_publisher", "source publisher");
  const sourcePublisherStr =
    source_publisher != null && String(source_publisher).trim() !== "" ? String(source_publisher).trim() : undefined;

  const trigger_conditions: TriggerConditions = {};
  const rs = getCell(row, "requires_service", "requires service");
  if (parseBool(rs) !== undefined) trigger_conditions.requires_service = parseBool(rs);
  const hb = getCell(row, "has_backup", "has backup");
  if (parseBool(hb) !== undefined) trigger_conditions.has_backup = parseBool(hb);
  const bd = getCell(row, "backup_duration_lt_hours", "backup duration lt hours");
  const bdNum = parseNum(bd);
  if (bdNum !== undefined) trigger_conditions.backup_duration_lt_hours = bdNum;
  const tti = getCell(row, "time_to_impact_lte_hours", "time to impact lte hours");
  const ttiNum = parseNum(tti);
  if (ttiNum !== undefined) trigger_conditions.time_to_impact_lte_hours = ttiNum;
  const lf = getCell(row, "loss_fraction_gte", "loss fraction gte");
  const lfNum = parseNum(lf);
  if (lfNum !== undefined) trigger_conditions.loss_fraction_gte = lfNum;
  const rt = getCell(row, "recovery_time_gte_hours", "recovery time gte hours");
  const rtNum = parseNum(rt);
  if (rtNum !== undefined) trigger_conditions.recovery_time_gte_hours = rtNum;
  const cps = getCell(row, "critical_product_single_source", "critical product single source");
  if (parseBool(cps) !== undefined) trigger_conditions.critical_product_single_source = parseBool(cps);
  const cpn = getCell(row, "critical_product_no_alt_supplier", "critical product no alt supplier");
  if (parseBool(cpn) !== undefined) trigger_conditions.critical_product_no_alt_supplier = parseBool(cpn);

  const entry: InternalVofcEntry = {
    vofc_id: String(vofc_id).trim(),
    category,
    trigger_conditions,
    title: titleStr,
    vulnerability: vulnStr,
    impact,
    option_for_consideration: optionStr,
    severity,
    applicability,
    source_ref: sourceRefStr,
    origin: "SOURCE",
    source_registry_id: sourceRegistryIdStr ?? undefined,
    source_tier: sourceTierVal ?? undefined,
    source_publisher: sourcePublisherStr ?? undefined,
  };
  if (sheetName != null) entry.source_sheet = sheetName;
  entry.source_row = rowIndex + 1;
  return entry;
}

/** Find first header key that matches any of the variants. */
function findHeaderKey(headers: string[], variants: string[]): string | null {
  for (const h of headers) {
    if (headerMatches(h, variants)) return h;
  }
  return null;
}

/** Get cell value by exact header key (legacy). */
function getCellByKey(row: Record<string, unknown>, key: string | null): unknown {
  if (key == null) return undefined;
  const v = row[key];
  return v !== undefined && v !== null && v !== "" ? v : undefined;
}

/** Infer CategoryCode from sheet name or category column value. */
function inferCategory(sheetName: string, categoryVal: string | null): CategoryCode {
  if (categoryVal != null && categoryVal.trim() !== "") {
    const s = categoryVal.trim().toUpperCase().replace(/\s+/g, "_");
    if (CATEGORY_CODES.has(s)) return s as CategoryCode;
  }
  const code = sheetCode(sheetName);
  if (code.includes("ELECTRIC")) return "ELECTRIC_POWER";
  if (code.includes("COMMUNICATION")) return "COMMUNICATIONS";
  if (code.includes("INFORMATION") || code.includes("IT")) return "INFORMATION_TECHNOLOGY";
  if (code.includes("WATER") && !code.includes("WASTE")) return "WATER";
  if (code.includes("WASTEWATER") || code.includes("WASTE")) return "WASTEWATER";
  if (code.includes("CRITICAL") || code.includes("PRODUCT")) return "CRITICAL_PRODUCTS";
  return "ELECTRIC_POWER";
}

/** Legacy sheet: parse rows into InternalVofcEntry[] with synthesized vofc_id. */
function parseLegacySheet(
  sheetName: string,
  rows: Record<string, unknown>[],
  headers: string[]
): InternalVofcEntry[] {
  const vNumKey = findHeaderKey(headers, ["v #", "v#", "vulnerability #"]);
  const ofcNumKey = findHeaderKey(headers, ["ofc #", "ofc#", "ofc number"]);
  const vulnKey = findHeaderKey(headers, ["vulnerability"]);
  const ofcKey = findHeaderKey(headers, ["option for consideration"]);
  const refKey = findHeaderKey(headers, ["reference"]);
  const categoryKey = findHeaderKey(headers, ["category"]);

  if (!vNumKey || !ofcNumKey) {
    throw new Error(
      `VOFC library (legacy): sheet "${sheetName}" missing V # or OFC # column. Headers: [${headers.join(", ")}].`
    );
  }
  if (!vulnKey && !ofcKey) {
    throw new Error(
      `VOFC library (legacy): sheet "${sheetName}" missing Vulnerability or Option for Consideration column. Headers: [${headers.join(", ")}].`
    );
  }

  const code = sheetCode(sheetName);
  const entries: InternalVofcEntry[] = [];
  let currentVNum: string | null = null;
  let currentVulnText: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const excelRow = i + 2;

    const vNumRaw = getCellByKey(row, vNumKey);
    const vNumStr = vNumRaw != null ? String(vNumRaw).trim() : "";
    const vulnRaw = vulnKey ? getCellByKey(row, vulnKey) : undefined;
    const vulnStr = vulnRaw != null ? String(vulnRaw).trim() : "";
    const ofcNumRaw = getCellByKey(row, ofcNumKey);
    const ofcNumStr = ofcNumRaw != null ? String(ofcNumRaw).trim() : "";
    const ofcRaw = ofcKey ? getCellByKey(row, ofcKey) : undefined;
    const ofcStr = ofcRaw != null ? String(ofcRaw).trim() : "";

    if (vNumStr !== "" && vulnStr !== "") {
      currentVNum = vNumStr;
      currentVulnText = vulnStr;
    } else if (vNumStr !== "" && vulnStr === "") {
      currentVNum = vNumStr;
      if (currentVulnText === null) {
        throw new Error(
          `VOFC library (legacy): sheet "${sheetName}" row ${excelRow}: V # without preceding Vulnerability text.`
        );
      }
    }

    if (ofcNumStr !== "" && ofcStr !== "") {
      if (currentVNum === null || currentVulnText === null || currentVulnText === "") {
        throw new Error(
          `VOFC library (legacy): sheet "${sheetName}" row ${excelRow}: OFC row without active vulnerability context (V # and Vulnerability must be set above).`
        );
      }
      const vulnerability_id = `${code}.V${currentVNum}`;
      const ofc_id = `${code}.V${currentVNum}.O${ofcNumStr}`;
      const vofc_id = ofc_id;

      const categoryVal = categoryKey ? (getCellByKey(row, categoryKey) as string) ?? null : null;
      const category = inferCategory(sheetName, categoryVal != null ? String(categoryVal).trim() : null);
      const reference = refKey ? (getCellByKey(row, refKey) as string) : null;
      const refStr = reference != null && String(reference).trim() !== "" ? String(reference).trim() : undefined;

      entries.push({
        vofc_id,
        category,
        trigger_conditions: {},
        title: currentVulnText,
        vulnerability: currentVulnText,
        impact: null,
        option_for_consideration: ofcStr,
        severity: "MODERATE",
        applicability: "POTENTIAL",
        source_ref: refStr,
        origin: "SOURCE",
        source_sheet: sheetName,
        source_row: excelRow,
      });
    }
  }
  return entries;
}

/** Enforce vofc_id uniqueness; throw with sheet/row if duplicate. */
function enforceVofcIdUniqueness(entries: InternalVofcEntry[]): void {
  const byId = new Map<string, InternalVofcEntry>();
  for (const e of entries) {
    const existing = byId.get(e.vofc_id);
    if (existing) {
      const a = `${existing.source_sheet ?? "?"} row ${existing.source_row ?? "?"}`;
      const b = `${e.source_sheet ?? "?"} row ${e.source_row ?? "?"}`;
      throw new Error(
        `VOFC library: duplicate vofc_id "${e.vofc_id}" at ${a} and ${b}. vofc_id must be unique.`
      );
    }
    byId.set(e.vofc_id, e);
  }
}

/** Load library and return internal entries (for use by generate only). Not re-exported from engine index. */
export async function loadVofcLibraryEntries(filePath: string): Promise<InternalVofcEntry[]> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `VOFC library file not found.\nExpected at: ${resolved}\nFix: Place VOFC_Library.xlsx at assets/data/ or set VOFC_LIBRARY_PATH.`
    );
  }
  const buf = fs.readFileSync(resolved);
  if (buf.length === 0) {
    throw new Error(
      `VOFC library file is empty.\nExpected at: ${resolved}\nFix: Place a valid VOFC_Library.xlsx at assets/data/ or set VOFC_LIBRARY_PATH.`
    );
  }
  const workbook = XLSX.read(buf, { type: "buffer" });
  const internalEntries: InternalVofcEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0] as object);
    const format = detectSheetFormat(sheetName, headers);
    if (format === FORMAT_SKIP) continue;

    if (format === FORMAT_NORMALIZED) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object") continue;
        const entry = parseRow(row, i, sheetName);
        internalEntries.push(entry);
      }
    } else {
      const legacyEntries = parseLegacySheet(sheetName, rows, headers);
      internalEntries.push(...legacyEntries);
    }
  }

  if (internalEntries.length === 0) {
    throw new Error(
      "VOFC library: no sheet had recognizable format. " +
        "Expected sheets with either: (1) normalized format with 'vofc_id' column, or (2) legacy format with 'V #', 'OFC #', and 'Vulnerability' or 'Option for Consideration' columns."
    );
  }
  enforceVofcIdUniqueness(internalEntries);
  return internalEntries;
}

/**
 * Load and parse VOFC_Library.xlsx from the given path.
 * Canonical path for the file is /mnt/data/VOFC_Library.xlsx (e.g. on Linux); on Windows pass a local path.
 *
 * Fails hard if:
 * - vofc_id is missing
 * - category is not a known CategoryCode
 * - vulnerability or option_for_consideration is empty
 *
 * Returns VOFC[] only; internal structure (including trigger_conditions) is not exposed.
 */
export async function loadVofcLibrary(filePath: string): Promise<VOFC[]> {
  const internalEntries = await loadVofcLibraryEntries(filePath);
  return internalEntries.map((e) => ({
    vofc_id: e.vofc_id,
    category: e.category,
    title: e.title,
    vulnerability: e.vulnerability,
    impact: e.impact,
    option_for_consideration: e.option_for_consideration,
    base_severity: e.severity,
    calibrated_severity: e.severity,
    calibration_reason: null as string | null,
    applicability: e.applicability,
    source_ref: e.source_ref,
    origin: e.origin ?? ("SOURCE" as const),
    source_registry_id: e.source_registry_id ?? undefined,
    source_tier: e.source_tier ?? undefined,
    source_publisher: e.source_publisher ?? undefined,
  }));
}
