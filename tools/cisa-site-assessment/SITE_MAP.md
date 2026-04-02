# PSA Tool Website Map

## Navigation Structure

### Main Navigation (Header)
- **Home** (`/`) - System overview
- **Assessments** (`/assessments`) - Assessment list
- **OFCs** (`/ofcs`) - OFC templates view
- **Admin** (`/admin`) - Admin console
- **Taxonomy Dropdown**:
  - 📄 Coverage (`/coverage`)
  - 🏢 Sectors Guide (`/sectors`)
  - 📚 Disciplines Guide (`/disciplines`)

---

## Public Pages

### `/` (Home)
- **Purpose**: Landing page (redirects to assessments)
- **File**: `app/page.tsx`
- **Description**: Automatically redirects to `/assessments` - assessments are the primary entry point

### `/coverage`
- **Purpose**: List of coverage documents
- **File**: `app/coverage/page.tsx`
- **Features**:
  - Lists all ingested documents
  - Shows coverage percentage
  - Disciplines covered/total
  - Ingested timestamp
  - "View" button to detail page

### `/coverage/[documentId]`
- **Purpose**: Detailed coverage view for a specific document
- **File**: `app/coverage/[documentId]/page.tsx`
- **Features**:
  - Document coverage details
  - Discipline breakdowns
  - Evidence sections

### `/assessment`
- **Purpose**: Legacy redirect route (redirects to new assessment results page)
- **File**: `app/assessment/page.tsx`
- **Query Params**: `?documentId=<id>` (optional)
- **Behavior**:
  - If `documentId` provided → redirects to `/assessments/[documentId]/results`
  - If no `documentId` → redirects to `/assessments`
- **Note**: This is a compatibility route for legacy links

### `/assessments`
- **Purpose**: Assessment list/management
- **File**: `app/assessments/page.tsx`
- **Features**:
  - Lists all assessments
  - Shows assessment metadata (facility, sector, subsector)
  - Links to assessment execution page

### `/assessments/[assessmentId]`
- **Purpose**: Assessment execution page (answer questions)
- **File**: `app/assessments/[assessmentId]/page.tsx`
- **Features**:
  - Assessment metadata display
  - Question rendering grouped by layer:
    - Baseline questions
    - Sector questions
    - Subsector questions
  - YES/NO/N/A response selection
  - Auto-save on response change
  - "Back to Assessments" navigation → `/assessments`
  - "View Results" button → `/assessments/[assessmentId]/results`

### `/assessments/[assessmentId]/results`
- **Purpose**: Assessment results viewer (read-only)
- **File**: `app/assessments/[assessmentId]/results/page.tsx`
- **Features**:
  - Baseline assessment dashboard
  - Sector assessment dashboard (if applicable)
  - Discipline detail views
  - Printable report view
  - Baseline/Sector toggle
  - Navigation back to assessment execution page
- **Note**: This is the new location for assessment results (replaces legacy `/assessment` route)

### `/sectors`
- **Purpose**: DHS Critical Infrastructure Sectors guide
- **File**: `app/sectors/page.tsx`
- **Features**:
  - List of all sectors
  - Subsector details
  - Search functionality
  - Expandable sector cards

### `/disciplines`
- **Purpose**: Security disciplines taxonomy guide
- **File**: `app/disciplines/page.tsx`
- **Features**:
  - Discipline listings
  - Subtype details
  - Assessment questions
  - Search and filter

### `/reference/question-focus`
- **Purpose**: Question focus pages explaining question types per subtype
- **File**: `app/reference/question-focus/page.tsx`
- **Features**:
  - Browse by discipline and subtype
  - View question categories used in each subtype
  - Understand assessment intent and scope
  - Links to individual subtype question focus pages

### `/reference/question-focus/[discipline]/[subtype]`
- **Purpose**: Individual question focus page for a specific subtype
- **File**: `app/reference/question-focus/[discipline]/[subtype]/page.tsx`
- **Features**:
  - Question focus overview
  - Question categories used in this subtype
  - Categories explicitly out of scope
  - Assessment intent (non-scoring)

### `/admin`
- **Purpose**: Admin console root
- **File**: `app/admin/page.tsx`
- **Features**:
  - Dashboard showing 5 admin domains
  - Quick access to top 3 tools per domain
  - Links to domain landing pages
  - Status strip via AdminLayout

### Admin Domain Pages

#### `/admin/doctrine`
- **Purpose**: Doctrine domain landing page
- **File**: `app/admin/doctrine/page.tsx`
- **Tools**:
  - Doctrine Validation (`/admin/doctrine/validation`)
  - Freeze Status (`/admin/doctrine/freeze`)

