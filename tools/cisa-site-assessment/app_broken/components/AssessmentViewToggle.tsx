"use client";

interface AssessmentViewToggleProps {
  activeView: "baseline" | "sector";
  onViewChange: (view: "baseline" | "sector") => void;
  hasSector: boolean;
}

export default function AssessmentViewToggle({
  activeView,
  onViewChange,
  hasSector
}: AssessmentViewToggleProps) {
  if (!hasSector) {
    return null; // Don't show toggle if no sector data
  }

  return (
    <div className="assessment-view-toggle">
      <button
        className={`toggle-button ${activeView === "baseline" ? "active" : ""}`}
        onClick={() => onViewChange("baseline")}
        aria-pressed={activeView === "baseline"}
      >
        Baseline
      </button>
      <button
        className={`toggle-button ${activeView === "sector" ? "active" : ""}`}
        onClick={() => onViewChange("sector")}
        aria-pressed={activeView === "sector"}
      >
        Sector
      </button>

      <style jsx>{`
        .assessment-view-toggle {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .toggle-button {
          padding: 0.75rem 1.5rem;
          background: white;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 1rem;
          font-weight: 500;
          color: #71767a;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -2px;
        }

        .toggle-button:hover {
          color: #1b1b1b;
          background: #f9fafb;
        }

        .toggle-button.active {
          color: #005ea2;
          border-bottom-color: #005ea2;
          font-weight: 600;
        }

        .toggle-button:focus {
          outline: 2px solid #005ea2;
          outline-offset: 2px;
        }

        @media print {
          .assessment-view-toggle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
