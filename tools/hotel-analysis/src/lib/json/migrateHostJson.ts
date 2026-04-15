// src/lib/json/migrateHostJson.ts

import {
  HostJsonEnvelope,
  HostJsonAny,
  ValidationResult,
} from "./types";
import { wrapLegacyDataAsEnvelope } from "./defaults";
import { validateHostJson } from "./validateHostJson";

/**
 * Normalizes and migrates any incoming JSON into the current HOST envelope.
 * - Wraps legacy bare `data` objects
 * - Upgrades older schema versions
 * - Validates and auto-heals where possible
 */
export function migrateHostJson(
  input: unknown
): ValidationResult {
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message: "Input must be an object.",
          expected: "object",
          actual: typeof input,
        },
      ],
    };
  }

  // If this looks like a bare data blob (no envelope fields), wrap it.
  if (isLegacyBareData(input)) {
    const toolId = detectLegacyToolId(input);
    const wrapped = wrapLegacyDataAsEnvelope(toolId, input as Record<string, any>);
    return validateHostJson<Record<string, any>, Record<string, any>>(wrapped, {
      autoFix: true,
    });
  }

  // If it looks like an envelope, handle by schema_version
  const asAny = input as HostJsonAny;
  const currentSchema = typeof asAny.schema_version === "string"
    ? asAny.schema_version
    : "0.9.0"; // treat missing as old

  switch (currentSchema) {
    case "0.9.0": {
      const migrated = migrate_090_to_100(asAny);
      return validateHostJson(migrated, { autoFix: true });
    }
    case "1.0.0": {
      // Current schema - just validate/heal
      return validateHostJson(asAny, { autoFix: true });
    }
    default: {
      // Unknown future schema - still attempt validation, but mark invalid if incompatible
      const result = validateHostJson(asAny, { autoFix: false });
      result.errors.push({
        path: "schema_version",
        message: `Unsupported schema_version "${currentSchema}".`,
        expected: "0.9.0 or 1.0.0",
        actual: currentSchema,
      });
      return {
        ...result,
        valid: false,
        json: undefined,
        healed: null,
      };
    }
  }
}

// ---------- migration helpers ----------

/**
 * Migration from early 0.9.0-style envelopes to 1.0.0.
 * Adjust this as you discover more legacy formats.
 */
function migrate_090_to_100(
  input: HostJsonAny
): HostJsonEnvelope {
  const toolId = detectLegacyToolId(input);
  const now = Date.now();

  const base: HostJsonEnvelope = {
    host_version: "1.0.0",
    schema_version: "1.0.0",
    tool_id: toolId,
    tool_version: typeof input.tool_version === "string"
      ? input.tool_version
      : "1.0.0",
    timestamp_created: typeof input.timestamp_created === "number"
      ? input.timestamp_created
      : now,
    timestamp_modified: typeof input.timestamp_modified === "number"
      ? input.timestamp_modified
      : now,
    metadata: isPlainObject(input.metadata) ? input.metadata : {},
    data: isPlainObject(input.data) ? input.data : (input as any).data ?? {},
  };

  return base;
}

function isLegacyBareData(value: unknown): boolean {
  // Legacy "just data" objects had no envelope keys at all
  if (!isPlainObject(value)) return false;
  const obj = value as Record<string, any>;
  const hasEnvelopeKeys =
    "host_version" in obj ||
    "schema_version" in obj ||
    "tool_id" in obj ||
    "tool_version" in obj;
  return !hasEnvelopeKeys;
}

/**
 * Very simple heuristic to guess a legacy tool_id.
 * Replace with more robust detection as needed.
 */
function detectLegacyToolId(value: unknown): string {
  if (!isPlainObject(value)) return "generic";

  const obj = value as Record<string, any>;

  if ("threats" in obj && "mitigations" in obj) return "risk_matrix";
  if ("contacts" in obj && "channels" in obj) return "comms_plan";
  if ("sections" in obj && "tables" in obj) return "host_assessment";
  if (
    "data" in obj &&
    isPlainObject(obj.data) &&
    ("sections" in obj.data || "tables" in obj.data)
  ) {
    return "host_assessment";
  }

  return "generic";
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value.constructor === Object || Object.getPrototypeOf(value) === null)
  );
}

