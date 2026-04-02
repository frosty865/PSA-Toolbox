import crypto from 'crypto';

/**
 * Generate canonical OFC code
 * Format: OFC_V1_<DISCIPLINE_CODE>_<SUBTYPE_CODE>_<HASH8>
 * where HASH8 = first 8 chars of sha256(ofc_text)
 */
export function generateCanonicalCode(
  disciplineCode: string,
  subtypeCode: string,
  ofcText: string
): string {
  const hash = crypto.createHash('sha256').update(ofcText).digest('hex');
  const hash8 = hash.substring(0, 8).toUpperCase();
  return `OFC_V1_${disciplineCode}_${subtypeCode}_${hash8}`;
}

/**
 * Get security mode from system_settings
 * Returns: 'DISABLED' | 'ENGINEERING' | 'ENFORCED'
 */
export async function getSecurityMode(pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: { value?: string }[] }> }): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'SECURITY_MODE' LIMIT 1`
    );
    const rows = result.rows ?? [];
    if (rows.length > 0) {
      return rows[0].value ?? 'DISABLED';
    }
    // Default to DISABLED if not set
    return 'DISABLED';
  } catch (error) {
    console.error('[getSecurityMode] Error:', error);
    return 'DISABLED';
  }
}

/**
 * Check if role can perform decision action based on security mode
 */
export function canPerformDecision(
  securityMode: string,
  decidedRole: 'ENGINEER' | 'GOVERNANCE'
): boolean {
  switch (securityMode) {
    case 'DISABLED':
      // Allow all but log with security_mode
      return true;
    case 'ENGINEERING':
      // Only ENGINEER allowed
      return decidedRole === 'ENGINEER';
    case 'ENFORCED':
      // ENGINEER and GOVERNANCE allowed
      return decidedRole === 'ENGINEER' || decidedRole === 'GOVERNANCE';
    default:
      return false;
  }
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  pool: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  eventType: string,
  eventPayload: unknown,
  createdBy?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.audit_log (event_type, event_payload, created_by)
       VALUES ($1, $2, $3)`,
      [eventType, JSON.stringify(eventPayload), createdBy || null]
    );
  } catch (error) {
    console.error('[logAuditEvent] Error:', error);
    // Don't throw - audit logging should not break main flow
  }
}

