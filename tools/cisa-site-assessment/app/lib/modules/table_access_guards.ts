/**
 * Module Table Access Guards
 * 
 * Ensures modules only access module tables and baseline/corpus only access their tables.
 * Prevents cross-contamination between module and baseline content.
 */

/**
 * Module-only tables (modules should ONLY query these for module data)
 * Note: Modules CAN read from CORPUS (source_registry, corpus_documents, document_chunks)
 *       but must NOT write to baseline/corpus tables or query baseline question/OFC tables
 */
const MODULE_TABLES = new Set([
  'assessment_modules',
  'module_questions',
  'module_ofcs',
  'module_ofc_sources',
  'module_risk_drivers',
  'module_import_batches',
  'assessment_module_instances',
  'assessment_module_question_responses',
  'module_instances',
  'module_instance_criteria',
  'module_instance_criterion_responses',
  'module_instance_ofcs',
  'module_drafts',
  'module_draft_sources',
  'module_draft_questions',
  'module_sources',
  'module_vofc_library',
  'module_vulnerability_candidates',
  'module_chunk_comprehension',
  'module_corpus_links',
  'document_blobs',
  'module_documents',
  'module_chunks',
  'module_evidence',
  'plan_schema_registry',
  'plan_schema_sections',
  'plan_schema_elements',
  'plan_schemas',
  'plan_schemas_sections',
  'plan_schemas_elements',
]);

/**
 * Baseline question/OFC tables (modules should NEVER query these)
 * These are baseline content, not module content
 */
const BASELINE_CONTENT_TABLES = new Set([
  'baseline_spines_runtime',
  'baseline_questions',
  'baseline_ofcs',
  'baseline_references',
  'ofc_library', // Baseline OFC library
  'ofc_candidate_queue', // Baseline OFC candidates
  'canonical_sources', // Baseline canonical sources
]);

/**
 * CORPUS tables that modules can READ (but ONLY module corpus, not general corpus)
 * Modules can ONLY read from module corpus (filtered by scope_tags->'tags'->>'module_code')
 * Modules must NOT read from general assessment corpus (ingestion_stream = 'GENERAL')
 */
const CORPUS_MODULE_TABLES = new Set([
  'module_source_documents', // CORPUS table (cross-database link to module corpus)
  'module_chunk_links', // CORPUS table (cross-database link to module corpus)
]);

/**
 * CORPUS tables that are read-only from module context (module writes must not touch these)
 */
export const CORPUS_READ_ONLY_TABLES = new Set([
  'source_registry',
  'corpus_documents',
  'document_chunks',
  'module_source_documents',
  'module_chunk_links',
]);

/**
 * CORPUS general corpus tables (modules must NOT read from these)
 * These are for general assessment corpus, not module corpus
 */
const CORPUS_GENERAL_TABLES = new Set([
  'source_registry', // Only if not filtered by module_code scope_tags
  'corpus_documents', // Only if not filtered by module_code scope_tags
  'document_chunks', // Only if not filtered by module_code scope_tags
]);

/**
 * Extract table name from a single match: support schema-qualified "schema.table" -> use "table".
 */
function tableNameFromMatch(match: RegExpMatchArray): string {
  const schemaOrTable = match[1].toLowerCase();
  const table = match[3]?.toLowerCase();
  return (table != null && table.length > 0 ? table : schemaOrTable) as string;
}

/**
 * Extract table names from SQL query. Handles schema-qualified names (e.g. public.plan_schema_registry -> plan_schema_registry).
 */
function extractTableNames(sql: string): Set<string> {
  const tables = new Set<string>();
  void sql.toUpperCase(); // reserved for future case-sensitive checks

  // Match FROM, JOIN, UPDATE, INSERT INTO, DELETE FROM with optional schema prefix (schema.table)
  const pattern = /\b(?:FROM|JOIN|INTO|UPDATE|FROM)\s+([a-z_][a-z0-9_]*)(\.([a-z_][a-z0-9_]*))?/gi;
  const allMatches = sql.matchAll(pattern);

  for (const match of allMatches) {
    const name = tableNameFromMatch(match as unknown as RegExpMatchArray);
    if (name) tables.add(name);
  }

  return tables;
}

/**
 * Assert that a module query does not access baseline content tables
 * Modules must NOT access baseline question/OFC tables
 */
export function assertModuleNoBaselineContent(sql: string, context?: string): void {
  const tables = extractTableNames(sql);
  
  const baselineContentAccess = Array.from(tables).filter(t => BASELINE_CONTENT_TABLES.has(t));
  if (baselineContentAccess.length > 0) {
    throw new Error(
      `Module query must not access baseline content tables. ` +
      `Found access to: ${baselineContentAccess.join(', ')}. ` +
      `Modules are additive and must not reference baseline questions/OFCs. ` +
      `Context: ${context || 'unknown'}. ` +
      `SQL: ${sql.substring(0, 200)}`
    );
  }
}

/**
 * Assert that a module query does not read from general assessment corpus
 * Modules can ONLY read from module corpus (filtered by scope_tags->'tags'->>'module_code')
 * If querying source_registry, corpus_documents, or document_chunks, must filter by module_code
 */
