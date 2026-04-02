// src/lib/json/defaults.ts

import { HostJsonEnvelope, ToolId } from "./types";

export type GenericData = Record<string, any>;

export type GenericMetadata = Record<string, any>;

/**
 * Returns default data shape for a given tool.
 * Extend this with explicit per-tool defaults as HOST evolves.
 */
export function getDefaultDataForTool(toolId: ToolId): GenericData {
  switch (toolId) {
    // Example explicit defaults – extend/replace as needed.
    case "risk_matrix":
      return {
        threats: [],
        mitigations: [],
        parameters: {},
        calculations: {},
      };
    case "comms_plan":
      return {
        contacts: [],
        channels: [],
        procedures: [],
        notes: "",
      };
    case "host_assessment":
      return {
        sections: {},
        tables: {},
      };
    default:
      // Generic safe default
      return {};
  }
}

/**
 * Returns default metadata for a given tool.
 */
export function getDefaultMetadataForTool(toolId: ToolId): GenericMetadata {
  return {
    tool_label: toolId,
    created_by: null,
    source: null,
  };
}

/**
 * Deep merge helper: returns a new object, does not mutate inputs.
 * - Objects are merged recursively
 * - Arrays are replaced (not concatenated) by the source value
 */
export function deepMerge<T extends Record<string, any>>(
  base: T,
  override: Partial<T> | undefined
): T {
  if (!override) return structuredCloneSafe(base);
  const result: Record<string, any> = structuredCloneSafe(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = (result as any)[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      (result as any)[key] = deepMerge(baseValue, value as any);
    } else {
      // Arrays, primitives, and non-plain-objects are replaced
      (result as any)[key] = structuredCloneSafe(value);
    }
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value.constructor === Object || Object.getPrototypeOf(value) === null)
  );
}

function structuredCloneSafe<T>(value: T): T {
  // Prefer native structuredClone if available
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(value);
  }
  // Fallback: JSON roundtrip (only safe for plain data)
  return JSON.parse(JSON.stringify(value));
}

/**
 * Convenience helper to normalize minimal legacy data into a full envelope
 * when migrating old JSONs that had only `data` with no envelope.
 */
export function wrapLegacyDataAsEnvelope(
  toolId: ToolId,
  data: Record<string, any>
): HostJsonEnvelope {
  const now = Date.now();
  return {
    host_version: "1.0.0",
    schema_version: "1.0.0",
    tool_id: toolId,
    tool_version: "1.0.0",
    timestamp_created: now,
    timestamp_modified: now,
    metadata: getDefaultMetadataForTool(toolId),
    data: data ?? {},
  };
}

