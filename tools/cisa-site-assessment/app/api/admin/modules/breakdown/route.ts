import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

interface ModuleBreakdown {
  module_code: string;
  module_name: string;
  description: string | null;
  question_codes: string[];
  questions: Array<{
    canon_id: string;
    question_text: string;
    discipline_code: string;
    subtype_code: string | null;
    order: number;
  }>;
  question_count: number;
}

/**
 * GET /api/admin/modules/breakdown
 * 
 * Returns a breakdown of modules with their associated questions.
 * Only includes active modules that have questions in the database.
 */
 
export async function GET(_request: NextRequest) {
  try {
    const pool = getRuntimePool();

    // Get all active modules with their questions
    const modulesResult = await pool.query(`
      SELECT 
        am.module_code,
        am.module_name,
        am.description,
        amq.question_canon_id,
        amq.question_order,
        bs.question_text,
        bs.discipline_code,
        bs.subtype_code
      FROM public.assessment_modules am
      LEFT JOIN public.assessment_module_questions amq ON am.module_code = amq.module_code
      LEFT JOIN public.baseline_spines_runtime bs ON amq.question_canon_id = bs.canon_id AND bs.active = true
      WHERE am.is_active = true
      ORDER BY am.module_code, amq.question_order
    `);

    // Group by module
    const modulesMap = new Map<string, ModuleBreakdown>();

    for (const row of modulesResult.rows) {
      if (!row.module_code) continue;

      if (!modulesMap.has(row.module_code)) {
        modulesMap.set(row.module_code, {
          module_code: row.module_code,
          module_name: row.module_name,
          description: row.description,
          question_codes: [],
          questions: [],
          question_count: 0
        });
      }

      const moduleRow = modulesMap.get(row.module_code)!;

      if (row.question_canon_id) {
        if (!moduleRow.question_codes.includes(row.question_canon_id)) {
          moduleRow.question_codes.push(row.question_canon_id);
        }

        moduleRow.questions.push({
          canon_id: row.question_canon_id,
          question_text: row.question_text,
          discipline_code: row.discipline_code,
          subtype_code: row.subtype_code,
          order: row.question_order
        });
      }
    }

    // Convert to array and filter out modules with no questions
    const breakdown = Array.from(modulesMap.values())
      .filter(m => m.questions.length > 0)
      .map(m => ({
        ...m,
        question_count: m.questions.length
      }))
      .sort((a, b) => a.module_code.localeCompare(b.module_code));

    return NextResponse.json({
      modules: breakdown,
      total_modules: breakdown.length,
      total_questions: breakdown.reduce((sum, m) => sum + m.question_count, 0)
    });

  } catch (error: unknown) {
    console.error('[API /api/admin/modules/breakdown] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get module breakdown',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