#### `/admin/data`
- **Purpose**: Data & Ingestion domain landing page
- **File**: `app/admin/data/page.tsx`
- **Tools**:
  - Coverage Analysis (`/admin/data/coverage`)
  - Coverage Dashboard (`/admin/data/coverage-dashboard`)
  - Gap Analysis (`/admin/data/gap-analysis`)
  - Canonical Content Dashboard (`/admin/data/canonical-content`)
  - Candidate Packages (`/admin/data/candidates`)

#### `/admin/analysis`
- **Purpose**: Analysis & Review domain landing page
- **File**: `app/admin/analysis/page.tsx`
- **Tools**:
  - Assessment Status (`/admin/analysis/assessments`)
  - Gap Detection (`/admin/analysis/gap-detection`)

#### `/admin/system`
- **Purpose**: System State domain landing page
- **File**: `app/admin/system/page.tsx`
- **Tools**: Currently no tools (domain reserved for future system monitoring tools)

#### `/admin/utilities`
- **Purpose**: Utilities domain landing page
- **File**: `app/admin/utilities/page.tsx`
- **Tools**: Utility tools and maintenance functions

### Admin Tool Pages

#### `/admin/doctrine/validation`
- **Purpose**: Doctrine validation checks
- **File**: `app/admin/doctrine/validation/page.tsx`
- **Features**: Run validation checks on doctrine integrity

#### `/admin/doctrine/freeze`
- **Purpose**: Baseline freeze status and readiness
- **File**: `app/admin/doctrine/freeze/page.tsx`
- **Features**: Check baseline freeze readiness and status

#### `/admin/data/coverage`
- **Purpose**: Coverage analysis and statistics
- **File**: `app/admin/data/coverage/page.tsx`
- **Features**: View canonical coverage statistics and history

#### `/admin/data/coverage-dashboard`
- **Purpose**: Coverage dashboard
- **File**: `app/admin/data/coverage-dashboard/page.tsx`
- **Features**: Baseline coverage index and discipline completion status

#### `/admin/data/gap-analysis`
- **Purpose**: Gap analysis
- **File**: `app/admin/data/gap-analysis/page.tsx`
- **Features**: Identify missing questions, vulnerabilities, and OFCs by subtype

#### `/admin/data/canonical-content`
- **Purpose**: Canonical content dashboard
- **File**: `app/admin/data/canonical-content/page.tsx`
- **Features**: View canonical content coverage by discipline and subtype

#### `/admin/data/candidates`
- **Purpose**: Candidate packages management
- **File**: `app/admin/data/candidates/page.tsx`
- **Features**: View and manage candidate canonical packages

#### `/admin/analysis/assessments`
- **Purpose**: Assessment status tracking
- **File**: `app/admin/analysis/assessments/page.tsx`
- **Features**: View assessment counts, status breakdown, and doctrine versions

#### `/admin/analysis/gap-detection`
- **Purpose**: Gap detection reports
- **File**: `app/admin/analysis/gap-detection/page.tsx`
- **Features**: View gap detection reports and candidate suggestions by subtype

#### `/admin/review-statements`
- **Purpose**: Statement review and approval
- **File**: `app/admin/review-statements/page.tsx`
- **Features**: Review and approve/reject ingested source statements


---

## API Routes

### Assessment APIs

#### `GET /api/assessment/scoring?documentId=<id>`
- **Purpose**: Fetch assessment scoring data
- **File**: `app/api/assessment/scoring/route.ts`
- **Returns**: Baseline and sector scoring results

#### `GET /api/assessments`
- **Purpose**: List assessments
- **File**: `app/api/assessments/route.ts`

#### `GET /api/assessments/[assessmentId]`
- **Purpose**: Fetch assessment metadata and required elements
- **File**: `app/api/assessments/[assessmentId]/route.ts`
- **Returns**: Assessment metadata and ordered required elements

#### `PATCH /api/assessments/[assessmentId]`
- **Purpose**: Save assessment response
- **File**: `app/api/assessments/[assessmentId]/route.ts`
- **Body**: `{ element_id: string, response: "YES" | "NO" | "N/A" }`

### Document APIs

#### `GET /api/documents`
- **Purpose**: List all documents
- **File**: `app/api/documents/route.ts`

#### `GET /api/documents/[documentId]/coverage`
- **Purpose**: Get coverage data for a document
- **File**: `app/api/documents/[documentId]/coverage/route.ts`

### Runtime APIs (RUNTIME Database)

#### `GET /api/runtime/questions?universe=ALL|BASELINE|EXPANSION`
- **Purpose**: Fetch baseline and expansion questions
- **File**: `app/api/runtime/questions/route.ts`
- **Returns**: Baseline questions from `baseline_spines_runtime` + expansion questions from CORPUS
- **Query Params**: `universe` (ALL, BASELINE, EXPANSION)

#### `GET /api/runtime/assessments`
- **Purpose**: List all assessments
- **File**: `app/api/runtime/assessments/route.ts`
- **Returns**: Array of assessment metadata

