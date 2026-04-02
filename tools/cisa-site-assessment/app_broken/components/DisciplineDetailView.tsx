"use client";

interface DisciplineRollup {
  discipline_name: string;
  total: number;
  yes: number;
  no: number;
  na: number;
  percent: number | null;
  subtypes?: SubtypeRollup[];
}

interface SubtypeRollup {
  subtype_name: string;
  total: number;
  yes: number;
  no: number;
  na: number;
  percent: number | null;
}

interface DisciplineDetailViewProps {
  disciplines: DisciplineRollup[];
  title: string;
  type: "baseline" | "sector";
}

export default function DisciplineDetailView({ 
  disciplines, 
  title, 
  type 
}: DisciplineDetailViewProps) {
  const formatPercent = (percent: number | null): string => {
    if (percent === null) return "N/A";
    return `${percent.toFixed(1)}%`;
  };

  const formatCount = (count: number): string => {
    return count.toString();
  };

  return (
    <div className="discipline-detail-view">
      <h3 className="view-title">{title}</h3>
      
      {disciplines.length === 0 ? (
        <p className="no-data">No discipline data available.</p>
      ) : (
        <div className="disciplines-list">
          {disciplines.map((discipline, idx) => (
            <div key={idx} className="discipline-card">
              <div className="discipline-header">
                <h4 className="discipline-name">{discipline.discipline_name}</h4>
                <div className="discipline-summary">
                  <span className="summary-item">
                    Score: <strong>{formatPercent(discipline.percent)}</strong>
                  </span>
                  <span className="summary-item">
                    YES: {formatCount(discipline.yes)}
                  </span>
                  <span className="summary-item summary-item-negative">
                    NO: {formatCount(discipline.no)}
                  </span>
                  <span className="summary-item summary-item-neutral">
                    N/A: {formatCount(discipline.na)}
                  </span>
                </div>
              </div>

              {discipline.subtypes && discipline.subtypes.length > 0 && (
                <div className="subtypes-list">
                  {discipline.subtypes.map((subtype, subIdx) => (
                    <div key={subIdx} className="subtype-item">
                      <div className="subtype-header">
                        <span className="subtype-name">{subtype.subtype_name}</span>
                        <span className="subtype-score">{formatPercent(subtype.percent)}</span>
                      </div>
                      <div className="subtype-breakdown">
                        <span>YES: {formatCount(subtype.yes)}</span>
                        <span className="subtype-negative">NO: {formatCount(subtype.no)}</span>
                        <span className="subtype-neutral">N/A: {formatCount(subtype.na)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .discipline-detail-view {
          margin: 2rem 0;
        }

        .view-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: #1b1b1b;
        }

        .no-data {
          padding: 2rem;
          text-align: center;
          color: #71767a;
        }

        .disciplines-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .discipline-card {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .discipline-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .discipline-name {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          color: #1b1b1b;
        }

        .discipline-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .summary-item {
          font-size: 0.875rem;
          color: #1b1b1b;
        }

        .summary-item-negative {
          color: #d13212;
        }

        .summary-item-neutral {
          color: #71767a;
        }

        .subtypes-list {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .subtype-item {
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 0.25rem;
        }

        .subtype-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .subtype-name {
          font-weight: 500;
          color: #1b1b1b;
        }

        .subtype-score {
          font-weight: 600;
          color: #005ea2;
        }

        .subtype-breakdown {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: #71767a;
        }

        .subtype-negative {
          color: #d13212;
        }

        .subtype-neutral {
          color: #71767a;
        }

        @media print {
          .discipline-card {
            page-break-inside: avoid;
            box-shadow: none;
            border: 1px solid #000;
          }

          .subtype-item {
            background: white;
            border: 1px solid #000;
          }
        }
      `}</style>
    </div>
  );
}
