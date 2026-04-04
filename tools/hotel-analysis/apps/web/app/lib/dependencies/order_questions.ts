import { CURVE_ORDER, CURVE_ID_ALIASES, MAIN_ORDER, type InfrastructureCategoryId } from './canonical_question_order';

type QuestionLike = {
  id: string;
  feedsCurve?: boolean;
  feeds_curve?: boolean;
  feedsChart?: boolean;
  showsCurveBadge?: boolean;
  affectsCurveMath?: boolean;
  [key: string]: unknown;
};

type OrderedQuestions<T extends QuestionLike> = {
  curve: T[];
  main: T[];
};

const CURVE_ID_SET = new Set<string>([
  ...CURVE_ORDER,
  ...Object.keys(CURVE_ID_ALIASES),
]);

const CURVE_FLAG_KEYS = ['feedsCurve', 'feeds_curve', 'feedsChart', 'showsCurveBadge', 'affectsCurveMath'];

/**
 * Check if a question has any curve-related flag.
 */
function hasCurveFlag(question: QuestionLike): boolean {
  return CURVE_FLAG_KEYS.some((key) => question[key] === true);
}

/**
 * Invariant: If a question is flagged as curve-related, its ID must start with "curve_".
 */
function assertCurveFlags(question: QuestionLike): void {
  if (typeof question.id !== 'string' || question.id.length === 0) {
    throw new Error('Question id is required');
  }

  const flagged = hasCurveFlag(question);
  if (flagged && !question.id.startsWith('curve_')) {
    throw new Error(
      `Non-curve question flagged as curve participant: ${question.id}. ` +
      `Only questions with id starting with "curve_" can have curve flags.`
    );
  }

  if (question.id.startsWith('curve_') && !CURVE_ID_SET.has(question.id)) {
    throw new Error(
      `Unknown curve question id "${question.id}". ` +
      `Must be one of: ${Array.from(CURVE_ID_SET).join(', ')}`
    );
  }
}

/**
 * Main ordering function.
 * Separates curve and main questions, sorts each by canonical order,
 * and enforces all invariants.
 */
export function orderQuestions<T extends QuestionLike>(
  infraId: InfrastructureCategoryId,
  questions: readonly T[]
): OrderedQuestions<T> {
  // Check for duplicates
  const seenIds = new Set<string>();
  questions.forEach((question) => {
    const { id } = question;
    if (seenIds.has(id)) {
      throw new Error(`Duplicate question id detected for ${infraId}: ${id}`);
    }
    seenIds.add(id);
    assertCurveFlags(question);
  });

  const curveQuestions: T[] = [];
  const mainQuestions: Array<{ question: T; index: number }> = [];

  questions.forEach((question, index) => {
    if (question.id.startsWith('curve_') || CURVE_ID_SET.has(question.id)) {
      curveQuestions.push(question);
    } else {
      mainQuestions.push({ question, index });
    }
  });

  // Sort curve questions strictly by CURVE_ORDER (map alias ids to canonical for position)
  const toCanonical = (id: string): (typeof CURVE_ORDER)[number] =>
    (CURVE_ID_ALIASES as Record<string, (typeof CURVE_ORDER)[number]>)[id] ?? (id as (typeof CURVE_ORDER)[number]);
  const sortedCurve = curveQuestions.slice().sort((a, b) => {
    const aCanon = toCanonical(a.id);
    const bCanon = toCanonical(b.id);
    const aIndex = CURVE_ORDER.indexOf(aCanon);
    const bIndex = CURVE_ORDER.indexOf(bCanon);
    if (aIndex === -1 || bIndex === -1) {
      throw new Error(`Curve question id missing from CURVE_ORDER while ordering ${infraId}.`);
    }
    return aIndex - bIndex;
  });

  // Sort main questions by MAIN_ORDER if available, else preserve order
  const canonicalMainOrder = MAIN_ORDER[infraId];

  if (!canonicalMainOrder) {
    // No defined canonical order; preserve input order
    return { curve: sortedCurve, main: mainQuestions.map(({ question }) => question) };
  }

  const orderMap = new Map<string, number>();
  canonicalMainOrder.forEach((id, orderIndex) => {
    if (orderMap.has(id)) {
      throw new Error(`Duplicate id "${id}" declared in MAIN_ORDER for ${infraId}.`);
    }
    orderMap.set(id, orderIndex);
  });

  const sortedMain = mainQuestions
    .slice()
    .sort((a, b) => {
      const orderA = orderMap.has(a.question.id) ? orderMap.get(a.question.id)! : Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.has(b.question.id) ? orderMap.get(b.question.id)! : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      // Preserve input order for unknown ids
      return a.index - b.index;
    })
    .map(({ question }) => question);

  // Log warning for unknown id (in dev mode; ignore in prod)
  if (process.env.NODE_ENV === 'development') {
    const unknownIds: string[] = [];
    for (const { question } of mainQuestions) {
      if (!orderMap.has(question.id)) {
        unknownIds.push(question.id);
      }
    }
    if (unknownIds.length > 0) {
      console.warn(
        `Warning: MAIN_ORDER for ${infraId} does not include: ${unknownIds.join(', ')}. ` +
        `These will be sorted last in input order.`
      );
    }
  }

  return { curve: sortedCurve, main: sortedMain };
}

/**
 * Verify that all required curve questions are present and in correct order.
 * Used for CI/QA checks.
 */
export function verifyCurveIntegrity(
  infraId: InfrastructureCategoryId,
  questions: QuestionLike[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const result = orderQuestions(infraId, questions);
    const curveIds = result.curve.map((q) => q.id);

    // Check we have at least the core curve questions
    for (const requiredId of CURVE_ORDER) {
      if (!curveIds.includes(requiredId)) {
        errors.push(`Missing required curve question: ${requiredId}`);
      }
    }

    // Check order is correct
    for (let i = 0; i < CURVE_ORDER.length; i++) {
      const expected = CURVE_ORDER[i];
      const actual = curveIds[i];
      if (actual !== expected) {
        errors.push(`Curve position ${i}: expected ${expected}, got ${actual}`);
      }
    }

    // Check no curve questions in main section
    const mainIds = result.main.map((q) => q.id);
    for (const mainId of mainIds) {
      if (mainId.startsWith('curve_')) {
        errors.push(`Curve question ${mainId} should not be in main section`);
      }
    }

    // Check no non-curve questions have curve flags
    for (const mainQuestion of result.main) {
      if (hasCurveFlag(mainQuestion)) {
        errors.push(`Non-curve question ${mainQuestion.id} is flagged as curve participant`);
      }
    }
  } catch (err) {
    errors.push((err instanceof Error ? err.message : String(err)) || 'Unknown error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