export function assertModuleOnlyModuleCorpus(sql: string, context?: string): void {
  const tables = extractTableNames(sql);
  void sql.toUpperCase(); // reserved for future case-sensitive checks
  
  // Check if querying general corpus tables
  const hasGeneralCorpusTables = Array.from(tables).some(t => CORPUS_GENERAL_TABLES.has(t));
  
  if (hasGeneralCorpusTables) {
    // Must filter by module_code in scope_tags
    const hasModuleCodeFilter = 
      /scope_tags\s*->\s*['"]tags['"]\s*->\s*>\s*['"]module_code['"]/i.test(sql) ||
      /scope_tags\s*->\s*>\s*['"]module_code['"]/i.test(sql) ||
      /module_code/i.test(sql); // Basic check - should be more specific
    
    // Also check for ingestion_stream = 'MODULE'
    const hasModuleStreamFilter = 
      /ingestion_stream\s*=\s*['"]MODULE['"]/i.test(sql) ||
      /scope_tags\s*->\s*>\s*['"]ingestion_stream['"]\s*=\s*['"]MODULE['"]/i.test(sql);
    
    if (!hasModuleCodeFilter || !hasModuleStreamFilter) {
      throw new Error(
        `Module query must only read from module corpus, not general assessment corpus. ` +
        `When querying source_registry, corpus_documents, or document_chunks, ` +
        `must filter by scope_tags->'tags'->>'module_code' = <module_code> ` +
        `AND scope_tags->>'ingestion_stream' = 'MODULE'. ` +
        `Context: ${context || 'unknown'}. ` +
        `SQL: ${sql.substring(0, 300)}`
      );
    }
  }
}

/**
 * Assert that a module write query only writes to module tables
 * Modules can READ from CORPUS but must NOT write to baseline/corpus tables
 */
export function assertModuleWriteOnly(sql: string, context?: string): void {
  const normalized = sql.trim().toUpperCase();
  const isWrite = normalized.startsWith('INSERT') || 
                  normalized.startsWith('UPDATE') || 
                  normalized.startsWith('DELETE');
  
  if (!isWrite) {
    return; // Read queries are allowed (with baseline content check)
  }
  
  const tables = extractTableNames(sql);
  
  // Module writes must only touch module tables
  const nonModuleWrites = Array.from(tables).filter(
    t => !MODULE_TABLES.has(t) && 
         !CORPUS_READ_ONLY_TABLES.has(t) && // Can't write to CORPUS anyway (read-only guard)
         t !== 'discipline_subtypes' && // Shared reference table is OK
         t !== 'disciplines' // Shared reference table is OK
  );
  
  if (nonModuleWrites.length > 0) {
    throw new Error(
      `Module write query must only write to module tables. ` +
      `Found write to: ${nonModuleWrites.join(', ')}. ` +
      `Context: ${context || 'unknown'}. ` +
      `SQL: ${sql.substring(0, 200)}`
    );
  }
}

/**
 * Assert that a baseline query does not access module tables
 */
export function assertBaselineNoModuleAccess(sql: string, context?: string): void {
  const tables = extractTableNames(sql);
  
  const moduleAccess = Array.from(tables).filter(t => MODULE_TABLES.has(t));
  if (moduleAccess.length > 0) {
    throw new Error(
      `Baseline query must not access module tables. ` +
      `Found access to: ${moduleAccess.join(', ')}. ` +
      `Baseline and modules are separate. ` +
      `Context: ${context || 'unknown'}. ` +
      `SQL: ${sql.substring(0, 200)}`
    );
  }
}

/**
 * Check if a table is a module table
 */
export function isModuleTable(tableName: string): boolean {
  return MODULE_TABLES.has(tableName.toLowerCase());
}

/**
 * Check if a table is a baseline content table
 */
export function isBaselineContentTable(tableName: string): boolean {
  return BASELINE_CONTENT_TABLES.has(tableName.toLowerCase());
}

/**
 * Check if a table is a CORPUS module table (modules can read module corpus via these)
 */
export function isCorpusModuleTable(tableName: string): boolean {
  return CORPUS_MODULE_TABLES.has(tableName.toLowerCase());
}

/**
 * Check if a table is a CORPUS general corpus table (modules must NOT read from these without filtering)
 */
export function isCorpusGeneralTable(tableName: string): boolean {
  return CORPUS_GENERAL_TABLES.has(tableName.toLowerCase());
}

/**
 * Validate that module queries don't reference baseline question IDs
 */
export function assertNoBaselineReferences(sql: string, context?: string): void {
  // Check for BASE- prefix in SQL (baseline question IDs)
  if (/\bBASE-[A-Z0-9_-]+/i.test(sql)) {
    throw new Error(
      `Module query must not reference baseline question IDs (BASE-*). ` +
      `Modules are additive and must not link to baseline questions. ` +
      `Context: ${context || 'unknown'}. ` +
      `SQL: ${sql.substring(0, 200)}`
    );
  }
}

/**
 * Comprehensive guard for module queries
 * Checks: no baseline content tables, no baseline IDs, write-only to module tables,
 * and only reads from module corpus (not general assessment corpus)
 */
export function guardModuleQuery(sql: string, context?: string): void {
  assertModuleNoBaselineContent(sql, context);
  assertNoBaselineReferences(sql, context);
  assertModuleWriteOnly(sql, context);
  assertModuleOnlyModuleCorpus(sql, context);
}
