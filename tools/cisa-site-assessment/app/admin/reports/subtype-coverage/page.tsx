"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type FilterKey = "missing_subtype" | "subtype_no_overview" | "subtype_no_reference_implementation" | "help_empty" | "";

interface Row {
  canon_id: string;
  question_text: string;
  discipline_id: string | null;
  discipline_name?: string;
  discipline_subtype_id: string | null;
  discipline_subtype_name?: string | null;
  has_overview: boolean;
  has_reference_implementation: boolean;
  help_enabled: boolean;
  help_empty: boolean;
}

interface Report {
  generated_at: string;
  totals: {
    questions_total: number;
    with_subtype: number;
    without_subtype: number;
    with_overview: number;
    without_overview: number;
    with_reference_implementation: number;
    without_reference_implementation: number;
    help_enabled_but_empty: number;
  };
  rows: Row[];
  gaps: {
    missing_subtype: string[];
    subtype_no_overview: string[];
    subtype_no_reference_implementation: string[];
    help_empty_questions: string[];
  };
}

export default function SubtypeCoverageReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/reports/subtype-coverage", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error || "Failed to load report");
          setReport(null);
        } else {
          setReport(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || "Failed to load report");
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {
    const rows = report?.rows;
    if (!rows || rows.length === 0) return [];
    let r = rows;
    if (filter === "missing_subtype") {
      r = r.filter((x) => x.discipline_subtype_id == null);
    } else if (filter === "subtype_no_overview") {
      r = r.filter((x) => x.help_enabled && !x.has_overview);
    } else if (filter === "subtype_no_reference_implementation") {
      r = r.filter((x) => x.help_enabled && !x.has_reference_implementation);
    } else if (filter === "help_empty") {
      r = r.filter((x) => x.help_empty);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) => (x.question_text || "").toLowerCase().includes(q) || (x.canon_id || "").toLowerCase().includes(q));
    }
    return r;
  }, [report, filter, search]);

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtype-coverage-${report.generated_at.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div>Loading report…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#b91c1c" }}>
        <div>{error}</div>
        <Link href="/admin" style={{ color: "#0066cc", marginTop: 16, display: "inline-block" }}>
          ← Back to Admin
        </Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: 24 }}>
        <div>No data</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ color: "#0066cc" }}>
          ← Back to Admin
        </Link>
      </div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
        Subtype Coverage &amp; Gap Audit
      </h1>
      <p style={{ color: "#666", fontSize: "14px", marginBottom: 16 }}>
        Baseline questions from baseline_spines_runtime: subtype, overview, reference implementation. Generated: {report.generated_at}
      </p>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 12, backgroundColor: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.questions_total}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Questions total</div>
        </div>
        <div style={{ padding: 12, backgroundColor: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.with_subtype}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>With subtype</div>
        </div>
        <div style={{ padding: 12, backgroundColor: "#fef3c7", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.without_subtype}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Without subtype</div>
        </div>
        <div style={{ padding: 12, backgroundColor: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.with_overview}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>With overview</div>
        </div>
        <div style={{ padding: 12, backgroundColor: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.with_reference_implementation}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>With ref. impl.</div>
        </div>
        <div style={{ padding: 12, backgroundColor: "#fee2e2", borderRadius: 6 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{report.totals.help_enabled_but_empty}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Help empty</div>
        </div>
      </div>

      {/* Filters + Search + Export */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "14px" }}
        >
          <option value="">All rows</option>
          <option value="missing_subtype">Missing subtype</option>
          <option value="subtype_no_overview">Subtype missing overview</option>
          <option value="subtype_no_reference_implementation">Subtype missing reference implementation</option>
          <option value="help_empty">Help empty</option>
        </select>
        <input
          type="text"
          placeholder="Search question text or canon_id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "14px", minWidth: 240 }}
        />
        <button
          type="button"
          onClick={handleExport}
          style={{ padding: "8px 16px", backgroundColor: "#4b5563", color: "white", border: "none", borderRadius: 6, fontSize: "14px", cursor: "pointer" }}
        >
          Export JSON
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>canon_id</th>
              <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>question_text</th>
              <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>discipline</th>
              <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>subtype</th>
              <th style={{ padding: 10, textAlign: "center", fontWeight: 600 }}>overview</th>
              <th style={{ padding: 10, textAlign: "center", fontWeight: 600 }}>ref.impl</th>
              <th style={{ padding: 10, textAlign: "center", fontWeight: 600 }}>help enabled</th>
              <th style={{ padding: 10, textAlign: "center", fontWeight: 600 }}>help empty</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, i) => (
              <tr key={r.canon_id} style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: 10, fontFamily: "monospace", fontSize: "12px" }}>{r.canon_id}</td>
                <td style={{ padding: 10, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.question_text}>{r.question_text}</td>
                <td style={{ padding: 10 }}>{r.discipline_name || "—"}</td>
                <td style={{ padding: 10 }}>{r.discipline_subtype_name ?? "—"}</td>
                <td style={{ padding: 10, textAlign: "center" }}>{r.has_overview ? "✓" : "—"}</td>
                <td style={{ padding: 10, textAlign: "center" }}>{r.has_reference_implementation ? "✓" : "—"}</td>
                <td style={{ padding: 10, textAlign: "center" }}>{r.help_enabled ? "✓" : "—"}</td>
                <td style={{ padding: 10, textAlign: "center" }}>{r.help_empty ? "⚠" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: "12px", color: "#666" }}>
        Showing {filteredRows.length} of {report.rows.length} rows
      </div>
    </div>
  );
}
