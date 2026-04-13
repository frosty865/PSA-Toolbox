// src/lib/json/createHostJson.ts

import {
  HOST_VERSION,
  SCHEMA_VERSION,
  HostJsonEnvelope,
  ToolId,
} from "./types";
import {
  deepMerge,
  getDefaultDataForTool,
  getDefaultMetadataForTool,
} from "./defaults";

/**
 * Options for creating or refreshing a HOST JSON envelope.
 */
export interface CreateHostJsonOptions<
  TData extends Record<string, any> = Record<string, any>,
  TMetadata extends Record<string, any> = Record<string, any>
> {
  toolId: ToolId;
  toolVersion?: string;
  /**
   * Partial data payload to merge into default tool data.
   */
  data?: Partial<TData>;
  /**
   * Partial metadata payload to merge into default metadata.
   */
  metadata?: Partial<TMetadata>;
  /**
   * Existing envelope to update (preserve timestamp_created).
   */
  existing?: HostJsonEnvelope<TData, TMetadata>;
}

/**
 * Creates a stable HOST JSON envelope.
 * - Enforces global envelope shape
 * - Injects host + schema versions
 * - Provides stable timestamps
 * - Deep merges data/metadata with per-tool defaults
 * - Never mutates inputs
 */
export function createHostJson<
  TData extends Record<string, any> = Record<string, any>,
  TMetadata extends Record<string, any> = Record<string, any>
>(options: CreateHostJsonOptions<TData, TMetadata>): HostJsonEnvelope<TData, TMetadata> {
  const {
    toolId,
    toolVersion = "1.0.0",
    data,
    metadata,
    existing,
  } = options;

  const now = Date.now();
  const baseCreated =
    existing?.timestamp_created && Number.isFinite(existing.timestamp_created)
      ? existing.timestamp_created
      : now;

  const defaultData = getDefaultDataForTool(toolId) as TData;
  const defaultMetadata = getDefaultMetadataForTool(toolId) as TMetadata;

  const mergedData = deepMerge(defaultData, data);
  const mergedMetadata = deepMerge(defaultMetadata, metadata);

  const envelope: HostJsonEnvelope<TData, TMetadata> = {
    host_version: HOST_VERSION,
    schema_version: SCHEMA_VERSION,
    tool_id: toolId,
    tool_version: toolVersion,
    timestamp_created: baseCreated,
    timestamp_modified: now,
    metadata: mergedMetadata,
    data: mergedData,
  };

  return envelope;
}

/**
 * Helper to update an existing envelope immutably with new data/metadata.
 * Preserves timestamps appropriately.
 */
export function updateHostJson<
  TData extends Record<string, any> = Record<string, any>,
  TMetadata extends Record<string, any> = Record<string, any>
>(
  existing: HostJsonEnvelope<TData, TMetadata>,
  patch: {
    data?: Partial<TData>;
    metadata?: Partial<TMetadata>;
    toolVersion?: string;
  }
): HostJsonEnvelope<TData, TMetadata> {
  const { data, metadata, toolVersion } = patch;

  const mergedData = deepMerge(existing.data, data);
  const mergedMetadata = deepMerge(existing.metadata, metadata);

  return {
    host_version: HOST_VERSION,
    schema_version: SCHEMA_VERSION,
    tool_id: existing.tool_id,
    tool_version: toolVersion ?? existing.tool_version,
    timestamp_created: existing.timestamp_created,
    timestamp_modified: Date.now(),
    metadata: mergedMetadata,
    data: mergedData,
  };
}

