export type PromoteCandidateToAssessmentArgs = {
  assessmentId: string;
  assessmentResponseId: string;
  candidateId: string;
};

export async function promoteCandidateToAssessment(args: PromoteCandidateToAssessmentArgs) {
  const { assessmentId, assessmentResponseId, candidateId } = args;

  const res = await fetch(`/api/runtime/assessments/${assessmentId}/ofcs/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      candidate_id: candidateId,
      assessment_response_id: assessmentResponseId,
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    // Make failures self-describing in the browser console
    console.error("[ASSESSMENT_PROMOTE_FAILED]", { status: res.status, body: raw });
    throw new Error(`Assessment promote failed ${res.status}: ${raw}`);
  }

  return raw ? JSON.parse(raw) : null;
}
