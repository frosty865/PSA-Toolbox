/**
 * Runtime Module Reconciliation
 * 
 * Automatically attaches modules to assessments based on subsector policy.
 * - DEFAULT_ON: Auto-attached but can be removed
 * - REQUIRED: Auto-attached and locked (cannot be removed)
 * 
 * Does NOT remove user-selected modules. Only adds/updates subsector-driven modules.
 */

import { getRuntimePool } from '@/app/lib/db/runtime_client';

export type ReconcileResult = {
  assessmentId: string;
  subsectorId: string | null;
  attached: number;
  updated: number;
};

/**
 * Reconcile modules for an assessment based on subsector policy.
 * 
 * @param params - Assessment ID and subsector ID
 * @returns Reconciliation result with counts
 */
export async function reconcileModulesForAssessment(params: {
  assessmentId: string;
  subsectorId: string | null;
}): Promise<ReconcileResult> {
  const { assessmentId, subsectorId } = params;
  const pool = getRuntimePool();

  // No subsector => nothing to auto-attach. We also do NOT auto-remove anything.
  if (!subsectorId) {
    return { assessmentId, subsectorId: null, attached: 0, updated: 0 };
  }

  // Pull policy rows for this subsector
  const policyResult = await pool.query(
    `
    SELECT module_code, attach_mode
    FROM public.subsector_module_policy
    WHERE subsector_id = $1
    `,
    [subsectorId]
  );

  let attached = 0;
  let updated = 0;

  for (const row of policyResult.rows as Array<{ module_code: string; attach_mode: 'DEFAULT_ON' | 'REQUIRED' }>) {
    const attached_via =
      row.attach_mode === 'REQUIRED' ? 'SUBSECTOR_REQUIRED' : 'SUBSECTOR_DEFAULT';
    const is_locked = row.attach_mode === 'REQUIRED';

    // Check if instance already exists
    const existingCheck = await pool.query(
      `SELECT module_code FROM public.assessment_module_instances 
       WHERE assessment_id = $1 AND module_code = $2`,
      [assessmentId, row.module_code]
    );

    const exists = existingCheck.rows.length > 0;

    // Upsert instance: always force ACTIVE for subsector-derived policies.
    await pool.query(
      `
      INSERT INTO public.assessment_module_instances
        (assessment_id, module_code, is_locked, attached_via, enabled_at)
      VALUES
        ($1, $2, $3, $4, NOW())
      ON CONFLICT (assessment_id, module_code)
      DO UPDATE SET
        is_locked = EXCLUDED.is_locked,
        attached_via = EXCLUDED.attached_via,
        enabled_at = CASE 
          WHEN assessment_module_instances.attached_via IN ('SUBSECTOR_DEFAULT', 'SUBSECTOR_REQUIRED') 
          THEN assessment_module_instances.enabled_at 
          ELSE EXCLUDED.enabled_at 
        END
      `,
      [assessmentId, row.module_code, is_locked, attached_via]
    );

    if (exists) {
      updated += 1;
    } else {
      attached += 1;
    }
  }

  return { assessmentId, subsectorId, attached, updated };
}
