import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

type WizardQuestion = {
  criterion_key: string;
  question_text: string;
  discipline_subtype_id: string;
  asset_or_location?: string;
  event_trigger?: string;
  order_index: number;
};

type WizardOfc = {
  criterion_key: string;
  ofc_id: string;
  ofc_text: string;
  order_index: number;
};

/**
 * POST /api/admin/modules/wizard/publish
 *
 * Publishes wizard state: ensures module exists (ACTIVE), inserts module_questions
 * and module_ofcs from reviewed_content. Called from PublishStep after Review.
 * Body: { module_code: string, questions: WizardQuestion[], ofcs?: WizardOfc[] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { module_code, questions, ofcs } = body;
    if (!module_code || typeof module_code !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_MODULE_CODE', message: 'module_code is required' } },
        { status: 400 }
      );
    }
    const normalized = module_code.trim().toUpperCase();
    if (!/^MODULE_[A-Z0-9_]+$/.test(normalized)) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_MODULE_CODE', message: 'module_code must match MODULE_[A-Z0-9_]+' } },
        { status: 400 }
      );
    }

    const questionsList = Array.isArray(questions) ? questions : [];
    const ofcsList = Array.isArray(ofcs) ? ofcs : [];
    if (questionsList.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_QUESTIONS', message: 'At least one question is required' } },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Ensure module exists and set ACTIVE
    const mod = await pool.query(
      'SELECT module_code, status FROM public.assessment_modules WHERE module_code = $1',
      [normalized]
    );
    if (!mod.rowCount) {
      return NextResponse.json(
        { ok: false, error: { code: 'MODULE_NOT_FOUND', message: 'Module not found. Complete Define step first.' } },
        { status: 404 }
      );
    }
    await pool.query(
      `UPDATE public.assessment_modules SET status = 'ACTIVE', updated_at = now() WHERE module_code = $1`,
      [normalized]
    );

    // Resolve discipline_id for each question from discipline_subtype_id
    const subtypeIds = [...new Set(questionsList.map((q: WizardQuestion) => q.discipline_subtype_id).filter(Boolean))];
    const subtypeRows =
      subtypeIds.length > 0
        ? await pool.query(
            'SELECT id, discipline_id FROM public.discipline_subtypes WHERE id = ANY($1::uuid[])',
            [subtypeIds]
          )
        : { rows: [] };
    const subtypeToDiscipline: Record<string, string> = {};
    for (const r of subtypeRows.rows as { id: string; discipline_id: string }[]) {
      subtypeToDiscipline[r.id] = r.discipline_id;
    }

    const suffix = normalized.replace(/^MODULE_/, '');
    let seq = 1;
    const existingQ = await pool.query(
      'SELECT module_question_id FROM public.module_questions WHERE module_code = $1 ORDER BY module_question_id DESC LIMIT 1',
      [normalized]
    );
    if (existingQ.rows?.length) {
      const m = (existingQ.rows[0].module_question_id as string).match(/_(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }

    const orderRes = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM public.module_questions WHERE module_code = $1',
      [normalized]
    );
    let orderIndex = parseInt(String(orderRes.rows[0]?.next_idx ?? 0), 10);

    const EVENT_TRIGGERS = ['FIRE', 'TAMPERING', 'IMPACT', 'OUTAGE', 'OTHER'] as const;
    const insertQ =
      `INSERT INTO public.module_questions (module_code, module_question_id, question_text, discipline_id, discipline_subtype_id, asset_or_location, event_trigger, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

    for (const q of questionsList as WizardQuestion[]) {
      const discipline_id = subtypeToDiscipline[q.discipline_subtype_id];
      if (!discipline_id) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'INVALID_DISCIPLINE_SUBTYPE',
              message: `discipline_subtype_id not found for criterion ${q.criterion_key}`,
            },
          },
          { status: 400 }
        );
      }
      const mqId = `MODULEQ_${suffix}_${String(seq).padStart(3, '0')}`;
      const asset = (q.asset_or_location && typeof q.asset_or_location === 'string') ? q.asset_or_location.trim() : 'General';
      const et =
        q.event_trigger && EVENT_TRIGGERS.includes(q.event_trigger.toUpperCase() as (typeof EVENT_TRIGGERS)[number])
          ? q.event_trigger.toUpperCase()
          : 'OTHER';
      await pool.query(insertQ, [
        normalized,
        mqId,
        (q.question_text || '').trim(),
        discipline_id,
        q.discipline_subtype_id,
        asset,
        et,
        orderIndex,
      ]);
      seq++;
      orderIndex++;
    }

    // Insert module OFCs (freeform ofc_text from wizard)
    let ofcsInserted = 0;
    if (ofcsList.length > 0) {
      const questionByCriterion = new Map(questionsList.map((q: WizardQuestion) => [q.criterion_key, q]));
      let ofcSeq = 1;
      const existingOfc = await pool.query(
        'SELECT ofc_id FROM public.module_ofcs WHERE module_code = $1 ORDER BY ofc_id DESC LIMIT 1',
        [normalized]
      );
      if (existingOfc.rows?.length) {
        const m = (existingOfc.rows[0].ofc_id as string).match(/_(\d+)$/);
        if (m) ofcSeq = parseInt(m[1], 10) + 1;
      }
      const orderResOfc = await pool.query(
        'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM public.module_ofcs WHERE module_code = $1',
        [normalized]
      );
      let ofcOrderIndex = parseInt(String(orderResOfc.rows[0]?.next_idx ?? 0), 10);

      for (const o of ofcsList as WizardOfc[]) {
        const q = questionByCriterion.get(o.criterion_key);
        const discipline_subtype_id = q?.discipline_subtype_id ?? null;
        const ofcId = (o.ofc_id && String(o.ofc_id).trim()) || `MOD_OFC_${suffix}_${String(ofcSeq).padStart(3, '0')}`;
        const ofcText = (o.ofc_text && String(o.ofc_text).trim()) || '';
        if (!ofcText) continue;
        try {
          await pool.query(
            `INSERT INTO public.module_ofcs (module_code, ofc_id, ofc_text, order_index, discipline_subtype_id) VALUES ($1, $2, $3, $4, $5)`,
            [normalized, ofcId, ofcText, ofcOrderIndex, discipline_subtype_id]
          );
          ofcsInserted++;
        } catch (e: unknown) {
          console.warn('[wizard/publish] Skip OFC insert (table may use different schema):', (e as Error)?.message);
        }
        ofcSeq++;
        ofcOrderIndex++;
      }
    }

    return NextResponse.json({
      ok: true,
      module_code: normalized,
      questions_published: questionsList.length,
      ofcs_published: ofcsInserted,
    });
  } catch (error: unknown) {
    console.error('[API /api/admin/modules/wizard/publish] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to publish module',
          details: msg,
        },
      },
      { status: 500 }
    );
  }
}

