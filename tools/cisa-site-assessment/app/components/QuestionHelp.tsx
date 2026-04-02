"use client";

import React from "react";
import IntentPanel from "./IntentPanel";
import type { SubtypeGuidance } from '@/app/lib/types/baseline';

interface QuestionHelpProps {
  questionId: string;
  disciplineSubtypeId?: string | null | undefined; // Gating: Reference Impl first, then Subtype Overview
  subtypeCode?: string | null | undefined; // For fallback to subtype doctrine
  subtypeGuidance?: SubtypeGuidance | null | undefined; // For fallback to subtype doctrine
}

/**
 * QuestionHelp Component
 *
 * Displays subtype-driven help: Reference Implementation first, then Subtype Overview.
 * discipline_subtype_id is the gating signal; legacy intent is not used.
 */
export default function QuestionHelp({
  disciplineSubtypeId,
  subtypeCode,
  subtypeGuidance,
}: QuestionHelpProps) {
  const hasContent = !!disciplineSubtypeId || !!subtypeGuidance;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="question-help-container" style={{ marginTop: "0.5rem" }}>
      <IntentPanel
        defaultOpen={false}
        disciplineSubtypeId={disciplineSubtypeId ?? null}
        subtypeCode={subtypeCode}
        subtypeGuidance={subtypeGuidance}
      />
    </div>
  );
}
