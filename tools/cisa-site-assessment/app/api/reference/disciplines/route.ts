import { NextResponse } from 'next/server';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

type DisciplineRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: string | null;
  is_active: boolean | null;
};

type DisciplineSubtypeRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discipline_id: string;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type DisciplineResponse = DisciplineRow & {
  discipline_subtypes: DisciplineSubtypeRow[];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    const pool = await ensureRuntimePoolConnected();

    let disciplinesQuery = `
      SELECT 
        id,
        name,
        code,
        description,
        category,
        is_active,
        created_at,
        updated_at
      FROM disciplines
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (active !== null) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(active === 'true');
      paramIndex++;
    }

    if (conditions.length > 0) {
      disciplinesQuery += ` AND ${conditions.join(' AND ')}`;
    }

    disciplinesQuery += ` ORDER BY category, name`;

    const disciplinesResult = await pool.query<DisciplineRow>(disciplinesQuery, params);
    const disciplinesData = disciplinesResult.rows || [];

    let subtypesData: DisciplineSubtypeRow[] = [];
    try {
      const tableExistsResult = await pool.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'discipline_subtypes'
        ) as exists
      `);
      const tableExists = tableExistsResult.rows[0]?.exists || false;

      if (tableExists) {
        const subtypesQuery = `
          SELECT 
            id,
            name,
            code,
            description,
            discipline_id,
            is_active,
            created_at,
            updated_at
          FROM discipline_subtypes
          WHERE is_active = true
          ORDER BY name
        `;

        const subtypesResult = await pool.query<DisciplineSubtypeRow>(subtypesQuery);
        subtypesData = subtypesResult.rows || [];
      } else {
        console.warn('[API /api/reference/disciplines] discipline_subtypes table does not exist, returning disciplines without subtypes');
      }
    } catch (subtypesError: unknown) {
      const err = subtypesError && typeof subtypesError === 'object' ? (subtypesError as { code?: string; message?: string }) : {};
      const errCode = err.code ?? '';
      const errMessage = err.message ?? '';
      if (errCode === '42P01' || errMessage.includes('does not exist')) {
        console.warn('[API /api/reference/disciplines] discipline_subtypes table does not exist, returning disciplines without subtypes');
        subtypesData = [];
      } else {
        console.error('[API /api/reference/disciplines] Error fetching subtypes:', subtypesError);
        subtypesData = [];
      }
    }

    const subtypesByDiscipline: Record<string, DisciplineSubtypeRow[]> = {};
    subtypesData.forEach((subtype) => {
      const discId = subtype.discipline_id;
      if (!discId) {
        console.warn(`[API /api/reference/disciplines] Subtype ${subtype.id} has no discipline_id`);
        return;
      }
      if (!subtypesByDiscipline[discId]) {
        subtypesByDiscipline[discId] = [];
      }
      subtypesByDiscipline[discId].push(subtype);
    });

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueDisciplines = disciplinesData.filter((discipline) => {
      const disciplineId = discipline.id;
      if (disciplineId && seenIds.has(disciplineId)) {
        console.warn(`Duplicate discipline ID found: ${discipline.name} (ID: ${discipline.id})`);
        return false;
      }
      if (disciplineId) {
        seenIds.add(disciplineId);
      }

      const name = (discipline.name || '').trim().toLowerCase();
      if (name && seenNames.has(name)) {
        console.warn(`Duplicate discipline name found: ${discipline.name} (ID: ${discipline.id})`);
        return false;
      }
      if (name) {
        seenNames.add(name);
      }

      return true;
    });

    const normalizedDisciplines: DisciplineResponse[] = uniqueDisciplines.map((discipline) => {
      const discId = discipline.id;
      return {
        ...discipline,
        discipline_subtypes: subtypesByDiscipline[discId] || [],
      };
    });

    return NextResponse.json({
      success: true,
      disciplines: normalizedDisciplines,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[API /api/reference/disciplines] Error:', {
      message: errorMessage,
      code: errorCode,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Database service unavailable',
        message: errorMessage,
        code: errorCode || undefined,
        disciplines: [],
        hint:
          errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND'
            ? 'Database connection failed. Check RUNTIME_DATABASE_URL and verify the runtime database is reachable.'
            : undefined,
      },
      { status: 503 }
    );
  }
}
