// src/lib/json/types.ts

export const HOST_VERSION = "1.0.0";

export const SCHEMA_VERSION = "1.0.0";

export type ToolId = string;

export interface HostJsonEnvelope<
  TData = Record<string, any>,
  TMetadata = Record<string, any>
> {
  host_version: string;
  schema_version: string;
  tool_id: ToolId;
  tool_version: string;
  timestamp_created: number;
  timestamp_modified: number;
  metadata: TMetadata;
  data: TData;
}

export interface ValidationError {
  path: string;
  message: string;
  expected?: string;
  actual?: any;
}

export interface ValidationResult<TData = any, TMetadata = any> {
  valid: boolean;
  errors: ValidationError[];
  json?: HostJsonEnvelope<TData, TMetadata>;
  healed?: HostJsonEnvelope<TData, TMetadata> | null;
}

/**
 * Narrow utility type for any HOST JSON envelope.
 */
export type HostJsonAny = HostJsonEnvelope<any, any>;

