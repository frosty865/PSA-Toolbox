# Baseline Question Validity Rules

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Effective Date:** 2025-12-27

## Purpose

Baseline questions define minimum, universal, field-verifiable security conditions. These rules ensure baseline questions remain observable, deterministic, and free from framework/governance language.

## Core Principle

**Baseline questions must support deterministic YES / NO / N_A answers based on observation or direct inspection.**

## Validity Rules

### MUST Rules (All Required)

A baseline question **MUST**:

#### RULE-001: Observable Condition
**Requirement:** Be answerable via on-site observation, system inspection, or direct evidence.

**Rationale:** Baseline questions must be field-verifiable. Assessors must be able to answer through physical inspection, not documentation review.

**Examples:**
- ✅ "Are biometric access readers installed at controlled entry points?"
- ❌ "Does the facility have biometric access capabilities?"

#### RULE-002: Physical or Functional Condition
**Requirement:** Describe a physical or functional security condition that exists or does not exist.

**Rationale:** Questions must reference concrete, observable states, not abstract concepts.

**Examples:**
- ✅ "Are security cameras operational and recording?"
- ❌ "Is video surveillance managed effectively?"

#### RULE-003: Meaningful NO Response
**Requirement:** Produce a meaningful NO when the condition is absent.

**Rationale:** A NO response must indicate a concrete absence, not a lack of documentation or process.

**Examples:**
- ✅ "Are perimeter barriers installed?" → NO = barriers not present
- ❌ "Are procedures documented?" → NO = documentation missing (not observable)

#### RULE-004: Truthful YES Response
**Requirement:** Produce a misleading YES only if the condition truly exists in practice.

**Rationale:** A YES response must reflect actual physical/functional state, not stated intent or policy.

**Examples:**
- ✅ "Are access control systems operational?" → YES = systems functioning
- ❌ "Are security processes in place?" → YES = process exists (not verifiable)

### MUST NOT Rules (All Prohibited)

A baseline question **MUST NOT**:

#### RULE-101: Policy/Procedure Satisfaction
**Requirement:** Be satisfiable by policy, procedure, or documentation alone.

**Rationale:** Documentation cannot be verified through physical inspection. Policies may exist without implementation.

**Violation Patterns:**
- "Are procedures documented?"
- "Are policies in place?"
- "Is documentation available?"

**Examples:**
- ❌ "Are documented procedures in place for access control?"
- ✅ "Are access control systems operational?"

#### RULE-102: Abstract Terms
**Requirement:** Ask about "capabilities", "processes", "programs", or "governance".

**Rationale:** Abstract terms refer to organizational capacity, not observable conditions.

**Violation Patterns:**
- "capabilities"
- "processes"
- "program"
- "governance"
- "framework"

**Examples:**
- ❌ "Does the facility have biometric access capabilities?"
- ✅ "Are biometric access readers installed?"

#### RULE-103: Assurance Language
**Requirement:** Ask whether something is "ensured", "managed", or "defined".

**Rationale:** Assurance language refers to organizational processes, not observable states.

**Violation Patterns:**
- "ensured"
- "ensures that"
- "managed"
- "defined"
- "maintained"

**Examples:**
- ❌ "Are processes in place to ensure access control is maintained?"
- ✅ "Are access control systems operational?"

#### RULE-104: Roles and Responsibilities
**Requirement:** Depend on roles, responsibilities, or organizational structure.

**Rationale:** Organizational structure cannot be verified through physical inspection.

**Violation Patterns:**
- "roles defined"
- "responsibilities assigned"
- "personnel assigned"
- "organizational structure"

**Examples:**
- ❌ "Are roles and responsibilities defined for access control?"
- ✅ "Are access control systems operational?"

#### RULE-105: Interpretation Required
**Requirement:** Require interpretation, intent, or trust in stated practice.

**Rationale:** Baseline questions must be deterministic. Interpretation introduces subjectivity.

**Violation Patterns:**
- "effective"
- "adequate"
- "appropriate"
- "sufficient"
- "properly"

**Examples:**
- ❌ "Is access control effectively managed?"
- ✅ "Are access control systems operational?"

## Rule Severity

### BLOCKER
Violations that make a question fundamentally non-observable:
- RULE-101 (Policy/Procedure Satisfaction)
- RULE-102 (Abstract Terms)
- RULE-103 (Assurance Language)
- RULE-104 (Roles and Responsibilities)

**Action:** Question must be rewritten or removed from baseline.

### REVIEW
Violations that may be acceptable with justification:
- RULE-105 (Interpretation Required) - May be acceptable if question is still observable

**Action:** Human review required. Exception must be documented.

## Rule Application

### Automatic Detection

Rules are encoded as pattern-based checks in `tools/validate_baseline_observability.py`:

- **RULE-001**: Validated by absence of RULE-101, RULE-102, RULE-103, RULE-104 violations
- **RULE-002**: Validated by absence of abstract terms (RULE-102)
- **RULE-003**: Validated by absence of policy/procedure focus (RULE-101)
- **RULE-004**: Validated by absence of assurance language (RULE-103)
- **RULE-101**: Pattern matching for policy/procedure language
- **RULE-102**: Pattern matching for abstract terms
- **RULE-103**: Pattern matching for assurance language
- **RULE-104**: Pattern matching for roles/responsibilities language
- **RULE-105**: Pattern matching for interpretation-required language

### Manual Review

Questions flagged as REVIEW severity require human judgment:
- Is the question still observable despite interpretation language?
- Can the question be rephrased to remove interpretation?
- Is an exception justified?

## Enforcement

### Generation Workflow

Baseline question generation (`tools/regenerate_baseline_questions.py`) must:
1. Validate all generated questions against rules
2. Fail generation if any BLOCKER violations are found
3. Warn on REVIEW violations (allow with override)

### LLM Candidate Review

LLM-generated baseline candidates must:
1. Be validated against rules before acceptance
2. Be rejected if BLOCKER violations are found
3. Require human review for REVIEW violations

### Manual Authoring

Manual authoring workflow must:
1. Provide real-time rule validation feedback
2. Block submission if BLOCKER violations are found
3. Require justification for REVIEW violations

## Exceptions

Exceptions to rules are **NOT PERMITTED** for BLOCKER violations.

Exceptions for REVIEW violations require:
1. Written justification
2. Approval from baseline governance authority
3. Documentation in question metadata

## Related Documentation

- `docs/baseline/BASELINE_INTEGRITY_REVIEW.md` - Integrity review documentation
- `tools/validate_baseline_observability.py` - Validation implementation
- `tools/audit_baseline_integrity.py` - Audit tool

