/**
 * Export validation for module generation output.
 * Export requires: >=8 questions OR SOURCE_EMPTY=true; each question has 1–4 OFCs unless NO_OFC_NEEDED=true (with reason).
 */

const MIN_QUESTIONS_FOR_EXPORT = 8;
const MIN_OFCS_PER_QUESTION = 1;
const MAX_OFCS_PER_QUESTION = 4;

export type ExportValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type ExportValidationResult = {
  valid: boolean;
  issues: ExportValidationIssue[];
};

export type QuestionExportShape = {
  question_code?: string;
  question_text?: string;
  discipline_code?: string;
  discipline_subtype_hint?: string;
  NO_OFC_NEEDED?: boolean;
  no_ofc_reason?: string;
};

export type QuestionWithOfcs = {
  question: QuestionExportShape;
  ofcs: Array<{ ofc_code?: string; ofc_text?: string }>;
};

/**
 * Validate that generated content is eligible for export.
 * - Requires >= MIN_QUESTIONS_FOR_EXPORT questions unless SOURCE_EMPTY is true.
 * - Each question must have 1–4 OFCs unless NO_OFC_NEEDED is true (with reason).
 */
export function validateModuleExport(
  payload: {
    questions: QuestionExportShape[];
    question_ofcs?: Record<string, Array<{ ofc_code?: string; ofc_text?: string }>>;
    SOURCE_EMPTY?: boolean;
  }
): ExportValidationResult {
  const issues: ExportValidationIssue[] = [];
  const { questions = [], question_ofcs = {}, SOURCE_EMPTY } = payload;

  if (SOURCE_EMPTY === true) {
    if (questions.length === 0) {
      return { valid: true, issues: [] };
    }
    // SOURCE_EMPTY but we have questions: still validate per-question OFC rules
  } else {
    if (questions.length < MIN_QUESTIONS_FOR_EXPORT) {
      issues.push({
        code: 'INSUFFICIENT_QUESTIONS',
        message: `Export requires at least ${MIN_QUESTIONS_FOR_EXPORT} questions or SOURCE_EMPTY=true. Got ${questions.length} questions.`,
        field: 'questions',
      });
    }
  }

  for (const q of questions) {
    const qcode = (q.question_code || '').trim() || 'unknown';
    const ofcs = question_ofcs[qcode] || [];
    const ofcCount = ofcs.filter((o) => (o.ofc_text || '').trim()).length;
    const noOfcNeeded = q.NO_OFC_NEEDED === true;
    const noOfcReason = (q.no_ofc_reason || '').trim();

    if (noOfcNeeded) {
      if (noOfcReason.length < 5) {
        issues.push({
          code: 'NO_OFC_REASON_REQUIRED',
          message: `Question ${qcode} is marked NO_OFC_NEEDED but no_ofc_reason is missing or too short.`,
          field: `questions.${qcode}.no_ofc_reason`,
        });
      }
      continue;
    }

    if (ofcCount < MIN_OFCS_PER_QUESTION) {
      issues.push({
        code: 'MIN_OFCS_REQUIRED',
        message: `Question ${qcode} has ${ofcCount} OFCs; each question must have 1–4 OFCs unless NO_OFC_NEEDED=true.`,
        field: `question_ofcs.${qcode}`,
      });
    } else if (ofcCount > MAX_OFCS_PER_QUESTION) {
      issues.push({
        code: 'MAX_OFCS_EXCEEDED',
        message: `Question ${qcode} has ${ofcCount} OFCs; max ${MAX_OFCS_PER_QUESTION} per question.`,
        field: `question_ofcs.${qcode}`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