#### `POST /api/runtime/assessments`
- **Purpose**: Create new assessment
- **File**: `app/api/runtime/assessments/route.ts`
- **Body**: Assessment creation payload

#### `GET /api/runtime/assessments/[assessmentId]`
- **Purpose**: Get assessment details
- **File**: `app/api/runtime/assessments/[assessmentId]/route.ts`

#### `GET /api/runtime/assessments/[assessmentId]/questions`
- **Purpose**: Get questions for an assessment (baseline + expansion with responses)
- **File**: `app/api/runtime/assessments/[assessmentId]/questions/route.ts`

#### `GET /api/runtime/assessments/[assessmentId]/required_elements`
- **Purpose**: Get required elements (baseline spines) for an assessment
- **File**: `app/api/runtime/assessments/[assessmentId]/required_elements/route.ts`

#### `GET /api/runtime/assessments/[assessmentId]/responses`
- **Purpose**: Get assessment responses
- **File**: `app/api/runtime/assessments/[assessmentId]/responses/route.ts`

#### `PUT /api/runtime/assessments/[assessmentId]/responses`
- **Purpose**: Update assessment responses
- **File**: `app/api/runtime/assessments/[assessmentId]/responses/route.ts`

#### `GET /api/runtime/assessments/[assessmentId]/results`
- **Purpose**: Get assessment scoring results
- **File**: `app/api/runtime/assessments/[assessmentId]/results/route.ts`

#### `GET /api/runtime/health`
- **Purpose**: Runtime database health check
- **File**: `app/api/runtime/health/route.ts`
- **Returns**: Database connection status, baseline spine counts, schema checks

#### `GET /api/runtime/ofc-library`
- **Purpose**: Get OFC library
- **File**: `app/api/runtime/ofc-library/route.ts`

#### `GET /api/runtime/metadata`
- **Purpose**: Get sectors and subsectors metadata
- **File**: `app/api/runtime/metadata/route.ts`

### Taxonomy APIs

#### `GET /api/sectors`
- **Purpose**: List all sectors
- **File**: `app/api/sectors/route.ts`

#### `GET /api/subsectors?sectorId=<id>`
- **Purpose**: List subsectors for a sector
- **File**: `app/api/subsectors/route.ts`

#### `GET /api/disciplines`
- **Purpose**: List all disciplines
- **File**: `app/api/disciplines/route.ts`

#### `GET /api/disciplines/subtypes`
- **Purpose**: List discipline subtypes
- **File**: `app/api/disciplines/subtypes/route.ts`

#### `GET /api/reference/disciplines`
- **Purpose**: Get disciplines with subtypes
- **File**: `app/api/reference/disciplines/route.ts`

#### `GET /api/reference/discipline-subtypes`
- **Purpose**: Get discipline subtypes
- **File**: `app/api/reference/discipline-subtypes/route.ts`

#### `GET /api/reference/baseline-questions`
- **Purpose**: Get baseline questions from `baseline_spines_runtime`
- **File**: `app/api/reference/baseline-questions/route.ts`

### System APIs

#### `GET /api/system/status`
- **Purpose**: System status check
- **File**: `app/api/system/status/route.ts`

#### `GET /api/system/coverage`
- **Purpose**: System coverage information
- **File**: `app/api/system/coverage/route.ts`

#### `GET /api/system/test-flask`
- **Purpose**: Test Flask backend connection
- **File**: `app/api/system/test-flask/route.ts`

### Utility APIs

#### `GET /api/db/test`
- **Purpose**: Database connection test
- **File**: `app/api/db/test/route.ts`

#### `GET /api/logs?file=<filename>`
- **Purpose**: Fetch log file contents
- **File**: `app/api/logs/route.ts`

---

## Component Library

### Assessment Components
- `AssessmentDashboard.tsx` - Summary dashboard with baseline/sector stats
- `AssessmentViewToggle.tsx` - Toggle between baseline/sector views
- `DisciplineDetailView.tsx` - Discipline roll-ups and subtype breakdowns
- `PrintableReportView.tsx` - Print-friendly report generation

### Coverage Components
- `CoverageViewToggle.tsx` - Coverage view toggle
- `EvidenceSection.tsx` - Evidence display section
- `EvidenceViewer.tsx` - Evidence viewer component

### Utility Components
- `TaxonomyDropdown.tsx` - Navigation dropdown for sectors/disciplines
- `LogViewer.tsx` - Log file viewer
- `ProcessingLogs.tsx` - Processing logs display
- `USWDSInit.tsx` - USWDS initialization

---

## User Flows

### Assessment Execution Flow
1. Navigate to `/assessments` (assessment list)
2. Select assessment → `/assessments/[assessmentId]`
3. Answer questions (YES/NO/N/A)
4. Responses auto-save
5. Click "View Results" → `/assessments/[assessmentId]/results`
6. Review scored results and generate report

