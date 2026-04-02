/**
 * Assessment Response Writer Hook
 * 
 * Provides a reusable function to write assessment responses.
 * Uses the same API endpoint as the existing assessment UI.
 */

/**
 * Write an assessment response
 * 
 * @param assessmentId - Assessment ID
 * @param canonId - Question canon ID
 * @param value - Response value ("YES", "NO", or "N_A")
 */
export async function writeResponse(
  assessmentId: string,
  canonId: string,
  value: "YES" | "NO" | "N_A"
): Promise<void> {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}/responses`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{
        question_canon_id: canonId,
        question_template_id: canonId, // Legacy field for backward compatibility
        response_enum: value,
      }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save response: ${response.status}`);
  }
}
