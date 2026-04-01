/**
 * Executive Risk Posture Snapshot Component
 * 
 * Single-page executive summary rendering from deterministic Snapshot data.
 * NO calculations. NO generative text. Display only.
 */

import React from "react";
import type { Snapshot } from "@/app/lib/report/snapshot";
import { fmtOrDash } from "@/app/lib/report/snapshot";

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "#e31c3d",
  ELEVATED: "#fa9441",
  MODERATE: "#fdb81e",
};

const DENSITY_STATUS_COLORS: Record<string, string> = {
  PASS: "#00a91c",
  WARN: "#fa9441",
  FAIL: "#e31c3d",
};

/**
 * Format ISO date to readable string.
 */
function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

type Props = {
  snapshot: Snapshot;
};

const DEFAULT_EVIDENCE: Snapshot["evidence"] = {
  findings: { structural: 0, foundational: 0, cross_cutting: 0, total: 0 },
  trigger_density: { status: "PASS", warnings: 0, fails: 0 },
  citation_coverage: { findings_with_citations: 0, findings_total: 0 },
};

export function ExecutiveRiskPostureSnapshot({ snapshot }: Props) {
  const { meta, posture, top_drivers, domains, cascade, evidence: rawEvidence } = snapshot;
  const evidence = rawEvidence ?? DEFAULT_EVIDENCE;

  return (
    <div
      style={{
        border: "2px solid var(--cisa-gray-medium)",
        borderRadius: "var(--border-radius)",
        padding: "var(--spacing-lg)",
        backgroundColor: "var(--cisa-gray-lightest)",
        marginBottom: "var(--spacing-xl)",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--spacing-lg)",
          paddingBottom: "var(--spacing-md)",
          borderBottom: "2px solid var(--cisa-gray-medium)",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            Executive Risk Posture Snapshot
          </h3>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-secondary)", margin: 0 }}>
            {meta.facility_name} · {formatDate(meta.assessment_date_iso)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {meta.toggles.pra_sla === "ON" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                padding: "0.25rem 0.5rem",
                borderRadius: "3px",
                backgroundColor: "var(--cisa-gray-light)",
                fontWeight: 600,
              }}
            >
              PRA/SLA
            </span>
          )}
          {meta.toggles.cross_dependency === "ON" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                padding: "0.25rem 0.5rem",
                borderRadius: "3px",
                backgroundColor: "var(--cisa-gray-light)",
                fontWeight: 600,
              }}
            >
              CROSS-DEP
            </span>
          )}
        </div>
      </div>

      {/* ROW A: POSTURE + TOP DRIVERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "var(--spacing-lg)",
          marginBottom: "var(--spacing-lg)",
        }}
      >
        {/* Posture Badge + Narrative */}
        <div
          style={{
            border: "1px solid var(--cisa-gray-light)",
            borderRadius: "var(--border-radius)",
            padding: "var(--spacing-md)",
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: posture.level === "NOT_ASSESSED" ? "var(--cisa-gray-medium)" : (SEVERITY_COLORS[posture.level] ?? "#666"),
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "var(--border-radius)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: "var(--spacing-md)",
            }}
          >
            {posture.level === "NOT_ASSESSED" ? "Not assessed" : `${posture.level} RISK`}
          </div>
          <p style={{ fontSize: "var(--font-size-sm)", lineHeight: 1.6, margin: 0 }}>
            {posture.narrative}
          </p>
        </div>

        {/* Top Drivers List */}
        <div
          style={{
            border: "1px solid var(--cisa-gray-light)",
            borderRadius: "var(--border-radius)",
            padding: "var(--spacing-md)",
            backgroundColor: "white",
          }}
        >
          <h4 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, marginBottom: "var(--spacing-md)" }}>
            Top Risk Drivers ({top_drivers.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {top_drivers.map((driver, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "var(--spacing-sm)",
                  paddingBottom: "var(--spacing-sm)",
                  borderBottom:
                    idx < top_drivers.length - 1 ? "1px solid var(--cisa-gray-light)" : "none",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: SEVERITY_COLORS[driver.severity] ?? "#666",
                    color: "white",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "3px",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    height: "fit-content",
                  }}
                >
                  {driver.severity}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    {driver.title}
                  </p>
                  <p
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-secondary)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {driver.consequence}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW B: 5 DOMAIN TILES (Fixed Order) */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <h4
          style={{
            fontSize: "var(--font-size-md)",
            fontWeight: 600,
            marginBottom: "var(--spacing-md)",
          }}
        >
          Infrastructure Domains
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "var(--spacing-md)",
          }}
        >
          {(["ELECTRIC_POWER", "COMMUNICATIONS", "INFORMATION_TECHNOLOGY", "WATER", "WASTEWATER"] as const).map(
            (key) => {
              const domain = domains[key];
              return (
                <div
                  key={key}
                  style={{
                    border: "1px solid var(--cisa-gray-light)",
                    borderRadius: "var(--border-radius)",
                    padding: "var(--spacing-sm)",
                    backgroundColor: "white",
                  }}
                >
                  <h5
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      marginBottom: "var(--spacing-sm)",
                    }}
                  >
                    {domain.label}
                  </h5>
                  <div
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-secondary)",
                      marginBottom: "var(--spacing-sm)",
                    }}
                  >
                    <div style={{ marginBottom: "0.25rem" }}>
                      <strong>Time to severe:</strong> {fmtOrDash(domain.time_to_severe_hrs, " hrs")}
                    </div>
                    <div style={{ marginBottom: "0.25rem" }}>
                      <strong>Loss (no alt):</strong> {fmtOrDash(domain.loss_no_alternate_pct, "%")}
                    </div>
                    {domain.alternate_duration_hrs !== null && (
                      <>
                        <div style={{ marginBottom: "0.25rem" }}>
                          <strong>Alt duration:</strong> {fmtOrDash(domain.alternate_duration_hrs, " hrs")}
                        </div>
                        <div style={{ marginBottom: "0.25rem" }}>
                          <strong>Loss (w/ alt):</strong> {fmtOrDash(domain.loss_with_alternate_pct, "%")}
                        </div>
                      </>
                    )}
                    <div>
                      <strong>Recovery:</strong> {fmtOrDash(domain.recovery_hrs, " hrs")}
                    </div>
                  </div>
                  {domain.tags.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {domain.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "var(--font-size-xs)",
                            padding: "0.25rem",
                            borderRadius: "3px",
                            backgroundColor: "var(--cisa-gray-light)",
                            textAlign: "center",
                          }}
                        >
                          {tag.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ROW C: CASCADE CALLOUT (Conditional) */}
      {cascade.enabled && (
        <div
          style={{
            border: "2px solid var(--cisa-blue)",
            borderRadius: "var(--border-radius)",
            padding: "var(--spacing-md)",
            backgroundColor: "var(--cisa-blue-lightest, #e7f2f8)",
            marginBottom: "var(--spacing-lg)",
          }}
        >
          <h4
            style={{
              fontSize: "var(--font-size-md)",
              fontWeight: 600,
              marginBottom: "var(--spacing-sm)",
              color: "var(--cisa-blue)",
            }}
          >
            Cross-Dependency Cascading Risk · {cascade.severity}
          </h4>
          <div style={{ fontSize: "var(--font-size-sm)", lineHeight: 1.6 }}>
            {cascade.statements.map((stmt, idx) => (
              <p key={idx} style={{ margin: "0 0 0.5rem 0" }}>
                {stmt}
              </p>
            ))}
          </div>
          {cascade.primary_path && (
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)", margin: "0.5rem 0 0 0" }}>
              Primary path: {cascade.primary_path}
            </p>
          )}
        </div>
      )}

      {/* FOOTER: EVIDENCE STRIP */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--spacing-md)",
          paddingTop: "var(--spacing-md)",
          borderTop: "1px solid var(--cisa-gray-medium)",
        }}
      >
        {/* Findings Count */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cisa-blue)" }}>
            {evidence.findings.total}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)" }}>
            Total Findings
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)", marginTop: "0.25rem" }}>
            S:{evidence.findings.structural} · F:{evidence.findings.foundational} · C:
            {evidence.findings.cross_cutting}
          </div>
        </div>

        {/* Trigger Density */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: DENSITY_STATUS_COLORS[evidence.trigger_density.status],
            }}
          >
            {evidence.trigger_density.status}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)" }}>
            Trigger Density
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)", marginTop: "0.25rem" }}>
            Warnings: {evidence.trigger_density.warnings} · Fails: {evidence.trigger_density.fails}
          </div>
        </div>

        {/* Citation Coverage */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cisa-blue)" }}>
            {evidence.citation_coverage.findings_with_citations}/
            {evidence.citation_coverage.findings_total}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)" }}>
            Citation Coverage
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-secondary)", marginTop: "0.25rem" }}>
            {evidence.citation_coverage.findings_total > 0
              ? Math.round(
                  (evidence.citation_coverage.findings_with_citations /
                    evidence.citation_coverage.findings_total) *
                    100
                )
              : 0}
            % cited
          </div>
        </div>
      </div>
    </div>
  );
}