### Assessment Results Flow
1. Navigate to `/assessments/[assessmentId]/results`
   - OR use legacy route `/assessment?documentId=<id>` (auto-redirects)
2. View baseline dashboard
3. Toggle to sector view (if applicable)
4. View discipline details
5. Generate printable report

### Coverage Review Flow
1. Navigate to `/coverage`
2. View document list
3. Click "View" → `/coverage/[documentId]`
4. Review coverage details and evidence

### Taxonomy Exploration Flow
1. Use Taxonomy Dropdown in header
2. Navigate to `/sectors` or `/disciplines`
3. Search and explore taxonomy
4. View details and descriptions

---

## Route Summary

### Public Routes
- `/` - Home (redirects to `/assessments`)
- `/coverage` - Coverage list
- `/coverage/[documentId]` - Coverage detail
- `/assessment` - Legacy redirect (redirects to `/assessments` or `/assessments/[id]/results`)
- `/assessments` - Assessment list
- `/assessments/[assessmentId]` - Assessment execution (answer questions)
- `/assessments/[assessmentId]/results` - Assessment results viewer (read-only)
- `/ofcs` - OFC templates view
- `/sectors` - Sectors guide
- `/disciplines` - Disciplines guide
- `/reference/question-focus` - Question focus pages
- `/reference/question-focus/[discipline]/[subtype]` - Individual question focus page

### Admin Routes
- `/admin` - Admin console root
- `/admin/doctrine` - Doctrine domain
- `/admin/doctrine/validation` - Doctrine validation
- `/admin/doctrine/freeze` - Freeze status
- `/admin/data` - Data & Ingestion domain
- `/admin/data/coverage` - Coverage analysis
- `/admin/data/coverage-dashboard` - Coverage dashboard
- `/admin/data/gap-analysis` - Gap analysis
- `/admin/data/canonical-content` - Canonical content dashboard
- `/admin/data/candidates` - Candidate packages
- `/admin/analysis` - Analysis & Review domain
- `/admin/analysis/assessments` - Assessment status
- `/admin/analysis/gap-detection` - Gap detection
- `/admin/review-statements` - Review statements
- `/admin/system` - System State domain
- `/admin/utilities` - Utilities domain

### API Routes

#### Runtime APIs
- `/api/runtime/questions` - Baseline and expansion questions
- `/api/runtime/assessments` - Assessment CRUD
- `/api/runtime/assessments/[assessmentId]/questions` - Assessment questions
- `/api/runtime/assessments/[assessmentId]/required_elements` - Required elements
- `/api/runtime/assessments/[assessmentId]/responses` - Assessment responses
- `/api/runtime/assessments/[assessmentId]/results` - Assessment results
- `/api/runtime/health` - Runtime database health check
- `/api/runtime/ofc-library` - OFC library
- `/api/runtime/metadata` - Sectors and subsectors metadata

#### Assessment APIs
- `/api/assessment/scoring` - Assessment scoring
- `/api/assessments` - Assessment list (legacy)

#### Document APIs
- `/api/documents` - Document list
- `/api/documents/[documentId]/coverage` - Document coverage

#### Taxonomy APIs
- `/api/sectors` - Sectors API
- `/api/subsectors` - Subsectors API
- `/api/disciplines` - Disciplines API
- `/api/disciplines/subtypes` - Discipline subtypes API
- `/api/reference/disciplines` - Disciplines with subtypes
- `/api/reference/discipline-subtypes` - Discipline subtypes detail
- `/api/reference/baseline-questions` - Baseline questions reference

#### System APIs
- `/api/system/status` - System status
- `/api/system/coverage` - System coverage
- `/api/system/test-flask` - Flask connection test

#### Utility APIs
- `/api/db/test` - Database test
- `/api/logs` - Log file access

---

## Notes

- All assessment-related pages require proper IDs/parameters
- Assessment execution page (`/assessments/[assessmentId]`) is the primary data entry interface
- Assessment results page (`/assessments/[assessmentId]/results`) is read-only for viewing scored results
- Legacy `/assessment` route redirects for backward compatibility
- Coverage pages show document ingestion and coverage analysis
- Taxonomy pages (`/sectors`, `/disciplines`) are reference/guide pages
- Reference pages (`/reference/question-focus`) provide assessor-facing documentation on question types and categories
- All API routes proxy to Flask backend at `FLASK_BASE` (default: `http://localhost:5000`)

## Route Migration Notes

- **Legacy Route**: `/assessment?documentId=<id>` → **New Route**: `/assessments/[assessmentId]/results`
- The legacy route automatically redirects to maintain backward compatibility
- Assessment execution and results are now clearly separated:
  - Execution: `/assessments/[assessmentId]` (data entry)
  - Results: `/assessments/[assessmentId]/results` (read-only view)
