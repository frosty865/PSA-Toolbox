"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
// Use API routes instead of direct data provider for client component
async function getScoringResult(assessmentId: string) {
  const response = await fetch(`/api/assessment/scoring?documentId=${assessmentId}`, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

async function getAssessmentDetail(assessmentId: string) {
  const response = await fetch(`/api/runtime/assessments/${assessmentId}`, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

// New schema structure (numerator/denominator/percent/status)
interface DisciplineResult {
  discipline_id?: string;
  discipline_name: string;
  numerator: number;
  denominator: number;
  percent: number | null;
  status?: "PASS" | "FAIL" | "N/A";
}

interface SummaryResult {
  numerator: number;
  denominator: number;
  percent: number | null;
}

interface ScoringResults {
  baseline: {
    disciplines: DisciplineResult[];
    summary: SummaryResult;
  };
  sector?: {
    sector_id: string;
    sector_name: string;
    disciplines: DisciplineResult[];
    summary: SummaryResult;
  } | null;
}

interface AssessmentDetail {
  assessment_id: string;
  name: string;
  facility: {
    sector_id: string | null;
    sector_name: string | null;
    subsector_id: string | null;
    subsector_name: string | null;
  };
  status: "draft" | "completed";
}

export default function AssessmentResultsPage() {
  const params = useParams();
  const assessmentId = params?.assessmentId as string;

  const [scoringData, setScoringData] = useState<ScoringResults | null>(null);
  const [assessmentDetail, setAssessmentDetail] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch assessment data
  useEffect(() => {
    if (!assessmentId) {
      setLoading(false);
      setError("Assessment ID is required");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load scoring results and assessment detail in parallel
        const [scoringResult, detail] = await Promise.all([
          getScoringResult(assessmentId),
          getAssessmentDetail(assessmentId),
        ]);

        if (!scoringResult) {
          setError("not_found");
          return;
        }

        if (!detail) {
          setError("Assessment detail not found");
          return;
        }

        // Transform old structure to new structure if needed
        const transformed = transformScoringData(scoringResult);
        setScoringData(transformed);
        setAssessmentDetail(detail);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assessment data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assessmentId]);

  // Transform old fixture structure (total/yes/no/na) to new structure (numerator/denominator/percent)
  function transformScoringData(data: Record<string, unknown>): ScoringResults {
    const transformDiscipline = (d: Record<string, unknown>): DisciplineResult => {
      const numerator = asNumber(d.numerator, asNumber(d.yes, 0));
      const denominator = asNumber(d.denominator, asNumber(d.yes, 0) + asNumber(d.no, 0));
      const percentRaw = d.percent;
      const percent = typeof percentRaw === "number" && Number.isFinite(percentRaw)
        ? percentRaw
        : (denominator > 0 ? ((numerator / denominator) * 100) : null);
      const statusRaw = d.status;
      const status = statusRaw === "PASS" || statusRaw === "FAIL" || statusRaw === "N/A"
        ? statusRaw
        : (percent !== null ? (percent >= 70 ? "PASS" : "FAIL") : "N/A");

      // New structure already has numerator/denominator
      if (d.numerator !== undefined && d.denominator !== undefined) {
        return {
          discipline_id: asOptionalString(d.discipline_id),
          discipline_name: asString(d.discipline_name, "Unknown Discipline"),
          numerator,
          denominator,
          percent,
          status,
        };
      }
      return {
        discipline_id: asOptionalString(d.discipline_id),
        discipline_name: asString(d.discipline_name, "Unknown Discipline"),
        numerator,
        denominator,
        percent,
        status,
      };
    };

    const transformSummary = (s: Record<string, unknown>): SummaryResult => {
      const numerator = asNumber(s.numerator, asNumber(s.yes, 0));
      const denominator = asNumber(s.denominator, asNumber(s.yes, 0) + asNumber(s.no, 0));
      const percentRaw = s.percent;
      const percent = typeof percentRaw === "number" && Number.isFinite(percentRaw)
        ? percentRaw
        : (denominator > 0 ? ((numerator / denominator) * 100) : null);

      // New structure
      if (s.numerator !== undefined && s.denominator !== undefined) {
        return {
          numerator,
          denominator,
          percent,
        };
      }
      return { numerator, denominator, percent };
    };

    const baselineRaw = asRecord(data.baseline) ?? {};
    const baselineDisciplinesRaw = Array.isArray(baselineRaw.disciplines) ? baselineRaw.disciplines : [];
    const baselineSummaryRaw = asRecord(baselineRaw.summary) ?? {};
    const sectorRaw = asRecord(data.sector);

    return {
      baseline: {
        disciplines: baselineDisciplinesRaw.map((row) => transformDiscipline(asRecord(row) ?? {})),
        summary: transformSummary(baselineSummaryRaw),
      },
      sector: sectorRaw
        ? {
            sector_id: asString(sectorRaw.sector_id),
            sector_name: asString(sectorRaw.sector_name),
            disciplines: (Array.isArray(sectorRaw.disciplines) ? sectorRaw.disciplines : []).map((row) =>
              transformDiscipline(asRecord(row) ?? {})
            ),
            summary: transformSummary(asRecord(sectorRaw.summary) ?? {}),
          }
        : null,
    };
  }


  // Loading state
  if (loading) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Results (Read-Only)</h2>
        </div>
        <div className="card">
          <p>Loading assessment data...</p>
        </div>
      </section>
    );
  }

  // Error state: Assessment not found
  if (error === "not_found") {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Results (Read-Only)</h2>
        </div>
        <div className="card">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.25rem", color: "#d13212" }}>
              Assessment Not Found
            </h3>
            <p style={{ marginBottom: "1.5rem", color: "#71767a" }}>
              This assessment could not be found. The assessment ID may be invalid or the assessment may have been removed.
            </p>
            <Link
              href="/assessments"
              className="usa-button"
              style={{ textDecoration: "none" }}
            >
              Back to Assessments
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Error state: Other errors
  if (error) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Results (Read-Only)</h2>
        </div>
        <div className="alert alert-danger">
          <strong>Error loading assessment:</strong>
          <p>{error}</p>
          <div style={{ marginTop: "1rem" }}>
            <Link
              href="/assessments"
              className="usa-button usa-button--outline"
              style={{ textDecoration: "none" }}
            >
              Back to Assessments
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!scoringData || !assessmentDetail) {
    return (
      <section className="section active">
        <div className="section-header">
          <h2 className="section-title">Assessment Results (Read-Only)</h2>
        </div>
        <div className="card">
          <p>No assessment data available.</p>
        </div>
      </section>
    );
  }

  const hasSector = !!scoringData.sector;

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <h2 className="section-title">Assessment Results (Read-Only)</h2>
        </div>
        <div className="section-actions">
          <Link
            href="/assessments"
            className="usa-button usa-button--outline"
            style={{ textDecoration: "none", marginRight: "0.5rem" }}
          >
            Back to Assessments
          </Link>
          <Link
            href={`/assessments/${assessmentId}`}
            className="usa-button usa-button--outline"
            style={{ textDecoration: "none" }}
          >
            Back to Assessment
          </Link>
        </div>
      </div>

      {/* Assessment Metadata */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Assessment Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <strong>Assessment ID:</strong> {assessmentDetail.assessment_id}
          </div>
          <div>
            <strong>Name:</strong> {assessmentDetail.name}
          </div>
          {assessmentDetail.facility.sector_name && (
            <div>
              <strong>Sector:</strong> {assessmentDetail.facility.sector_name}
            </div>
          )}
          {assessmentDetail.facility.subsector_name && (
            <div>
              <strong>Subsector:</strong> {assessmentDetail.facility.subsector_name}
            </div>
          )}
          {!assessmentDetail.facility.sector_name && !assessmentDetail.facility.subsector_name && (
            <div>
              <strong>Sector/Subsector:</strong> N/A
            </div>
          )}
          <div>
            <strong>Status:</strong> {assessmentDetail.status}
          </div>
        </div>
      </div>

      {/* Baseline Results */}
      {scoringData.baseline && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Baseline Results
          </h3>
          
          {/* Baseline Summary */}
          <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Overall Summary</h4>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div>
                <strong>Numerator:</strong> {scoringData.baseline.summary.numerator}
              </div>
              <div>
                <strong>Denominator:</strong> {scoringData.baseline.summary.denominator}
              </div>
              <div>
                <strong>Percent:</strong> {scoringData.baseline.summary.percent !== null 
                  ? `${scoringData.baseline.summary.percent.toFixed(1)}%`
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Baseline Disciplines */}
          <div>
            <h4 style={{ marginBottom: "1rem" }}>Disciplines</h4>
            <table className="usa-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Discipline</th>
                  <th>Numerator</th>
                  <th>Denominator</th>
                  <th>Percent</th>
                </tr>
              </thead>
              <tbody>
                {scoringData.baseline.disciplines.map((discipline, idx) => (
                  <tr key={idx}>
                    <td>{discipline.discipline_name}</td>
                    <td>{discipline.numerator}</td>
                    <td>{discipline.denominator}</td>
                    <td>
                      {discipline.percent !== null
                        ? `${discipline.percent.toFixed(1)}%`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sector Results (Conditional) */}
      {hasSector && scoringData.sector && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1.5rem", borderBottom: "2px solid #005ea2", paddingBottom: "0.5rem" }}>
            Sector Results: {scoringData.sector.sector_name}
          </h3>
          
          {/* Sector Summary */}
          <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Overall Summary</h4>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <div>
                <strong>Numerator:</strong> {scoringData.sector.summary.numerator}
              </div>
              <div>
                <strong>Denominator:</strong> {scoringData.sector.summary.denominator}
              </div>
              <div>
                <strong>Percent:</strong> {scoringData.sector.summary.percent !== null 
                  ? `${scoringData.sector.summary.percent.toFixed(1)}%`
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Sector Disciplines */}
          <div>
            <h4 style={{ marginBottom: "1rem" }}>Disciplines</h4>
            <table className="usa-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Discipline</th>
                  <th>Numerator</th>
                  <th>Denominator</th>
                  <th>Percent</th>
                </tr>
              </thead>
              <tbody>
                {scoringData.sector.disciplines.map((discipline, idx) => (
                  <tr key={idx}>
                    <td>{discipline.discipline_name}</td>
                    <td>{discipline.numerator}</td>
                    <td>{discipline.denominator}</td>
                    <td>
                      {discipline.percent !== null
                        ? `${discipline.percent.toFixed(1)}%`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

