// src/lib/json/validateHostJson.ts

import {
  HOST_VERSION,
  SCHEMA_VERSION,
  HostJsonEnvelope,
  ValidationError,
  ValidationResult,
} from "./types";
import { getDefaultDataForTool, getDefaultMetadataForTool } from "./defaults";

export interface ValidateOptions {
  /**
   * If true, attempts to auto-heal missing fields with defaults.
   */
  autoFix?: boolean;
}

/**
 * Validates a HOST JSON envelope and optionally auto-heals it.
 * Returns { valid, errors, json? }.
 */
export function validateHostJson<
  TData extends Record<string, any> = Record<string, any>,
  TMetadata extends Record<string, any> = Record<string, any>
>(
  input: unknown,
  options: ValidateOptions = {}
): ValidationResult<TData, TMetadata> {
  const { autoFix = true } = options;

  const errors: ValidationError[] = [];

  // Shallow object check
  if (!isPlainObject(input)) {
    errors.push({
      path: "",
      message: "Envelope must be an object.",
      expected: "object",
      actual: typeof input,
    });
    return { valid: false, errors };
  }

  // Clone so we can safely auto-fix without mutating caller's reference
  const json: any = structuredCloneSafe(input);

  ensureString(json, "host_version", HOST_VERSION, autoFix, errors);
  ensureString(json, "schema_version", SCHEMA_VERSION, autoFix, errors);
  ensureString(json, "tool_id", "generic", autoFix, errors);
  ensureString(json, "tool_version", "1.0.0", autoFix, errors);
  ensureNumber(json, "timestamp_created", Date.now(), autoFix, errors);
  ensureNumber(json, "timestamp_modified", Date.now(), autoFix, errors);
  ensureObject(json, "metadata", {}, autoFix, errors);
  ensureObject(json, "data", {}, autoFix, errors);

  // Enforce that metadata/data at least contain tool defaults if empty or missing keys
  const toolId = String(json.tool_id ?? "generic");
  const defaultData = getDefaultDataForTool(toolId);
  const defaultMetadata = getDefaultMetadataForTool(toolId);

  if (autoFix) {
    json.data = shallowFillDefaults(json.data, defaultData);
    json.metadata = shallowFillDefaults(json.metadata, defaultMetadata);
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    json: (valid || autoFix) ? (json as HostJsonEnvelope<TData, TMetadata>) : undefined,
    healed: (valid || autoFix) ? (json as HostJsonEnvelope<TData, TMetadata>) : null,
  };
}

// ---------- helpers ----------

function ensureString(
  obj: any,
  key: string,
  defaultValue: string,
  autoFix: boolean,
  errors: ValidationError[]
) {
  const value = obj[key];
  if (typeof value === "string" && value.length > 0) return;
  if (autoFix) {
    obj[key] = defaultValue;
  }
  errors.push({
    path: key,
    message: `Expected non-empty string for "${key}".`,
    expected: "non-empty string",
    actual: value,
  });
}

function ensureNumber(
  obj: any,
  key: string,
  defaultValue: number,
  autoFix: boolean,
  errors: ValidationError[]
) {
  const value = obj[key];
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (autoFix) {
    obj[key] = defaultValue;
  }
  errors.push({
    path: key,
    message: `Expected finite number for "${key}".`,
    expected: "number",
    actual: value,
  });
}

function ensureObject(
  obj: any,
  key: string,
  defaultValue: Record<string, any>,
  autoFix: boolean,
  errors: ValidationError[]
) {
  const value = obj[key];
  if (isPlainObject(value)) return;
  if (autoFix) {
    obj[key] = defaultValue;
  }
  errors.push({
    path: key,
    message: `Expected plain object for "${key}".`,
    expected: "object",
    actual: value,
  });
}

function shallowFillDefaults(
  target: Record<string, any>,
  defaults: Record<string, any>
): Record<string, any> {
  if (!isPlainObject(target)) target = {};
  const result: Record<string, any> = { ...target };
  for (const [key, defVal] of Object.entries(defaults)) {
    if (result[key] === undefined) {
      result[key] = structuredCloneSafe(defVal);
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value.constructor === Object || Object.getPrototypeOf(value) === null)
  );
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

