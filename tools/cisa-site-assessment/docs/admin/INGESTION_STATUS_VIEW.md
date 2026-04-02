# Library Ingestion Status View

**Location:** `/admin/data/library-ingestion`  
**Domain:** Data & Ingestion  
**Access:** Admin only  
**Type:** Read-only status view

---

## Purpose

The Library Ingestion Status view provides administrators with read-only visibility into:

- Documents archived in the library index
- Ingestion status of each document (ingested, not ingested, unknown, failed)
- Document metadata (filename, discipline, component, timestamps)

This page **informs** administrators about ingestion state but does **not** trigger ingestion or modify any data.

---

## What This Page Shows

### Summary Statistics

- **Total Documents**: Count of all documents in the library index
- **Ingested**: Count of documents that have been ingested into the database
- **Not Ingested**: Count of documents archived but not yet ingested
- **Unknown**: Count of documents where ingestion status could not be determined (e.g., database unavailable)

### Document Table

For each document, the table displays:

- **Filename**: Original filename of the document
- **Discipline**: Discipline classification from library index
- **Primary Component**: Primary physical security component
- **Archived At**: Timestamp when document was archived to library
- **Ingestion Status**: Current ingestion state (INGESTED, NOT_INGESTED, UNKNOWN, FAILED)
- **Ingested At**: Timestamp when document was ingested into database (if ingested)

### Filters

Client-side filters allow filtering by:

- **Discipline**: Filter by discipline name
- **Component**: Filter by primary component code
- **Ingestion Status**: Filter by status (INGESTED, NOT_INGESTED, UNKNOWN, FAILED)

Filters are applied client-side only and do not affect backend data.

---

## What This Page Does NOT Do

### ❌ Does NOT Trigger Ingestion

This page does not:
- Start ingestion jobs
- Retry failed ingestions
- Manually trigger database ingestion
- Modify ingestion state

### ❌ Does NOT Modify Data

This page does not:
- Edit library index
- Modify document metadata
- Change ingestion status
- Delete or archive documents

### ❌ Does NOT Provide Filesystem Access

This page does not:
- Browse library filesystem
- Download documents
- View document contents
- Access raw file paths

---

## Data Sources

### Library Index

**Source:** `D:/psa-workspace/psa_engine/analytics/library/library_index.json`

The library index is the authoritative source for:
- Document identity (SHA-256 hash)
- Document metadata (filename, discipline, component)
- Archive timestamps
- Library path

### Database (Ingestion Status)

**Source:** `coverage_runs` table

The database is queried to determine:
- Whether a document has been ingested
- Ingestion timestamp
- Document ID mapping

**Note:** If the database is unavailable, ingestion status will be marked as "UNKNOWN" but the page will still display library index data.

---

## How Ingestion Works

Ingestion is **not** triggered through this UI. Ingestion occurs through:

1. **Background Jobs**: Automated ingestion jobs process documents from the library
2. **Pipeline Watchers**: Watchers monitor for new documents and trigger ingestion
3. **Manual Scripts**: Administrative scripts can trigger ingestion for specific documents

This page only **displays** the results of ingestion, it does not **control** it.

---

## Access Control

- **Access Level**: Admin only
- **Enforcement**: Server-side role check (to be implemented)
- **Visibility**: Not accessible from assessment UI workflows

---

## Error Handling

### Missing Library Index

If the library index file does not exist:
- Page displays: "Library index file does not exist. No documents have been archived yet."
- Returns empty document list
- Does not error (graceful degradation)

### Database Unavailable

If the database is unavailable:
- Library index data is still displayed
- Ingestion status is marked as "UNKNOWN"
- Page continues to function (read-only)

### Invalid Index Structure

If the library index has invalid structure:
- Error message is displayed
- Empty document list is returned
- Does not crash the application

---

## Technical Details

### API Endpoint

**Route:** `/api/admin/library-ingestion-status`  
**Method:** GET  
**Response:** JSON with document array and summary statistics

### Sorting

Documents are sorted by:
1. **Ingestion Status** (INGESTED > NOT_INGESTED > UNKNOWN > FAILED)
2. **Archived At** (descending - newest first)

### Performance

- Library index is read from filesystem (no caching)
- Database query uses indexed `document_id` field
- Client-side filtering (no server round-trips)
- Suitable for libraries with hundreds to thousands of documents

---

## Related Documentation

- `analytics/watcher/README.md` - Watcher documentation
- `analytics/library/library_index.json` - Library index structure
- `docs/admin/README.md` - Admin console overview

---

**Last Updated:** 2025-01-27

