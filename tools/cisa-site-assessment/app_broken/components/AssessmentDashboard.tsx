"use client";

interface ScoringSummary {
  total: number;
  yes: number;
  no: number;
  na: number;
  percent: number | null; // null if denominator is 0
}

interface AssessmentData {
  baseline?: {
    disciplines: any[];
    summary: ScoringSummary;
  };
  sector?: {
    sector_id: string;
    sector_name?: string;
    disciplines: any[];
    summary: ScoringSummary;
  };
}

interface AssessmentDashboardProps {
  data: AssessmentData;
}

export default function AssessmentDashboard({ data }: AssessmentDashboardProps) {
  const baselineSummary = data.baseline?.summary;
  const sectorSummary = data.sector?.summary;
  const hasSector = !!data.sector;

  const formatPercent = (percent: number | null): string => {
    if (percent === null) return "N/A";
    return `${percent.toFixed(1)}%`;
  };

  const formatCount = (count: number): string => {
    return count.toString();
  };

  return (
    <div className="assessment-dashboard">
      <div className="dashboard-grid">
        {/* Baseline Summary */}
        <div className="dashboard-card baseline-card">
          <h3 className="card-title">Baseline Assessment</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <div className="stat-value">{formatPercent(baselineSummary?.percent ?? null)}</div>
              <div className="stat-label">Overall Score</div>
            </div>
            <div className="stat-item">
              <div className="stat-value stat-value-negative">{formatCount(baselineSummary?.no ?? 0)}</div>
              <div className="stat-label">Gaps (NO)</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{formatCount(baselineSummary?.yes ?? 0)}</div>
              <div className="stat-label">Implemented (YES)</div>
            </div>
            <div className="stat-item">
              <div className="stat-value stat-value-neutral">{formatCount(baselineSummary?.na ?? 0)}</div>
              <div className="stat-label">Excluded (N/A)</div>
            </div>
          </div>
        </div>

        {/* Sector Summary - Only show if sector exists */}
        {hasSector && sectorSummary && (
          <div className="dashboard-card sector-card">
            <h3 className="card-title">
              Sector Assessment
              {data.sector?.sector_name && (
                <span className="sector-name">({data.sector.sector_name})</span>
              )}
            </h3>
            <div className="summary-stats">
              <div className="stat-item">
                <div className="stat-value">{formatPercent(sectorSummary.percent ?? null)}</div>
                <div className="stat-label">Overall Score</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-value-negative">{formatCount(sectorSummary.no ?? 0)}</div>
                <div className="stat-label">Gaps (NO)</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatCount(sectorSummary.yes ?? 0)}</div>
                <div className="stat-label">Implemented (YES)</div>
              </div>
              <div className="stat-item">
                <div className="stat-value stat-value-neutral">{formatCount(sectorSummary.na ?? 0)}</div>
                <div className="stat-label">Excluded (N/A)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .assessment-dashboard {
          margin: 2rem 0;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .dashboard-card {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .baseline-card {
          border-left: 4px solid #005ea2;
        }

        .sector-card {
          border-left: 4px solid #00a91c;
        }

        .card-title {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1b1b1b;
        }

        .sector-name {
          font-size: 0.875rem;
          font-weight: 400;
          color: #71767a;
          margin-left: 0.5rem;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #1b1b1b;
          line-height: 1.2;
        }

        .stat-value-negative {
          color: #d13212;
        }

        .stat-value-neutral {
          color: #71767a;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #71767a;
          margin-top: 0.25rem;
        }

        @media print {
          .dashboard-card {
            page-break-inside: avoid;
            box-shadow: none;
            border: 1px solid #000;
          }
        }
      `}</style>
    </div>
  );
}
