/**
 * VOFC generation: match assessment to library entries and produce VOFCCollection.
 * Node path: loadVofcLibraryEntries + runGeneration. Client path: use generate_core (no fs).
 */
import type { Assessment, VOFCCollection } from "schema";
import type { InternalVofcEntry } from "./library_types";
import { loadVofcLibraryEntries } from "./library";
import { runGeneration } from "./generate_core";

/** Minimal rule shape for injected rules (e.g. test fixtures). */
export interface InjectedRule {
  vofc_id: string;
  category: InternalVofcEntry["category"];
  trigger_conditions: InternalVofcEntry["trigger_conditions"];
  title: string;
  vulnerability: string;
  impact: string | null;
  option_for_consideration: string;
  base_severity: "LOW" | "MODERATE" | "HIGH";
}

function injectedRulesToEntries(rules: InjectedRule[]): InternalVofcEntry[] {
  return rules.map((r) => ({
    vofc_id: r.vofc_id,
    category: r.category,
    trigger_conditions: r.trigger_conditions,
    title: r.title,
    vulnerability: r.vulnerability,
    impact: r.impact,
    option_for_consideration: r.option_for_consideration,
    severity: r.base_severity,
    applicability: "POTENTIAL" as const,
    source_ref: undefined,
    origin: "GENERATED" as const,
  }));
}

/**
 * Generate VOFCs for an assessment by loading the library and matching trigger conditions.
 * - If opts.rulesOverride is provided, uses that instead of loading the library (sync, for tests).
 */
export function generateVOFCs(
  assessment: Assessment,
  libraryPath: string,
  opts?: { rulesOverride?: InjectedRule[] }
): Promise<VOFCCollection>;
export function generateVOFCs(
  assessment: Assessment,
  _libraryPath: string,
  opts: { rulesOverride: InjectedRule[] }
): VOFCCollection;
export function generateVOFCs(
  assessment: Assessment,
  libraryPath: string,
  opts?: { rulesOverride?: InjectedRule[] }
): Promise<VOFCCollection> | VOFCCollection {
  if (opts?.rulesOverride != null) {
    return runGeneration(assessment, injectedRulesToEntries(opts.rulesOverride));
  }
  return loadVofcLibraryEntries(libraryPath).then((entries) =>
    runGeneration(assessment, entries)
  );
}

/** Used by tests and client: generate from in-memory entries (no file). */
export function generateVOFCsFromEntries(assessment: Assessment, entries: InternalVofcEntry[]): VOFCCollection {
  return runGeneration(assessment, entries);
}
