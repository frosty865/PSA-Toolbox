-- ============================================================================
-- Seed Reference Implementation: Key Control — Rekeying Procedures
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Seed canonical reference implementation for Rekeying Procedures subtype
-- TARGET DB: RUNTIME

BEGIN;

INSERT INTO public.discipline_subtype_reference_impl (discipline_subtype_id, reference_impl)
VALUES (
  '20d11544-f449-46f2-9aa8-39cfcf8a134b',
  '{
    "version": "1.0",
    "discipline": "Key Control",
    "subtype": "Rekeying Procedures",
    "section1": {
      "baseline_existence_question": {
        "question_text": "Are rekeying procedures utilized?",
        "response_enum": ["YES","NO","N_A"],
        "clarification": {
          "YES": "A recognized rekeying process exists.",
          "NO": "No recognized rekeying process exists.",
          "N_A": "Applies only if the facility does not use keyed locking mechanisms."
        }
      }
    },
    "section2": {
      "what_right_looks_like": [
        "A defined method exists to change locks and keys when control of keys is lost.",
        "A defined method exists to change locks and keys when access requirements change.",
        "The method is recognized as the facility's approach to rekeying.",
        "The method identifies who initiates or coordinates rekeying actions."
      ]
    },
    "section3": {
      "descriptive_branching_yes_only": [
        {
          "id": "REKEY_TRIGGERS",
          "question_text": "What recognized events or conditions trigger rekeying? (e.g., lost keys, access requirement changes, suspected compromise)",
          "response_type": "MULTI_SELECT_OR_TEXT"
        },
        {
          "id": "REKEY_SCOPE",
          "question_text": "What is the scope of rekeying when it occurs? (e.g., specific locks, areas, or facility-wide)",
          "response_type": "MULTI_SELECT_OR_TEXT"
        },
        {
          "id": "REKEY_OWNER",
          "question_text": "Who initiates or coordinates rekeying actions? (e.g., security, facilities, designated authority)",
          "response_type": "MULTI_SELECT_OR_TEXT"
        },
        {
          "id": "REKEY_METHOD",
          "question_text": "What method is used to perform rekeying? (e.g., lock replacement, cylinder rekeying, key system modification)",
          "response_type": "MULTI_SELECT_OR_TEXT"
        },
        {
          "id": "REKEY_RECORDS",
          "question_text": "Is rekeying documented or tracked? (Descriptive only — what records exist, not whether they are adequate)",
          "response_type": "MULTI_SELECT_OR_TEXT"
        }
      ]
    },
    "section4": {
      "ofc_trigger_notes_non_user_facing": [
        "After data capture, Indicators of Risk and Common Failures can be used to narrow OFC selection to the most relevant capability-level recommendations for this subtype.",
        "If the facility answers YES but describes unclear or inconsistent triggers, prefer OFCs that establish recognizable authorization and decision criteria for rekeying triggers (without restating the question).",
        "If the facility answers YES but scope and coordination are unclear, prefer OFCs that clarify ownership, coordination pathways, and how rekeying connects to access management processes.",
        "OFCs should mitigate problem classes and describe what capability should exist; avoid blame, enforcement language, priorities, timelines, costs, technologies, or regulatory framing."
      ]
    }
  }'::jsonb
)
ON CONFLICT (discipline_subtype_id)
DO UPDATE SET reference_impl = EXCLUDED.reference_impl, updated_at = now();

COMMENT ON TABLE public.discipline_subtype_reference_impl IS
'Canonical reference implementations per discipline subtype. Provides baseline intent, "what right looks like", descriptive branching, and OFC trigger notes.';

COMMIT;
