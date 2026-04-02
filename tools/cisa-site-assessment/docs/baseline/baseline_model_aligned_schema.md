# Baseline Model-Aligned Schema (ALT_SAFE Methodology)

## Overview

This document defines the canonical PSA baseline assessment schema aligned with the ALT_SAFE assessment methodology. The schema separates **primary scored questions** from **conditional detail items** and **technology-driven branching**.

## Core Principles

1. **Only primary questions are scored** - Detail items are supporting evidence only
2. **Conditional logic is explicit** - Answer-driven and technology-driven visibility
3. **Technology selections control branching** - Not inferred, explicitly captured
4. **No artificial gate multiplication** - One primary question per control topic unless ALT_SAFE explicitly splits it

## Schema Design

### 1. `assessment_primary_questions`

Primary scored questions (YES/NO/N/A) per control topic.

```sql
CREATE TABLE public.assessment_primary_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,  -- From ALT_SAFE input name
  question_text text NOT NULL,
  response_enum text[] NOT NULL DEFAULT ARRAY['YES', 'NO', 'N_A'],
  section_key text,  -- Section grouping from ALT_SAFE
  order_index integer NOT NULL,
  control_topic text,  -- Human-readable control topic name
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_response_enum CHECK (
    response_enum <@ ARRAY['YES', 'NO', 'N_A']::text[]
  )
);

CREATE INDEX idx_primary_questions_section ON public.assessment_primary_questions(section_key);
CREATE INDEX idx_primary_questions_order ON public.assessment_primary_questions(order_index);
```

**Rules:**
- One row per primary question from ALT_SAFE
- `question_key` matches the HTML input `name` attribute
- `response_enum` is always `['YES', 'NO', 'N_A']`
- `order_index` preserves ALT_SAFE question order

### 2. `assessment_detail_items`

Conditional detail items (checkboxes/evidence) shown when primary question is answered.

```sql
CREATE TABLE public.assessment_detail_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detail_item_id text NOT NULL,  -- From ALT_SAFE checkbox id
  detail_label text NOT NULL,
  parent_question_key text NOT NULL,  -- FK to assessment_primary_questions.question_key
  conditional_logic jsonb NOT NULL,  -- e.g., {"show_when": "YES"}
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign key
  CONSTRAINT fk_detail_parent_question
    FOREIGN KEY (parent_question_key)
    REFERENCES public.assessment_primary_questions(question_key)
    ON DELETE CASCADE,
  
  -- Uniqueness
  UNIQUE(parent_question_key, detail_item_id)
);

CREATE INDEX idx_detail_items_parent ON public.assessment_detail_items(parent_question_key);
```

**Rules:**
- Detail items are **NOT scored** - they are evidence/supporting information only
- `conditional_logic` JSONB structure:
  ```json
  {
    "show_when": "YES",  // or "NO", "N_A", or array ["YES", "NO"]
    "trigger_answer": "YES"
  }
  ```
- Multiple detail items can share the same `parent_question_key`

### 3. `assessment_technology_selections`

Technology decision points that drive conditional questioning.

```sql
CREATE TABLE public.assessment_technology_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selector_id text NOT NULL,  -- From ALT_SAFE select/dropdown id
  selector_label text NOT NULL,
  parent_question_key text,  -- Optional: if tech selector is part of a question
  technology_options jsonb NOT NULL,  -- Array of {value, label} options
  dependent_question_keys text[],  -- Questions that appear based on selection
  dependent_detail_item_ids text[],  -- Detail items that appear based on selection
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign key (optional)
  CONSTRAINT fk_tech_parent_question
    FOREIGN KEY (parent_question_key)
    REFERENCES public.assessment_primary_questions(question_key)
    ON DELETE SET NULL,
  
  -- Uniqueness
  UNIQUE(selector_id)
);

CREATE INDEX idx_tech_selections_parent ON public.assessment_technology_selections(parent_question_key);
```

**Rules:**
- Technology selections are **explicit** - not inferred from answers
- `technology_options` JSONB structure:
  ```json
  [
    {"value": "CCTV_ANALOG", "label": "Analog CCTV"},
    {"value": "IP_CAMERA_VMS", "label": "IP Camera with VMS"}
  ]
  ```
- `dependent_question_keys` and `dependent_detail_item_ids` control visibility
- Technology selection can be standalone or nested within a primary question

### 4. `assessment_responses` (Primary Questions)

Responses to primary scored questions.

```sql
CREATE TABLE public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id text NOT NULL,
  question_key text NOT NULL,  -- FK to assessment_primary_questions.question_key
  response text NOT NULL CHECK (response IN ('YES', 'NO', 'N_A')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_response_assessment_instance
    FOREIGN KEY (assessment_instance_id)
    REFERENCES public.assessment_instances(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_response_question
    FOREIGN KEY (question_key)
    REFERENCES public.assessment_primary_questions(question_key)
    ON DELETE RESTRICT,
  
  -- Uniqueness
  UNIQUE(assessment_instance_id, question_key)
);

CREATE INDEX idx_responses_instance ON public.assessment_responses(assessment_instance_id);
CREATE INDEX idx_responses_question ON public.assessment_responses(question_key);
```

