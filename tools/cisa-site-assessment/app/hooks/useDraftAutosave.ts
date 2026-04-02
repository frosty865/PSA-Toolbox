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

  // 1) Hydrate from local draft ONCE, then merge server if provided
  useEffect(() => {
    if (hydratedRef.current) return;

    const local = loadDraft(assessmentId)?.responses ?? null;

    if (local) {
      if (serverResponses) {
        setResponses(mergeResponses(serverResponses, local));
      } else {
        setResponses(local);
      }
    } else if (serverResponses) {
      setResponses(serverResponses);
    }

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // 2) Debounced autosave on changes
  const debounceMs = 350;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveDraft(assessmentId, responses);
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [assessmentId, responses]);
}
