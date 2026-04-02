/**
 * Structured debug trace for one standard/generate run.
 * Returned on 503 when no items, or on 200 when ?debug=1.
 */

export type GenerationDebugTrace = {
  retrieval: {
    chunks_total: number;
    chunks_usable: number;
    missing_source_label: number;
    missing_locator: number;
    missing_text: number;
    sample_handles: Array<{ h: string; chunk_id: string; source_label: string; locator: string }>;
  };
  llm: {
    model: string;
    temperature: number;
    prompt_chars: number;
    context_chunks: number;
    raw_response_chars: number;
    raw_response_preview: string;
    call_error?: string;
  };
  parsing: {
    json_parse_ok: boolean;
    parse_error?: string;
  };
  schema: {
    schema_valid_ok: boolean;
    schema_errors?: string[];
  };
  extracted: {
    questions: number;
    vulnerabilities: number;
    ofcs: number;
  };
  drops: {
    total_dropped: number;
    by_reason: Record<string, number>;
    examples: Array<{ reason: string; item_type: string; text: string; detail?: string }>;
  };
  final: {
    items_kept: number;
    empty_reason?: string;
  };
};

/** Build a partial trace from chunk export + generator output (no LLM details unless provided). */
export function buildTraceFromChunkResult(params: {
  chunksTotal: number;
  chunksUsable: number;
  missingSourceLabel: number;
  missingLocator: number;
  missingText: number;
  sampleHandles: Array<{ h: string; chunk_id: string; source_label: string; locator: string }>;
  itemsEmptyReason?: string;
  itemsKept: number;
  droppedTotal?: number;
  dropReasons?: Record<string, number>;
  dropExamples?: Array<{ reason: string; item_type?: string; text?: string; bad_handles?: string[] | null }>;
  /** From generator debug_trace if present */
  llm?: Partial<GenerationDebugTrace["llm"]>;
  parsing?: Partial<GenerationDebugTrace["parsing"]>;
  schema?: Partial<GenerationDebugTrace["schema"]>;
  extracted?: Partial<GenerationDebugTrace["extracted"]>;
}): GenerationDebugTrace {
  const {
    chunksTotal,
    chunksUsable,
    missingSourceLabel,
    missingLocator,
    missingText,
    sampleHandles,
    itemsEmptyReason,
    itemsKept,
    droppedTotal = 0,
    dropReasons = {},
    dropExamples = [],
    llm = {},
    parsing = {},
    schema = {},
    extracted = {},
  } = params;

  const jsonParseOk = itemsEmptyReason !== "json_parse_failed" && itemsEmptyReason !== "ollama_response_not_valid_json";
  const schemaValidOk = itemsEmptyReason !== "schema_invalid";

  const examples: GenerationDebugTrace["drops"]["examples"] = dropExamples.slice(0, 3).map((ex) => ({
    reason: ex.reason,
    item_type: ex.item_type ?? "item",
    text: (ex.text ?? "").slice(0, 200),
    detail: ex.bad_handles?.length ? `bad_handles: ${ex.bad_handles.slice(0, 5).join(", ")}` : undefined,
  }));

  return {
    retrieval: {
      chunks_total: chunksTotal,
      chunks_usable: chunksUsable,
      missing_source_label: missingSourceLabel,
      missing_locator: missingLocator,
      missing_text: missingText,
      sample_handles: sampleHandles.slice(0, 10),
    },
    llm: {
      model: llm.model ?? "",
      temperature: llm.temperature ?? 0.2,
      prompt_chars: llm.prompt_chars ?? 0,
      context_chunks: llm.context_chunks ?? 0,
      raw_response_chars: llm.raw_response_chars ?? 0,
      raw_response_preview: (llm.raw_response_preview ?? "").slice(0, 800),
      call_error: llm.call_error,
    },
    parsing: {
      json_parse_ok: parsing.json_parse_ok ?? jsonParseOk,
      parse_error: parsing.parse_error,
    },
    schema: {
      schema_valid_ok: schema.schema_valid_ok ?? schemaValidOk,
      schema_errors: schema.schema_errors,
    },
    extracted: {
      questions: extracted.questions ?? 0,
      vulnerabilities: extracted.vulnerabilities ?? 0,
      ofcs: extracted.ofcs ?? 0,
    },
    drops: {
      total_dropped: droppedTotal,
      by_reason: dropReasons,
      examples,
    },
    final: {
      items_kept: itemsKept,
      empty_reason: itemsEmptyReason,
    },
  };
}
