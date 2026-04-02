// STABLE: OFC depth hierarchy rendering
// Changes require doctrine or backend contract change.
// Do not modify during baseline burn-down.

"use client";

import { groupOfcsByDepth } from "@/lib/groupOfcsByDepth";

/**
 * OFC Display Component
 * 
 * Renders OFCs in the correct order:
 * 1. Baseline OFCs
 * 2. Baseline Depth OFCs
 * 3. Sector Depth OFCs
 * 4. Subsector Depth OFCs
 * 
 * Uses backend-provided flags only (no inference).
 * Grouping logic is centralized in groupOfcsByDepth utility.
 */
interface OfcDisplayProps {
  ofcs: any[];
}

export default function OfcDisplay({ ofcs }: OfcDisplayProps) {
  // Use centralized grouping logic (single source of truth)
  const {
    baseline: baselineOfcs,
    baselineDepth: baselineDepthOfcs,
    sectorDepth: sectorDepthOfcs,
    subsectorDepth: subsectorDepthOfcs,
  } = groupOfcsByDepth(ofcs);

  // Don't render if no OFCs
  if (ofcs.length === 0) {
    return null;
  }

  // Render OFC card helper (reusable)
  const renderOfc = (ofc: any, idx: number) => (
    <div
      key={ofc.ofc_code || idx}
      style={{
        marginBottom: "1rem",
        padding: "1rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "4px",
        borderLeft: "3px solid #005ea2",
      }}
    >
      <h6 style={{ marginBottom: "0.5rem", fontSize: "0.95rem", fontWeight: "600" }}>
        {ofc.title}
      </h6>
      <p style={{ marginBottom: "0.5rem", fontSize: "0.875rem", color: "#1b1b1b" }}>
        {ofc.description}
      </p>
    </div>
  );

  return (
    <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2" }}>
      <h5 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: "600" }}>
        Options for Consideration
      </h5>

      {/* STEP 3: Render order - Baseline OFCs (no label) */}
      {baselineOfcs.map(renderOfc)}

      {/* STEP 3: Render order - Baseline Depth OFCs */}
      {baselineDepthOfcs.length > 0 && (
        <>
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2" }}>
            <h6 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: "600", color: "#71767a" }}>
              Additional Structural Considerations
            </h6>
            {baselineDepthOfcs.map(renderOfc)}
          </div>
        </>
      )}

      {/* STEP 3: Render order - Sector Depth OFCs */}
      {sectorDepthOfcs.length > 0 && (
        <>
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2" }}>
            <h6 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: "600", color: "#005ea2" }}>
              Sector-Specific Considerations
            </h6>
            {sectorDepthOfcs.map(renderOfc)}
          </div>
        </>
      )}

      {/* STEP 3: Render order - Subsector Depth OFCs */}
      {subsectorDepthOfcs.length > 0 && (
        <>
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #dfe1e2" }}>
            <h6 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: "600", color: "#005ea2" }}>
              Subsector-Specific Considerations
            </h6>
            {subsectorDepthOfcs.map(renderOfc)}
          </div>
        </>
      )}
    </div>
  );
}

