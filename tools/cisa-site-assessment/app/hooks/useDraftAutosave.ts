"use client";

import { useEffect, useRef } from "react";
import { loadDraft, saveDraft, type DraftResponses } from "@/app/lib/draftStorage";

function mergeResponses(server: DraftResponses, local: DraftResponses): DraftResponses {
  // Local wins for overlapping canon_ids
  return { ...server, ...local };
}

export function useDraftAutosave(params: {
  assessmentId: string;
  responses: DraftResponses;
  setResponses: (next: DraftResponses) => void;
  serverResponses?: DraftResponses; // optional initial server state
}) {
  const { assessmentId, responses, setResponses, serverResponses } = params;

  const hydratedRef = useRef(false);

  // 1) Hydrate from local draft or server state ONCE.
  useEffect(() => {
    if (hydratedRef.current) return;

    const local = loadDraft(assessmentId)?.responses ?? null;
    const hasLocalResponses = Boolean(local && Object.keys(local).length > 0);

    if (hasLocalResponses && serverResponses) {
      setResponses(mergeResponses(serverResponses, local as DraftResponses));
    } else if (hasLocalResponses) {
      setResponses(local as DraftResponses);
    } else if (serverResponses) {
      setResponses(serverResponses);
    } else {
      // Wait until either server state or a non-empty local draft is available.
      return;
    }

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, serverResponses]);

  // 2) Persist every change immediately after hydration so refreshes keep answers.
  useEffect(() => {
    if (!hydratedRef.current) return;

    saveDraft(assessmentId, responses);
  }, [assessmentId, responses]);
}
