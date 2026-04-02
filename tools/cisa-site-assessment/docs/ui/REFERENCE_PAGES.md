# Reference Pages Documentation

## Overview

Reference pages provide PSAs (Physical Security Assessors) with read-only access to baseline question focus documentation. These pages are informational only and do not affect scoring, assessment workflows, or system functionality.

## Question Focus Pages

### Purpose

Question Focus pages explain the focus and intent of baseline questions for each discipline subtype. They help assessors understand:

- What categories of questions are used in each subtype
- The scope and intent of baseline questions
- What is explicitly in scope or out of scope

### Access

**Route**: `/reference/question-focus`

**Navigation**: Available through the "Reference" dropdown in the main navigation menu.

### Structure

#### Index Page (`/reference/question-focus`)

- Lists all disciplines with available question focus pages
- Shows subtypes for each discipline
- Provides search functionality
- Displays statistics (total pages, disciplines, subtypes)

**Features**:
- Expandable discipline cards
- Search by discipline or subtype name/code
- Direct links to subtype question focus pages
- "Baseline Reference" indicator explaining read-only nature

#### Subtype Page (`/reference/question-focus/[discipline]/[subtype]`)

- Displays markdown content for a specific subtype
- Shows discipline and subtype names
- Includes "Baseline Reference" badge
- Renders markdown as formatted HTML

**Features**:
- Read-only content display
- Navigation back to index
- Clear indication of baseline scope
- No edit or scoring controls

### Read-Only Nature

Question Focus pages are **strictly read-only**:

- ✅ **Allowed**: Reading content, navigation, searching
- ❌ **Disallowed**: Editing, scoring, compliance actions, exports, modifications

**Visual Indicators**:
- "Baseline Reference" badge on pages
- Subtext: "This page explains the focus of baseline questions. It does not affect scoring."
- No edit icons or buttons
- No scoring indicators
- No workflow actions

### Data Source

**Location**: `docs/reference/question_focus/` (in psa_engine repository)

**Format**: Markdown files (`.md`)

**Structure**:
```
docs/reference/question_focus/
  [discipline]/
    [subtype].md
```

**Scope**: Baseline questions only. Sector and subsector content is not included.

### API Endpoints

#### `GET /api/reference/question-focus`

Returns list of available question focus pages.

**Response**:
```json
{
  "pages": [
    {
      "discipline": "security-management-governance",
      "subtype": "governance",
      "path": "security-management-governance/governance"
    }
  ]
}
```

#### `GET /api/reference/question-focus/[discipline]/[subtype]`

Returns markdown content converted to HTML for a specific subtype.

**Response**:
```json
{
  "content": "<h1>Question Focus</h1><p>Content...</p>"
}
```

**Error Handling**:
- 404: Page not found
- 500: Server error

### Intended PSA Usage

Question Focus pages are designed for:

1. **Reference**: Understanding what baseline questions cover
2. **Clarification**: Understanding question scope and intent
3. **Education**: Learning about question categories per subtype

**Not intended for**:
- Assessment execution
- Scoring calculations
- Compliance tracking
- Workflow management

### Access Control

**Permissions**: Same as taxonomy navigation access
- No elevated permissions required
- Read-only enforced at component level
- No mutation paths in code

### Navigation

Question Focus pages are accessible through:

1. **Main Navigation**: Reference → Question Focus
2. **Direct URL**: `/reference/question-focus`
3. **Bookmarkable**: All URLs are deterministic and can be bookmarked

### Relationship to Taxonomy

Question Focus pages mirror the taxonomy structure:

- **Disciplines**: Match canonical discipline taxonomy
- **Subtypes**: Match canonical subtype taxonomy
- **URLs**: Deterministic based on discipline/subtype codes

This ensures consistency between taxonomy navigation and question focus reference pages.

### Limitations

**Scope**:
- Baseline questions only
- No sector content
- No subsector content

**Functionality**:
- No question display (reference only)
- No OFC links
- No scoring integration
- No assessment workflow integration

### Future Considerations

If additional reference materials are needed:

1. Create new markdown files in `docs/reference/question_focus/`
2. Follow existing naming convention: `[discipline]/[subtype].md`
3. Ensure content is baseline-scoped only
4. Pages will automatically appear in the index

---

**Last Updated**: 2025-01-27

