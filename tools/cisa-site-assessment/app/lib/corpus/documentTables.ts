/**
 * Document table constants
 * 
 * corpus_documents is the ONLY authoritative table for new document ingestion.
 * documents table remains readable for backward compatibility but MUST NOT be written to.
 */

export const AUTHORITATIVE_DOCUMENT_TABLE = "corpus_documents" as const;
export const LEGACY_DOCUMENT_TABLE = "documents" as const;
