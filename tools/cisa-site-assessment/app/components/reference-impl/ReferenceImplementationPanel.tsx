"use client";

import React, { useEffect, useMemo, useState } from "react";

type BaselineClarification = {
  yes_means?: string;
  no_means?: string;
  na_applies_only_if?: string;
};
type BaselineSection = {
  question_text?: string;
  response_enum?: string[];
  clarification?: BaselineClarification;
};
type Section3Item = {
  question_text?: string;
  response_type?: string;
  response_enum?: string[];
};
type Section4Notes = {
  how_to_use_indicators_and_failures_after_capture?: string[];
  constraints?: string[];
};
type RefImplPayload = {
  section_1_baseline_existence_question?: BaselineSection;
  section_2_right_looks_like_authoritative?: string[];
  section_3_descriptive_branching_yes_only?: Section3Item[];
  section_4_ofc_trigger_notes_non_user_facing?: Section4Notes;
};
type RefImplResponse =
  | { ok: true; found: false }
  | { ok: true; found: true; payload: RefImplPayload }
  | { ok: false; error: string };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-semibold text-gray-900 mb-2">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function CodeBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-sm text-gray-900">
      {children}
    </div>
  );
}

export default function ReferenceImplementationPanel({
  disciplineSubtypeId,
}: {
  disciplineSubtypeId: string | null | undefined;
}) {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<RefImplResponse | null>(null);

  const enabled = useMemo(() => Boolean(disciplineSubtypeId), [disciplineSubtypeId]);

  useEffect(() => {
    if (!enabled) {
      setResp(null);
      return;
    }

    const id = String(disciplineSubtypeId);
    let cancelled = false;

    (async () => {
      setLoading(true);
      setResp(null);

      try {
        const r = await fetch(`/api/reference/reference-impl?discipline_subtype_id=${encodeURIComponent(id)}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });

        const j = (await r.json()) as RefImplResponse;

        if (!cancelled) {
          setResp(j);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Request failed";
          setResp({ ok: false, error: msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, disciplineSubtypeId]);

  if (!enabled) {
    return (
      <div className="text-sm text-gray-600">
        No discipline subtype is associated with this question.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-gray-600">Loading reference implementation…</div>;
  }

  if (!resp) {
    return null;
  }

  if (resp.ok === false) {
    return (
      <div className="text-sm text-red-700">
        Failed to load reference implementation: {resp.error}
      </div>
    );
  }

  if (resp.ok === true && resp.found === false) {
    return (
      <div className="text-sm text-gray-600">
        No reference implementation exists for this subtype yet.
      </div>
    );
  }

  const payload = (resp as { payload?: RefImplPayload }).payload || {};
  const s1: BaselineSection = payload.section_1_baseline_existence_question ?? {};
  const s2: string[] = payload.section_2_right_looks_like_authoritative ?? [];
  const s3: Section3Item[] = payload.section_3_descriptive_branching_yes_only ?? [];
  const s4: Section4Notes = payload.section_4_ofc_trigger_notes_non_user_facing ?? {};

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Baseline Existence Question</SectionTitle>
        <CodeBox>
          <div className="font-medium">{s1.question_text || "—"}</div>
          <div className="mt-2 text-gray-700">
            <div className="font-semibold text-xs uppercase tracking-wide text-gray-500">Response Enum</div>
            <div className="mt-1">{Array.isArray(s1.response_enum) ? s1.response_enum.join(" / ") : "—"}</div>
          </div>
          {s1.clarification ? (
            <div className="mt-3 text-gray-700 space-y-1">
              {s1.clarification.yes_means ? <div><span className="font-semibold">YES:</span> {s1.clarification.yes_means}</div> : null}
              {s1.clarification.no_means ? <div><span className="font-semibold">NO:</span> {s1.clarification.no_means}</div> : null}
              {s1.clarification.na_applies_only_if ? <div><span className="font-semibold">N/A:</span> {s1.clarification.na_applies_only_if}</div> : null}
            </div>
          ) : null}
        </CodeBox>
      </div>

      <div>
        <SectionTitle>What &quot;Right&quot; Looks Like</SectionTitle>
        {s2.length ? <BulletList items={s2} /> : <div className="text-sm text-gray-600">—</div>}
      </div>

      <div>
        <SectionTitle>Descriptive Branching (YES only)</SectionTitle>
        {s3.length ? (
          <div className="space-y-3">
            {s3.map((q, idx) => (
              <div key={idx} className="rounded-xl border bg-white p-3">
                <div className="text-sm font-medium text-gray-900">{q.question_text || "—"}</div>
                <div className="mt-1 text-xs text-gray-600">
                  Type: {q.response_type || "TEXT"}
                  {Array.isArray(q.response_enum) && q.response_enum.length ? ` • Enum: ${q.response_enum.join(", ")}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600">—</div>
        )}
      </div>

      <div>
        <SectionTitle>OFC Trigger Notes (non-user-facing)</SectionTitle>
        <div className="text-sm text-gray-800 space-y-2">
          {Array.isArray(s4.how_to_use_indicators_and_failures_after_capture) ? (
            <BulletList items={s4.how_to_use_indicators_and_failures_after_capture} />
          ) : (
            <div className="text-gray-600">—</div>
          )}
          {Array.isArray(s4.constraints) && s4.constraints.length ? (
            <div className="mt-3">
              <div className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-1">Constraints</div>
              <BulletList items={s4.constraints} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
