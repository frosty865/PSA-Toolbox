/**
 * OFC Guardrails - Runtime enforcement of PSA OFC Doctrine V1
 * 
 * Hard fails illegal OFC attachment attempts.
 */

import { OFC_DOCTRINE, OfcOrigin, APPROVED_STATUSES, type OfcStatus } from "@/app/lib/doctrine/ofc_doctrine";

export type QuestionForLink = {
  canon_id: string;
  discipline_id?: string | null;
  discipline_subtype_id: string;
};

export type OfcForLink = {
  id: string;
  discipline_id?: string | null;
  discipline_subtype_id: string;
  origin: OfcOrigin;
  approved: boolean;
  status: OfcStatus;
};

/**
 * Assert that an OFC can be attached to a question.
 * Throws Error if doctrine is violated.
 */
export function assertOfcAttachable(q: QuestionForLink, ofc: OfcForLink): void {
  // 1) Must be approved for attachment
  if (OFC_DOCTRINE.REQUIRE_OFC_APPROVED_FOR_ATTACHMENT) {
    if (!ofc.approved || !APPROVED_STATUSES.includes(ofc.status)) {
      throw new Error(
        `OFC ${ofc.id} is not approved (status=${ofc.status}); attachment is forbidden by doctrine.`
      );
    }
  }

  // 2) Hard subtype isolation
  if (OFC_DOCTRINE.REQUIRE_SUBTYPE_MATCH) {
    if (!q.discipline_subtype_id || !ofc.discipline_subtype_id) {
      throw new Error(
        `Missing discipline_subtype_id: question=${q.discipline_subtype_id}, ofc=${ofc.discipline_subtype_id}. Cross-subtype attachment is forbidden.`
      );
    }
    if (q.discipline_subtype_id !== ofc.discipline_subtype_id) {
      throw new Error(
        `Cross-subtype OFC attachment is forbidden by doctrine. Question subtype: ${q.discipline_subtype_id}, OFC subtype: ${ofc.discipline_subtype_id}`
      );
    }
  }

  // 3) Discipline match when question has discipline_id
  if (OFC_DOCTRINE.REQUIRE_DISCIPLINE_MATCH_WHEN_PRESENT) {
    if (q.discipline_id && ofc.discipline_id && q.discipline_id !== ofc.discipline_id) {
      throw new Error(
        `Discipline mismatch; OFC attachment is forbidden by doctrine. Question discipline: ${q.discipline_id}, OFC discipline: ${ofc.discipline_id}`
      );
    }
  }
}

/**
 * Assert that an OFC matches the requested origin (CORPUS vs MODULE separation).
 */
export function assertPanelSeparation(requestedOrigin: OfcOrigin, ofc: OfcForLink): void {
  if (!OFC_DOCTRINE.STRICT_CORPUS_MODULE_SEPARATION) return;
  if (requestedOrigin !== ofc.origin) {
    throw new Error(
      `OFC origin mismatch; CORPUS/MODULE mixing is forbidden by doctrine. Requested: ${requestedOrigin}, OFC: ${ofc.origin}`
    );
  }
}
