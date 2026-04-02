// STABLE: OFC depth hierarchy rendering
// Changes require doctrine or backend contract change.
// Do not modify during baseline burn-down.

"use client";

import { groupOfcsByDepth } from "@/lib/groupOfcsByDepth";

/**
 * Report OFCs Component
 * 
 * Renders OFCs in reports/PDF output using the same hierarchy as assessment UI.
 * 
 * Rendering order:
 * 1. Baseline OFCs (no label)
 * 2. Baseline Depth OFCs ("Additional Structural Considerations")
 * 3. Sector Depth OFCs ("Sector-Specific Considerations")
 * 4. Subsector Depth OFCs ("Subsector-Specific Considerations")
 * 
 * Uses shared grouping utility to ensure consistency with assessment UI.
 */
interface ReportOFCsProps {
  ofcs: any[];
}

export default function ReportOFCs({ ofcs }: ReportOFCsProps) {
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

  // Render OFC as list item (for PDF/print)
  // Ensure proper line wrapping for PDF export
  const renderOfcItem = (ofc: any, idx: number) => (
    <li 
      key={ofc.ofc_code || idx} 
      style={{ 
        marginBottom: "0.5rem", 
        lineHeight: "1.5",
        wordWrap: "break-word",
        overflowWrap: "break-word"
      }}
    >
      <strong>{ofc.title}:</strong> {ofc.description}
    </li>
  );

  return (
    <div 
      style={{ 
        marginTop: "1rem", 
        paddingTop: "0.75rem", 
        borderTop: "1px solid #dfe1e2",
        pageBreakInside: "avoid" // Prevent page breaks inside OFC section
      }}
    >
      <h5 style={{ marginBottom: "0.5rem", fontSize: "0.95rem", fontWeight: "600" }}>
        Options for Consideration
      </h5>

      {/* Baseline OFCs (no label) */}
      {baselineOfcs.length > 0 && (
        <ul style={{ marginLeft: "1.5rem", marginBottom: baselineDepthOfcs.length > 0 || sectorDepthOfcs.length > 0 || subsectorDepthOfcs.length > 0 ? "1rem" : "0", padding: 0, listStyleType: "disc" }}>
          {baselineOfcs.map(renderOfcItem)}
        </ul>
      )}

      {/* Baseline Depth OFCs */}
      {baselineDepthOfcs.length > 0 && (
        <div style={{ marginTop: baselineOfcs.length > 0 ? "1rem" : "0", marginLeft: "0.5rem" }}>
          <h6 style={{ marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#71767a" }}>
            Additional Structural Considerations
          </h6>
          <ul style={{ marginLeft: "1.5rem", marginBottom: sectorDepthOfcs.length > 0 || subsectorDepthOfcs.length > 0 ? "1rem" : "0", padding: 0, listStyleType: "disc" }}>
            {baselineDepthOfcs.map(renderOfcItem)}
          </ul>
        </div>
      )}

      {/* Sector Depth OFCs */}
      {sectorDepthOfcs.length > 0 && (
        <div style={{ marginTop: baselineOfcs.length > 0 || baselineDepthOfcs.length > 0 ? "1rem" : "0", marginLeft: "0.5rem" }}>
          <h6 style={{ marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#005ea2" }}>
            Sector-Specific Considerations
          </h6>
          <ul style={{ marginLeft: "1.5rem", marginBottom: subsectorDepthOfcs.length > 0 ? "1rem" : "0", padding: 0, listStyleType: "disc" }}>
            {sectorDepthOfcs.map(renderOfcItem)}
          </ul>
        </div>
      )}

      {/* Subsector Depth OFCs */}
      {subsectorDepthOfcs.length > 0 && (
        <div style={{ marginTop: baselineOfcs.length > 0 || baselineDepthOfcs.length > 0 || sectorDepthOfcs.length > 0 ? "1rem" : "0", marginLeft: "0.5rem" }}>
          <h6 style={{ marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#005ea2" }}>
            Subsector-Specific Considerations
          </h6>
          <ul style={{ marginLeft: "1.5rem", padding: 0, listStyleType: "disc" }}>
            {subsectorDepthOfcs.map(renderOfcItem)}
          </ul>
        </div>
      )}
    </div>
  );
}

