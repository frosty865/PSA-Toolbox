import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseAssessment } from 'schema';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';

/**
 * VOFC generation must use source assessment truth. No coercive data mutation.
 * Validation issues are surfaced to the caller via parseAssessment errors.
 */
function sanitizeAssessmentForVofcParse(raw: unknown): unknown {
  return raw;
}

/** When PRA/SLA disabled, strip agreements from categories so schema validation skips SLA/PRA fields. */
function stripAgreementsIfDisabled(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const enabled = (obj.settings && typeof obj.settings === 'object')
    ? (obj.settings as Record<string, unknown>).pra_sla_enabled
    : undefined;
  const praSlaDisabled = enabled === false || enabled === 'false';
  if (praSlaDisabled) {
    const cats = obj.categories;
    if (cats != null && typeof cats === 'object' && !Array.isArray(cats)) {
      const entries = Object.entries(cats as Record<string, unknown>).map(([k, v]) => {
        const vObj = v != null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
        return [k, { ...vObj, agreements: undefined }];
      });
      return { ...obj, categories: Object.fromEntries(entries) };
    }
  }
  return raw;
}

/** When cross-dependency disabled, strip cross_dependencies so VOFC generation skips cascading-risk triggers. */
function stripCrossDependenciesIfDisabled(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const enabled = (obj.settings && typeof obj.settings === 'object')
    ? (obj.settings as Record<string, unknown>).cross_dependency_enabled
    : undefined;
  if (enabled === false || enabled === 'false') {
    return { ...obj, cross_dependencies: undefined };
  }
  return raw;
}

function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `srv-${Date.now()}`);
}

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function safeStackTop(stack?: string): string[] {
  if (!stack) return [];
  return stack.split('\n').slice(0, 12);
}

type ErrorPayload = {
  ok: false;
  code: string;
  message: string;
  request_id: string;
  details?: Record<string, unknown>;
  failure_reason?: string;
  debug?: { err: string; stack_top: string[] };
};

function errorResponse(
  code: string,
  message: string,
  status: number,
  requestId: string,
  details?: Record<string, unknown>,
  failureReason?: string,
  debug?: { err: string; stack_top: string[] }
): NextResponse {
  const payload: ErrorPayload = { ok: false, code, message, request_id: requestId };
  if (details != null && Object.keys(details).length > 0) payload.details = details;
  if (failureReason != null) payload.failure_reason = failureReason;
  if (debug != null && isDev()) payload.debug = debug;
  return NextResponse.json(payload, { status });
}

/**
 * POST /api/vofc/generate — Server-side VOFC generation from in-app derived findings.
 * No dependency on legacy VOFC workbook/library files.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const body = await request.json().catch(() => null);
    if (body == null || (body.assessment == null && Object.keys(body).length === 0)) {
      return errorResponse(
        'MISSING_INPUT',
        'Missing assessment. Send JSON body with an assessment object.',
        400,
        requestId
      );
    }

    let rawAssessment = body.assessment ?? body;
    rawAssessment = stripAgreementsIfDisabled(rawAssessment);
    rawAssessment = stripCrossDependenciesIfDisabled(rawAssessment);
    rawAssessment = sanitizeAssessmentForVofcParse(rawAssessment);
    let assessment;
    try {
      assessment = parseAssessment(rawAssessment);
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error('[vofc/generate] parse failed', { requestId, err: errMsg });
      const details: Record<string, unknown> = {};
      if (parseErr instanceof z.ZodError) {
        details.issues = parseErr.issues?.map((i) => ({ path: i.path, message: i.message })) ?? [];
      }
      return errorResponse(
        'INVALID_ASSESSMENT',
        'Assessment validation failed.',
        400,
        requestId,
        Object.keys(details).length > 0 ? details : undefined,
        errMsg,
        isDev()
          ? { err: errMsg, stack_top: safeStackTop(parseErr instanceof Error ? parseErr.stack : undefined) }
          : undefined
      );
    }

    const collection = buildVofcCollectionFromAssessment(assessment);
    return NextResponse.json({ ...collection, request_id: requestId });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;

    console.error('[vofc/generate] failed', { requestId, err: raw, stack });

    const isParseOrLibrary =
      raw.includes('parse') ||
      raw.includes('sheet') ||
      raw.includes('row') ||
      raw.includes('vofc_id') ||
      raw.includes('duplicate');

    const details: Record<string, unknown> = {};
    if (e instanceof Error && e.stack) details.stack = stack;
    if (typeof (e as { sheet?: string })?.sheet === 'string') details.sheet = (e as { sheet: string }).sheet;
    if (typeof (e as { row?: number })?.row === 'number') details.row = (e as { row: number }).row;

    const debug = isDev() ? { err: raw, stack_top: safeStackTop(stack) } : undefined;

    if (isParseOrLibrary) {
      const message = raw.split('\n')[0]?.trim() || 'VOFC generation failed.';
      return errorResponse('VOFC_GENERATE_FAILED', message, 400, requestId, details, raw, undefined);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'VOFC generation failed.',
      500,
      requestId,
      undefined,
      raw,
      debug
    );
  }
}
