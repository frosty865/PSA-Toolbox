import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[id]/technology-profiles
 * 
 * Returns technology profile selections for an assessment.
 * Hard guard: Rejects any confidence-related fields.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get assessment_instance_id for this assessment
    // First, get the facility_name from the assessment
    const assessmentResult = await pool.query(`
      SELECT facility_name
      FROM public.assessments
      WHERE id = $1
    `, [assessmentId]);

    if (assessmentResult.rows.length === 0) {
      return NextResponse.json({
        assessment_id: assessmentId,
        assessment_instance_id: null,
        selections: []
      }, { status: 200 });
    }

    const facilityName = assessmentResult.rows[0].facility_name;
    
    // Try multiple approaches to find the instance
    let instanceResult = await pool.query(`
      SELECT id FROM public.assessment_instances
      WHERE facility_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `, [facilityName]);

    // If not found by facility_name, try by id
    if (instanceResult.rows.length === 0) {
      instanceResult = await pool.query(`
        SELECT id FROM public.assessment_instances
        WHERE id = $1
        LIMIT 1
      `, [assessmentId]);
    }

    // If still not found, try to find by facility_id
    if (instanceResult.rows.length === 0) {
      const facilityResult = await pool.query(`
        SELECT id FROM public.facilities
        WHERE name = $1
        LIMIT 1
      `, [facilityName]);
      
      if (facilityResult.rows.length > 0) {
        const facilityId = facilityResult.rows[0].id;
        instanceResult = await pool.query(`
          SELECT id FROM public.assessment_instances
          WHERE facility_id = $1
          ORDER BY started_at DESC
          LIMIT 1
        `, [facilityId]);
      }
    }

    if (instanceResult.rows.length === 0) {
      return NextResponse.json({
        assessment_id: assessmentId,
        assessment_instance_id: null,
        selections: []
      }, { status: 200 });
    }

    const instanceId = instanceResult.rows[0].id;

    // Get technology profiles
    const profilesResult = await pool.query(`
      SELECT 
        atp.discipline_subtype_id,
        atp.technology_code,
        atp.notes
      FROM public.assessment_technology_profiles atp
      WHERE atp.assessment_instance_id = $1
      ORDER BY atp.discipline_subtype_id, atp.technology_code
    `, [instanceId]);

    // Group by subtype
    const selectionsBySubtype = new Map<string, Record<string, unknown>[]>();
    for (const row of profilesResult.rows) {
      const subtypeId = row.discipline_subtype_id;
      if (!selectionsBySubtype.has(subtypeId)) {
        selectionsBySubtype.set(subtypeId, []);
      }
      selectionsBySubtype.get(subtypeId)!.push({
        discipline_subtype_id: subtypeId,
        technology_code: row.technology_code,
        notes: row.notes
      });
    }

    const selections = Array.from(selectionsBySubtype.values()).flat();

    return NextResponse.json({
      assessment_id: assessmentId,
      assessment_instance_id: instanceId,
      selections
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/technology-profiles GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch technology profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/runtime/assessments/[id]/technology-profiles
 * 
 * Updates technology profile selections for a subtype.
 * Hard guard: Rejects any confidence-related fields.
 * 
 * Body:
 * {
 *   discipline_subtype_id: string,
 *   technology_codes: string[],
 *   notes?: string
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await request.json();

    // Hard guard: Reject confidence fields
    if (body.confidence || body.observed || body.verified || body.reported) {
      return NextResponse.json(
        { error: 'Confidence fields (observed/verified/reported) are not allowed in the assessment model' },
        { status: 400 }
      );
    }

    const { discipline_subtype_id, technology_codes, notes } = body;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    if (!discipline_subtype_id) {
      return NextResponse.json(
        { error: 'discipline_subtype_id is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(technology_codes)) {
      return NextResponse.json(
        { error: 'technology_codes must be an array' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Verify subtype exists
    const subtypeCheck = await pool.query(`
      SELECT id FROM public.discipline_subtypes WHERE id = $1
    `, [discipline_subtype_id]);

    if (subtypeCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Discipline subtype not found' },
        { status: 404 }
      );
    }

    // Get assessment_instance_id
    // First, try to find instance by looking up the facility_id from the assessment
    // assessment_instances.facility_id is TEXT (from facilities.id), not UUID
    // We need to find the facility_id associated with this assessment
    const assessmentResult = await pool.query(`
      SELECT facility_name
      FROM public.assessments
      WHERE id = $1
    `, [assessmentId]);

    if (assessmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Try multiple approaches to find the instance:
    // 1. Look for instance where facility_id matches a facility with the same name
    // 2. Look for instance where id matches assessmentId (if instance_id was stored as assessment_id)
    // 3. Look for instance where facility_name matches assessment.facility_name
    const facilityName = assessmentResult.rows[0].facility_name;
    
    let instanceResult = await pool.query(`
      SELECT id FROM public.assessment_instances
      WHERE facility_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `, [facilityName]);

    // If not found by facility_name, try by id (in case instance_id equals assessment_id)
    if (instanceResult.rows.length === 0) {
      instanceResult = await pool.query(`
        SELECT id FROM public.assessment_instances
        WHERE id = $1
        LIMIT 1
      `, [assessmentId]);
    }

    // If still not found, try to find by facility_id if we can resolve it
    if (instanceResult.rows.length === 0) {
      // Try to find facility by name and then find instance
      const facilityResult = await pool.query(`
        SELECT id FROM public.facilities
        WHERE name = $1
        LIMIT 1
      `, [facilityName]);
      
      if (facilityResult.rows.length > 0) {
        const facilityId = facilityResult.rows[0].id;
        instanceResult = await pool.query(`
          SELECT id FROM public.assessment_instances
          WHERE facility_id = $1
          ORDER BY started_at DESC
          LIMIT 1
        `, [facilityId]);
      }
    }

    if (instanceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment instance not found. Please ensure the assessment has been properly created with an instance.' },
        { status: 404 }
      );
    }

    const instanceId = instanceResult.rows[0].id;

    // Transaction: delete existing, insert new
    await pool.query('BEGIN');

    try {
      // Delete existing selections for this subtype
      await pool.query(`
        DELETE FROM public.assessment_technology_profiles
        WHERE assessment_instance_id = $1
        AND discipline_subtype_id = $2
      `, [instanceId, discipline_subtype_id]);

      // Insert new selections
      for (const techCode of technology_codes) {
        if (techCode && techCode.trim()) {
          await pool.query(`
            INSERT INTO public.assessment_technology_profiles (
              assessment_instance_id,
              discipline_subtype_id,
              technology_code,
              notes
            ) VALUES ($1, $2, $3, $4)
          `, [instanceId, discipline_subtype_id, techCode.trim(), notes || null]);
        }
      }

      await pool.query('COMMIT');

      // Return updated selections for this subtype
      const updatedResult = await pool.query(`
        SELECT 
          technology_code,
          notes
        FROM public.assessment_technology_profiles
        WHERE assessment_instance_id = $1
        AND discipline_subtype_id = $2
        ORDER BY technology_code
      `, [instanceId, discipline_subtype_id]);

      return NextResponse.json({
        success: true,
        discipline_subtype_id,
        selections: updatedResult.rows.map((r: Record<string, unknown>) => ({
          technology_code: r.technology_code,
          notes: r.notes
        }))
      }, { status: 200 });

    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/technology-profiles PUT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save technology profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

