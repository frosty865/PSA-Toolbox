import type { PoolClient } from "pg";

/** Ignore missing table (42P01) so deletes work across schema variants */
export async function execIgnoreUndefinedTable(
  client: PoolClient,
  sql: string,
  params: unknown[]
): Promise<void> {
  try {
    await client.query(sql, params);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "42P01") return;
    throw e;
  }
}

/**
 * Delete one or more assessments and dependent runtime rows (FK-safe order).
 * Mirrors DELETE /api/runtime/assessments/[assessmentId] — use for bulk purge of test assessments.
 */
export async function deleteAssessmentsCascade(client: PoolClient, assessmentIds: string[]): Promise<void> {
  if (assessmentIds.length === 0) return;

  const assessmentResult = await client.query<{ id: string; facility_name: string | null }>(
    `
    SELECT id, facility_name
    FROM public.assessments
    WHERE id::text = ANY($1::text[])
    `,
    [assessmentIds]
  );
  const assessmentNames = assessmentResult.rows
    .map((r) => (r.facility_name ?? "").trim())
    .filter((name) => name.length > 0);

  const instanceResult = await client.query(
    `
    SELECT id::text AS id
    FROM public.assessment_instances
    WHERE id::text = ANY($1::text[])
       OR facility_name = ANY($2::text[])
       OR facility_id::text = ANY($3::text[])
    `,
    [
      assessmentIds,
      assessmentNames.length > 0 ? assessmentNames : [''],
      assessmentNames.length > 0 ? assessmentNames : [''],
    ]
  );
  const instanceIds = instanceResult.rows.map((r: { id: string }) => r.id);

  await client.query("BEGIN");

  try {
    if (instanceIds.length > 0) {
      await execIgnoreUndefinedTable(
        client,
        `DELETE FROM public.assessment_technology_profiles WHERE assessment_instance_id::text = ANY($1::text[])`,
        [instanceIds]
      );
      await execIgnoreUndefinedTable(
        client,
        `DELETE FROM public.assessment_responses WHERE assessment_instance_id::text = ANY($1::text[])`,
        [instanceIds]
      );
    }

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_question_responses WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_expansion_responses WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_expansion_profiles WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_question_universe WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_required_elements WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_status WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_definitions WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.ofc_nominations WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_followup_responses WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_module_question_responses WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_module_instances WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_applied_ofcs WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );
    await execIgnoreUndefinedTable(
      client,
      `DELETE FROM public.assessment_applied_vulnerabilities WHERE assessment_id::text = ANY($1::text[])`,
      [assessmentIds]
    );

    if (instanceIds.length > 0) {
      await client.query(`DELETE FROM public.assessment_instances WHERE id::text = ANY($1::text[])`, [instanceIds]);
    }

    await client.query(`DELETE FROM public.assessments WHERE id::text = ANY($1::text[])`, [assessmentIds]);

    await client.query("COMMIT");
  } catch (inner: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw inner;
  }
}
