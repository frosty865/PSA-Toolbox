# No-Drift Plan for Assessment-to-Vulnerability Analysis

## Purpose
Convert an assessment into fact-based vulnerabilities and options for consideration without inventing facts, overstating gaps, or drifting away from the underlying answers.

## Core Rules
1. Use only the current assessment data as the truth source.
2. Treat blank fields as `Not Applicable` unless another explicit answer makes them relevant.
3. Never infer a failure from a descriptive word alone unless the survey explicitly records a negative, partial, missing, uncontrolled, or equivalent state.
4. Do not restate a question as a vulnerability.
5. Do not include commendables as vulnerabilities.
6. Do not merge separate measurable controls into one finding.
7. Do not invent “placeholder” vulnerabilities or options.
8. Every option for consideration must be tied to a source that can be cited.
9. If a citation page number cannot be verified, do not claim the page number is verified.

## Analysis Workflow

### 1. Load the assessment
- Read the assessment JSON.
- Extract section fields and table rows.
- Normalize values for comparison:
  - trim whitespace
  - preserve exact answer text
  - treat blank strings as `Not Applicable`

### 2. Identify explicit negatives
Flag only explicit control gaps such as:
- `No`
- `None`
- `Uncontrolled`
- `Partial`
- `Poor`
- `Fair` when the survey context supports a weaker condition
- mixed or split states that clearly indicate a weaker control compared with the other rows

### 3. Identify implied vulnerabilities
Create an implied vulnerability only when:
- multiple explicit answer values point to the same control weakness, and
- the conclusion can be stated without speculation, and
- the statement adds value beyond repeating the answers

Examples of valid implied outputs:
- “Shared entry points and an uncontrolled loading dock create mixed circulation.”
- “No lockdown boundary is documented between public and protected zones.”

### 4. Exclude unsupported statements
Remove any item that:
- depends only on a blank field
- assumes intent or protective quality from a descriptive label
- conflates distinct controls
- cannot be traced to one or more survey answers
- is just a paraphrase of the question

### 5. Build the vulnerability statement
Each vulnerability should contain:
- a specific failing control
- the exact survey evidence used
- the operational consequence
- no unsupported claims

### 6. Build options for consideration
For each vulnerability:
- provide 2 to 3 options
- each option must be concrete and actionable
- each option must be source-backed
- each option must be relevant to the specific vulnerability
- each option should be framed as a consideration, not a directive

### 7. Source citation discipline
- Use authoritative sources only.
- Prefer sources with page numbers.
- If the page number is known, record it.
- If the page number is not verified, do not invent one.
- Keep citations attached to the specific option they support.

### 8. Quality checks
Before publishing a catalog or report:
- compare every vulnerability against the assessment JSON
- confirm every entry has at least one explicit evidence point
- confirm blanks are not being counted
- confirm no two entries are just different wording for the same control failure
- confirm options do not introduce claims not supported by the source

## Recommended Output Structure
For each finding:
- `Vulnerability`
  - `Evidence`
  - `Why it matters`
- `Options for consideration`
  - Option 1
  - Option 2
  - Option 3
- `Sources`
  - source name
  - page number if verified

## Stop Conditions
Stop and revise the catalog if:
- a finding cannot be tied to a real answer
- a blank field is doing the work of a vulnerability
- a source citation cannot be defended
- the finding reads like a question restatement
- the finding contains unstated inference