### 5. `assessment_detail_responses`

Responses to conditional detail items (checkboxes).

```sql
CREATE TABLE public.assessment_detail_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id text NOT NULL,
  detail_item_id text NOT NULL,  -- FK to assessment_detail_items.detail_item_id
  parent_question_key text NOT NULL,  -- Denormalized for query efficiency
  is_checked boolean NOT NULL DEFAULT false,
  notes text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_detail_response_instance
    FOREIGN KEY (assessment_instance_id)
    REFERENCES public.assessment_instances(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_detail_response_item
    FOREIGN KEY (detail_item_id, parent_question_key)
    REFERENCES public.assessment_detail_items(detail_item_id, parent_question_key)
    ON DELETE CASCADE,
  
  -- Uniqueness
  UNIQUE(assessment_instance_id, detail_item_id)
);

CREATE INDEX idx_detail_responses_instance ON public.assessment_detail_responses(assessment_instance_id);
CREATE INDEX idx_detail_responses_parent ON public.assessment_detail_responses(parent_question_key);
```

### 6. `assessment_technology_profile_responses`

Technology selections made during assessment.

```sql
CREATE TABLE public.assessment_technology_profile_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_instance_id text NOT NULL,
  selector_id text NOT NULL,  -- FK to assessment_technology_selections.selector_id
  selected_technology_value text NOT NULL,
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_tech_response_instance
    FOREIGN KEY (assessment_instance_id)
    REFERENCES public.assessment_instances(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_tech_response_selector
    FOREIGN KEY (selector_id)
    REFERENCES public.assessment_technology_selections(selector_id)
    ON DELETE RESTRICT,
  
  -- Uniqueness
  UNIQUE(assessment_instance_id, selector_id)
);

CREATE INDEX idx_tech_responses_instance ON public.assessment_technology_profile_responses(assessment_instance_id);
CREATE INDEX idx_tech_responses_selector ON public.assessment_technology_profile_responses(selector_id);
```

## Scoring Rules

### Primary Questions Only

- **Scored**: `assessment_responses` (primary questions)
- **Not Scored**: 
  - `assessment_detail_responses` (supporting evidence only)
  - `assessment_technology_profile_responses` (branching control only)

### Scoring Calculation

```sql
-- Example scoring query (conceptual)
SELECT 
  COUNT(*) FILTER (WHERE response = 'YES') as yes_count,
  COUNT(*) FILTER (WHERE response = 'NO') as no_count,
  COUNT(*) FILTER (WHERE response = 'N_A') as na_count,
  COUNT(*) as total_answered,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE response = 'YES') / 
    NULLIF(COUNT(*) FILTER (WHERE response != 'N_A'), 0),
    2
  ) as score_percent
FROM assessment_responses
WHERE assessment_instance_id = $1;
```

## Conditional Logic Implementation

### Answer-Driven Visibility

Detail items appear when:
- Primary question answer matches `conditional_logic.show_when`

Example:
```json
{
  "parent_question_key": "has_video_surveillance",
  "conditional_logic": {
    "show_when": "YES",
    "trigger_answer": "YES"
  }
}
```

### Technology-Driven Visibility

Questions/detail items appear when:
- Technology selection matches `dependent_question_keys` or `dependent_detail_item_ids`

Example:
```json
{
  "selector_id": "vss_system_type",
  "technology_options": [
    {"value": "CCTV_ANALOG", "label": "Analog CCTV"},
    {"value": "IP_CAMERA_VMS", "label": "IP Camera with VMS"}
  ],
  "dependent_question_keys": [
    "ip_camera_network_security",
    "vms_recording_retention"
  ]
}
```

## Non-Scored Sections

### Facility/Contact Information

Stored separately (not in baseline schema):
- `assessments.facility_name`
- `assessments.contact_info` (if exists)
- Custom fields as needed

### Custom Vulnerability/Commendable Sections

Stored in separate tables (not defined here):
- `assessment_custom_vulnerabilities`
- `assessment_commendable_practices`

These are **never scored** and are informational only.

## Migration Strategy

### From Current Baseline v2

1. **Map existing questions** to ALT_SAFE primary questions (via `alt_safe_to_taxonomy_mapping.csv`)
2. **Extract conditional details** from ALT_SAFE HTML (checkboxes, evidence fields)
3. **Identify technology selectors** and their dependent questions
4. **Preserve existing responses** where question keys match
5. **Mark unmapped questions** as deprecated or migrate to detail items

### Data Preservation

- Existing `assessment_responses` can be migrated if `question_key` matches
- Unmatched questions become detail items or are archived
- Technology profiles (if any) map to `assessment_technology_selections`

## Constraints

1. **No artificial gate multiplication** - One primary question per control topic unless ALT_SAFE explicitly splits it
2. **No confidence fields** - Response is YES/NO/N_A only
3. **No inferred technology** - Technology selections are explicit
4. **Detail items never scored** - They are evidence/supporting information only
5. **Conditional logic is explicit** - Stored in JSONB, not inferred

## Future Enhancements

- Sector/subsector overlays (additive primary questions)
- Technology maturity index (comparative scoring, separate from baseline)
- OFC generation from NO responses (unchanged from current model)

