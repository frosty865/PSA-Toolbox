"use client";

import { useEffect, useState } from "react";

interface TemplateScope {
  hazards: string[];
  areas: string[];
  exclusions: string[];
}

interface QuestionFamily {
  family_code: string;
  title: string;
  intent: string;
  question_prompts: string[];
}

interface OfcTemplateItem {
  ofc_code: string;
  text_template: string;
}

interface TemplateData {
  ok: boolean;
  template: {
    title: string;
    summary: string;
    scope: TemplateScope;
    question_families: QuestionFamily[];
    ofc_template_bank: OfcTemplateItem[];
  };
}

export default function TemplatePanel({ moduleCode }: { moduleCode: string }) {
  const [data, setData] = useState<TemplateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/modules/${encodeURIComponent(moduleCode)}/template`)
      .then((r) => r.json())
      .then((j: { ok?: boolean; template?: TemplateData["template"]; error?: string }) => {
        if (cancelled) return;
        if (j.ok && j.template) {
          setData({ ok: true, template: j.template });
          setError(null);
        } else {
          setError(j?.error ?? "Failed to load template");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load template");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [moduleCode]);

  if (isLoading) return <div style={{ fontSize: "14px", opacity: 0.8 }}>Loading template…</div>;
  if (error || !data?.ok) return <div style={{ fontSize: "14px", color: "#dc3545" }}>{error || "Failed to load template."}</div>;

  const t = data.template;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ borderRadius: 8, border: "1px solid #ddd", padding: 16 }}>
        <div style={{ fontSize: "18px", fontWeight: 600 }}>{t.title}</div>
        <div style={{ fontSize: "14px", opacity: 0.8, marginTop: 4 }}>{t.summary}</div>

        <div style={{ marginTop: 12, fontSize: "14px" }}>
          <div style={{ fontWeight: 600 }}>Scope</div>
          <ul style={{ listStyleType: "disc", marginLeft: 20, marginTop: 4 }}>
            <li><span style={{ fontWeight: 500 }}>Hazards:</span> {t.scope.hazards.join(", ")}</li>
            <li><span style={{ fontWeight: 500 }}>Areas:</span> {t.scope.areas.join(", ")}</li>
            <li><span style={{ fontWeight: 500 }}>Exclusions:</span> {t.scope.exclusions.join(", ")}</li>
          </ul>
        </div>
      </div>

      <div style={{ borderRadius: 8, border: "1px solid #ddd", padding: 16 }}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>Question families</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {t.question_families.map((f: QuestionFamily) => (
            <div key={f.family_code} style={{ borderRadius: 6, border: "1px solid #ddd", padding: 12 }}>
              <div style={{ fontWeight: 500 }}>{f.title} <span style={{ opacity: 0.6 }}>({f.family_code})</span></div>
              <div style={{ fontSize: "14px", opacity: 0.8, marginTop: 4 }}>{f.intent}</div>
              <div style={{ fontSize: "14px", marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>Prompts</div>
                <ul style={{ listStyleType: "disc", marginLeft: 20, marginTop: 4 }}>
                  {f.question_prompts.map((q: string, i: number) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 8, border: "1px solid #ddd", padding: 16 }}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>OFC template bank</div>
        <ul style={{ listStyleType: "disc", marginLeft: 20, marginTop: 8, fontSize: "14px" }}>
          {t.ofc_template_bank.map((o: OfcTemplateItem) => (
            <li key={o.ofc_code} style={{ marginTop: 4 }}><span style={{ fontWeight: 500 }}>{o.ofc_code}:</span> {o.text_template}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
