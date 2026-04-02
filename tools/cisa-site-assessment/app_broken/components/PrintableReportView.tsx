"use client";

import ReportOFCs from "./ReportOFCs";

interface Finding {
  element_code: string;
  title: string;
  discipline: string;
  subtype?: string;
  ofcs?: any[]; // Optional OFCs for this finding
}

interface DisciplineSummary {
  discipline: string;
  score?: number;
  totalElements: number;
  coveredElements: number;
  gapElements: number;
  naElements: number;
}

interface ReportSection {
  title: string;
  findings: Finding[];
}

interface PrintableReportViewProps {
  baselineFindings: Finding[];
  sectorFindings?: Finding[];
  sectorName?: string;
  baselineSummaries?: DisciplineSummary[];
  sectorSummaries?: DisciplineSummary[];
  assessmentMetadata?: {
    documentId?: string;
    facilityName?: string;
    assessmentDate?: string;
  };
}

export default function PrintableReportView({
  baselineFindings,
  sectorFindings = [],
  sectorName,
  baselineSummaries = [],
  sectorSummaries = [],
  assessmentMetadata = {}
}: PrintableReportViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Trigger browser print dialog for PDF export
    window.print();
  };
  const groupFindingsByDiscipline = (findings: Finding[]): ReportSection[] => {
    const grouped: Record<string, Finding[]> = {};
    
    findings.forEach(finding => {
      const key = finding.discipline;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(finding);
    });

    return Object.entries(grouped).map(([discipline, items]) => ({
      title: discipline,
      findings: items
    }));
  };

  const baselineSections = groupFindingsByDiscipline(baselineFindings);
  const sectorSections = sectorFindings.length > 0 
    ? groupFindingsByDiscipline(sectorFindings)
    : [];

  return (
    <div className="printable-report">
      {/* Print/Export Actions */}
      <div className="report-actions no-print">
        <button onClick={handlePrint} className="action-button">
          Print / Export PDF
        </button>
      </div>

      <div className="report-header">
        <h1>Protective Security Assessment Report</h1>
        <div className="report-meta">
          {assessmentMetadata.facilityName && (
            <p><strong>Facility:</strong> {assessmentMetadata.facilityName}</p>
          )}
          {assessmentMetadata.documentId && (
            <p><strong>Document ID:</strong> {assessmentMetadata.documentId}</p>
          )}
          <p><strong>Generated:</strong> {assessmentMetadata.assessmentDate || new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Executive Summary */}
      <section className="report-section executive-summary">
        <h2>Executive Summary</h2>
        
        <div className="summary-content">
          <div className="summary-subsection">
            <h3>Baseline Assessment</h3>
            <p>
              The baseline assessment identified <strong>{baselineFindings.length}</strong> gap(s) 
              across <strong>{baselineSections.length}</strong> discipline(s). These gaps represent 
              areas where required security elements are not currently implemented.
            </p>
            {baselineSummaries.length > 0 && (
              <div className="discipline-summaries">
                <h4>Discipline Summaries</h4>
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>Discipline</th>
                      <th>Score</th>
                      <th>Covered</th>
                      <th>Gaps</th>
                      <th>N/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineSummaries.map((summary, idx) => (
                      <tr key={idx}>
                        <td>{summary.discipline}</td>
                        <td>{summary.score !== undefined ? `${(summary.score * 100).toFixed(0)}%` : 'N/A'}</td>
                        <td>{summary.coveredElements}</td>
                        <td>{summary.gapElements}</td>
                        <td>{summary.naElements}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {baselineFindings.length > 0 && (
              <ul>
                {baselineSections.map((section, idx) => (
                  <li key={idx}>
                    <strong>{section.title}:</strong> {section.findings.length} gap(s)
                  </li>
                ))}
              </ul>
            )}
          </div>

          {sectorSections.length > 0 && (
            <div className="summary-subsection">
              <h3>Sector-Specific Assessment {sectorName && `(${sectorName})`}</h3>
              <p>
                The sector assessment identified <strong>{sectorFindings.length}</strong> additional 
                gap(s) across <strong>{sectorSections.length}</strong> discipline(s). These gaps are 
                specific to the facility's sector classification.
              </p>
              {sectorSummaries.length > 0 && (
                <div className="discipline-summaries">
                  <h4>Discipline Summaries</h4>
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th>Discipline</th>
                        <th>Score</th>
                        <th>Covered</th>
                        <th>Gaps</th>
                        <th>N/A</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorSummaries.map((summary, idx) => (
                        <tr key={idx}>
                          <td>{summary.discipline}</td>
                          <td>{summary.score !== undefined ? `${(summary.score * 100).toFixed(0)}%` : 'N/A'}</td>
                          <td>{summary.coveredElements}</td>
                          <td>{summary.gapElements}</td>
                          <td>{summary.naElements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sectorFindings.length > 0 && (
                <ul>
                  {sectorSections.map((section, idx) => (
                    <li key={idx}>
                      <strong>{section.title}:</strong> {section.findings.length} gap(s)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Detailed Findings */}
      <section className="report-section detailed-findings">
        <h2>Detailed Findings</h2>

        {/* Baseline Findings */}
        <div className="findings-section">
          <h3>Baseline Gaps</h3>
          {baselineSections.length === 0 ? (
            <p className="no-findings">No baseline gaps identified.</p>
          ) : (
            baselineSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="discipline-findings">
                <h4>{section.title}</h4>
                <ul className="findings-list">
                  {section.findings.map((finding, findingIdx) => (
                    <li key={findingIdx} className="finding-item">
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
                          <span className="finding-code">{finding.element_code}</span>
                          <span className="finding-title">{finding.title}</span>
                          {finding.subtype && (
                            <span className="finding-subtype">({finding.subtype})</span>
                          )}
                        </div>
                        {finding.ofcs && finding.ofcs.length > 0 && (
                          <ReportOFCs ofcs={finding.ofcs} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Sector Findings */}
        {sectorSections.length > 0 && (
          <div className="findings-section">
            <h3>Sector-Specific Gaps {sectorName && `(${sectorName})`}</h3>
            {sectorSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="discipline-findings">
                <h4>{section.title}</h4>
                <ul className="findings-list">
                  {section.findings.map((finding, findingIdx) => (
                    <li key={findingIdx} className="finding-item">
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
                          <span className="finding-code">{finding.element_code}</span>
                          <span className="finding-title">{finding.title}</span>
                          {finding.subtype && (
                            <span className="finding-subtype">({finding.subtype})</span>
                          )}
                        </div>
                        {finding.ofcs && finding.ofcs.length > 0 && (
                          <ReportOFCs ofcs={finding.ofcs} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .printable-report {
          max-width: 8.5in;
          margin: 0 auto;
          padding: 1in;
          background: white;
          color: #1b1b1b;
        }

        .report-actions {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
        }

        .action-button {
          padding: 0.5rem 1rem;
          background: #005ea2;
          color: white;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          font-weight: 600;
        }

        .action-button:hover {
          background: #004080;
        }

        @media print {
          .no-print {
            display: none;
          }
        }

        .report-header {
          border-bottom: 2px solid #1b1b1b;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }

        .report-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
        }

        .report-meta {
          font-size: 0.875rem;
          color: #71767a;
        }

        .report-meta p {
          margin: 0.25rem 0;
        }

        .report-section {
          margin-bottom: 3rem;
        }

        .report-section h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #1b1b1b;
          padding-bottom: 0.5rem;
        }

        .executive-summary {
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 0.5rem;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .summary-subsection h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
        }

        .summary-subsection p {
          margin: 0 0 0.75rem 0;
          line-height: 1.6;
        }

        .summary-subsection ul {
          margin: 0.5rem 0 0 1.5rem;
          padding: 0;
        }

        .summary-subsection li {
          margin: 0.25rem 0;
        }

        .findings-section {
          margin-top: 2rem;
        }

        .findings-section h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .discipline-findings {
          margin-bottom: 2rem;
        }

        .discipline-findings h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
          color: #005ea2;
        }

        .findings-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .finding-item {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          border-left: 3px solid #d13212;
          background: #fef2f2;
          display: block;
        }

        .finding-code {
          font-weight: 600;
          font-family: monospace;
          color: #1b1b1b;
          min-width: 80px;
        }

        .finding-title {
          flex: 1;
          color: #1b1b1b;
        }

        .finding-subtype {
          font-size: 0.875rem;
          color: #71767a;
          font-style: italic;
        }

        .no-findings {
          padding: 1rem;
          text-align: center;
          color: #71767a;
          font-style: italic;
        }

        .discipline-summaries {
          margin: 1rem 0;
        }

        .discipline-summaries h4 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.5rem 0;
          font-size: 0.875rem;
        }

        .summary-table th,
        .summary-table td {
          padding: 0.5rem;
          text-align: left;
          border: 1px solid #d1d5db;
        }

        .summary-table th {
          background: #f9fafb;
          font-weight: 600;
        }

        .summary-table td {
          background: white;
        }

        @media print {
          .printable-report {
            padding: 0.5in;
          }

          .report-header {
            border-bottom: 2px solid #000;
            page-break-after: avoid;
          }

          .executive-summary {
            background: white;
            border: 1px solid #000;
            page-break-after: auto;
          }

          .report-section {
            page-break-before: auto;
          }

          .findings-section {
            page-break-before: auto;
          }

          .finding-item {
            background: white;
            border-left: 3px solid #000;
            page-break-inside: avoid;
          }

          .discipline-findings {
            page-break-inside: avoid;
          }

          .finding-item {
            page-break-inside: avoid;
          }

          .summary-table {
            border: 1px solid #000;
          }

          .summary-table th,
          .summary-table td {
            border: 1px solid #000;
          }

          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
