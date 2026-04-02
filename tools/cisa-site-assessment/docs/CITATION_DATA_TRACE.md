# Citation Data Trace

## Overview
This document traces where citation data comes from in the UI, specifically the "MODULE RESEARCH, MODULE" citation text that appears in the OFC review queue.

## Data Flow Path

### 1. UI Display Layer
**File**: `psa_rebuild/app/admin/ofcs/page.tsx`
- **Line 322**: Table header shows "Citation" column
- **Line 411**: Displays `{ofc.citation}` 
- **Line 402-446**: Citation rendering logic
  - Primary: Shows `ofc.citation` if available
  - Fallback: Shows `ofc.source_title` + `ofc.source_publisher` if citation is missing

**Note**: The Module Data Management page (`/admin/module-data`) does NOT display citation - it only shows title, text, status, discipline, and timestamps.

### 2. API Endpoint Layer
**File**: `psa_rebuild/app/api/admin/ofcs/review-queue/route.ts`
- **Endpoint**: `GET /api/admin/ofcs/review-queue`
- **Line 184**: Selects `cs.citation_text` from `canonical_sources`
- **Line 197**: Joins `canonical_sources cs ON ocq.source_id = cs.source_id`
- **Line 262**: Maps citation to response:
  ```typescript
  citation: (row.citation_text && row.citation_text.trim()) || 
            (row.source_title && row.source_title.trim()) || null
  ```

### 3. Database Query Layer
**Query Structure** (from `review-queue/route.ts` lines 162-201):
```sql
SELECT 
  ocq.candidate_id::text as id,
  ocq.snippet_text as ofc_text,
  ocq.title,
  -- ... other fields ...
  cs.title as source_title,
  cs.citation_text,              -- ← CITATION COMES FROM HERE
  cs.publisher as source_publisher,
  cs.published_date as source_published_date,
  cs.source_type,
  cs.uri as source_uri
FROM public.ofc_candidate_queue ocq
LEFT JOIN public.document_chunks dc ON ocq.document_chunk_id = dc.chunk_id
LEFT JOIN public.documents d ON dc.document_id = d.document_id
LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id  -- ← JOIN PATH
WHERE ocq.status = 'PENDING'
  AND ocq.ofc_origin = 'CORPUS'  -- ← FILTER (or 'MODULE' if originFilter='MODULE')
ORDER BY ocq.created_at DESC
LIMIT 500
```

### 4. Database Schema Layer

#### Table: `public.ofc_candidate_queue`
- **Column**: `source_id` (UUID, NOT NULL)
- **Foreign Key**: References `public.canonical_sources(source_id)`
- **Purpose**: Links each candidate to its source document

#### Table: `public.canonical_sources`
- **Column**: `citation_text` (TEXT, nullable)
- **Column**: `title` (TEXT, nullable) 
- **Column**: `publisher` (TEXT, nullable)
- **Column**: `source_type` (TEXT, nullable)
- **Purpose**: Stores metadata about source documents, including citation text

### 5. Data Origin

The citation text "MODULE RESEARCH, MODULE" is stored in:
```
public.canonical_sources.citation_text
WHERE source_id = (SELECT source_id FROM ofc_candidate_queue WHERE candidate_id = ...)
```

**Example Query to Find Citation Source**:
```sql
SELECT 
  ocq.candidate_id,
  ocq.ofc_origin,
  cs.title as source_title,
  cs.citation_text,
  cs.source_id
FROM public.ofc_candidate_queue ocq
LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
WHERE cs.citation_text ILIKE '%MODULE RESEARCH%'
LIMIT 10;
```

## Key Points

1. **Citation is Metadata**: The citation text is stored in `canonical_sources.citation_text` and is just descriptive metadata about the source document. It does NOT determine the `ofc_origin` classification.

2. **Join Path**: 
   ```
   ofc_candidate_queue.source_id → canonical_sources.source_id → canonical_sources.citation_text
   ```

3. **Filtering**: The `ofc_origin` column in `ofc_candidate_queue` is what controls visibility:
   - `ofc_origin = 'MODULE'` → Shows in Module Data Management
   - `ofc_origin = 'CORPUS'` → Shows in Review Queue (default)

4. **Citation Display**: 
   - `/admin/ofcs` (Review Queue) → Shows citation
   - `/admin/module-data` (Module Management) → Does NOT show citation

## Why "MODULE RESEARCH, MODULE" Appears

The citation text "MODULE RESEARCH, MODULE" appears because:
1. The candidate's `source_id` points to a `canonical_sources` entry
2. That entry has `citation_text = 'MODULE RESEARCH, MODULE'` (or similar)
3. This is just metadata - it doesn't mean the candidate is MODULE origin
4. The actual classification is in `ofc_candidate_queue.ofc_origin` (should be 'CORPUS' for mined candidates)

## Verification Query

To verify the citation source for a specific candidate:
```sql
SELECT 
  ocq.candidate_id,
  ocq.ofc_origin,  -- ← This is what matters for filtering
  ocq.title,
  cs.title as source_title,
  cs.citation_text,  -- ← This is just metadata
  cs.source_id
FROM public.ofc_candidate_queue ocq
LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
WHERE ocq.candidate_id = 'YOUR_CANDIDATE_ID';
```

## Summary

**Citation Data Flow**:
```
Database: canonical_sources.citation_text
    ↓ (via source_id FK)
Database: ofc_candidate_queue.source_id
    ↓ (via SQL JOIN)
API: /api/admin/ofcs/review-queue (cs.citation_text)
    ↓ (via HTTP response)
UI: /admin/ofcs (ofc.citation)
    ↓ (rendered)
Display: "MODULE RESEARCH, MODULE"
```

**Important**: The citation text is descriptive metadata and does NOT affect filtering. The `ofc_origin` column is the authoritative field for determining which UI shows the candidate.
