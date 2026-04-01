/**
 * Executive Graphics Renderers - SVG generation for report visualizations
 * 
 * All graphics are generated as inline SVG strings for embedded rendering in reports.
 * No external API dependencies; all rendering done in-process.
 */

import type { CurveSummary, EdgeVM } from './view_model';

/**
 * Color palette for consistency
 */
const COLORS = {
  electric: '#F59E0B', // Amber
  comms: '#3B82F6',    // Blue
  it: '#8B5CF6',       // Purple
  water: '#10B981',    // Green
  wastewater: '#6366F1', // Indigo
  
  severity: {
    IMMEDIATE: '#EF4444',    // Red
    SHORT_TERM: '#F59E0B',   // Amber
    DELAYED: '#10B981',      // Green
    STRATEGIC: '#6B7280',    // Gray
  },
  
  grid: '#E5E7EB',
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    muted: '#9CA3AF',
  },
  background: '#FFFFFF',
};

/**
 * Map infrastructure ID to display name
 */
function getInfraDisplayName(infra: string): string {
  const map: Record<string, string> = {
    ELECTRIC_POWER: 'Electric Power',
    COMMUNICATIONS: 'Communications',
    INFORMATION_TECHNOLOGY: 'IT/Data',
    WATER: 'Water',
    WASTEWATER: 'Wastewater',
  };
  return map[infra] || infra;
}

/**
 * Map infrastructure ID to color
 */
function getInfraColor(infra: string): string {
  const map: Record<string, string> = {
    ELECTRIC_POWER: COLORS.electric,
    COMMUNICATIONS: COLORS.comms,
    INFORMATION_TECHNOLOGY: COLORS.it,
    WATER: COLORS.water,
    WASTEWATER: COLORS.wastewater,
  };
  return map[infra] || COLORS.text.secondary;
}

/**
 * Generate combined impact curves overview (small multiples layout)
 * Returns SVG string
 */
export function renderCurveOverview(curves: CurveSummary[]): string {
  const width = 800;
  const height = 500;
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  
  // Calculate grid layout (2 rows x 3 cols for 5 infras)
  const cols = 3;
  const rows = 2;
  const chartWidth = (width - margin.left - margin.right) / cols - 10;
  const chartHeight = (height - margin.top - margin.bottom) / rows - 10;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${COLORS.background}"/>`;
  svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="${COLORS.text.primary}">Impact Curves Overview</text>`;
  
  curves.forEach((curve, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = margin.left + col * (chartWidth + 10);
    const y = margin.top + row * (chartHeight + 10);
    
    svg += renderSmallCurve(curve, x, y, chartWidth, chartHeight);
  });
  
  svg += '</svg>';
  return svg;
}

/**
 * Render a single small curve chart
 */
function renderSmallCurve(curve: CurveSummary, x: number, y: number, width: number, height: number): string {
  const color = getInfraColor(curve.infra);
  const name = getInfraDisplayName(curve.infra);
  
  // Use curve_points from payload when available (includes activation delay transition); else fallback to generateCurvePoints
  const points =
    curve.curve_points && curve.curve_points.length > 0
      ? curve.curve_points.map((p) => ({ time: p.hour, loss: p.loss_pct }))
      : generateCurvePoints(
          curve.time_to_impact_hr ?? 0,
          curve.loss_no_backup_pct ?? 0,
          curve.backup_available ?? false,
          curve.backup_duration_hr,
          curve.loss_with_backup_pct,
          curve.recovery_hr ?? 0
        );
  const maxTime = Math.max(...points.map((p) => p.time), 24);
  
  // Scale points to chart dimensions
  const scaleX = (t: number) => x + 5 + ((t / Math.max(maxTime, 24)) * (width - 10));
  const scaleY = (loss: number) => y + height - 20 - ((loss / 100) * (height - 30));
  
  let chartSvg = `<g>`;
  
  // Background
  chartSvg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.background}" stroke="${COLORS.grid}" stroke-width="1"/>`;
  
  // Title
  chartSvg += `<text x="${x + width / 2}" y="${y + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="${color}">${name}</text>`;
  
  // Axes
  chartSvg += `<line x1="${x + 5}" y1="${y + height - 20}" x2="${x + width - 5}" y2="${y + height - 20}" stroke="${COLORS.grid}" stroke-width="1"/>`;
  chartSvg += `<line x1="${x + 5}" y1="${y + 25}" x2="${x + 5}" y2="${y + height - 20}" stroke="${COLORS.grid}" stroke-width="1"/>`;
  
  // Axis labels
  chartSvg += `<text x="${x + width / 2}" y="${y + height - 3}" text-anchor="middle" font-size="9" fill="${COLORS.text.secondary}">Time (hr)</text>`;
  chartSvg += `<text x="${x + 8}" y="${y + 35}" font-size="9" fill="${COLORS.text.secondary}">Loss %</text>`;
  
  // Plot line
  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${scaleX(p.time)} ${scaleY(p.loss)}`
  ).join(' ');
  
  chartSvg += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2"/>`;
  
  // Severity badge
  const severityColor = COLORS.severity[curve.severity];
  chartSvg += `<rect x="${x + width - 45}" y="${y + 3}" width="40" height="12" rx="2" fill="${severityColor}"/>`;
  chartSvg += `<text x="${x + width - 25}" y="${y + 12}" text-anchor="middle" font-size="8" font-weight="600" fill="white">${curve.severity.slice(0, 3)}</text>`;
  
  chartSvg += `</g>`;
  return chartSvg;
}

/**
 * Generate curve points for visualization plotting.
 * 
 * NOTE: Curve data from buildCurveDeterministic is already numeric (0..100 range).
 * When consuming actual curve points, do NOT reformat or rescale;
 * use raw numeric values as-is. This function is for simplified demo generation only.
 */
function generateCurvePoints(
  timeToImpact: number,
  lossNoBackup: number,
  hasBackup: boolean,
  backupDuration?: number,
  lossWithBackup?: number,
  recovery?: number
): Array<{ time: number; loss: number }> {
  const points: Array<{ time: number; loss: number }> = [];
  
  // Start
  points.push({ time: 0, loss: 0 });
  
  // Ramp to impact
  points.push({ time: timeToImpact, loss: lossNoBackup });
  
  if (hasBackup && backupDuration && lossWithBackup !== undefined) {
    // With backup: reduced loss during backup window
    points.push({ time: timeToImpact + 0.1, loss: lossWithBackup });
    points.push({ time: timeToImpact + backupDuration, loss: lossWithBackup });
    
    // Backup exhausted
    points.push({ time: timeToImpact + backupDuration + 0.1, loss: lossNoBackup });
  }
  
  // Recovery phase
  const recoveryStart = hasBackup && backupDuration ? timeToImpact + backupDuration : timeToImpact;
  const recoveryTime = recovery || 24;
  points.push({ time: recoveryStart + recoveryTime * 0.3, loss: lossNoBackup * 0.7 });
  points.push({ time: recoveryStart + recoveryTime * 0.7, loss: lossNoBackup * 0.3 });
  points.push({ time: recoveryStart + recoveryTime, loss: 0 });
  
  return points;
}

/**
 * Generate dependency matrix/heatmap
 * Shows which infrastructures depend on which others
 */
export function renderDependencyMatrix(edges: EdgeVM[], infras: string[]): string {
  const size = 400;
  const cellSize = (size - 100) / infras.length;
  const margin = 80;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${COLORS.background}"/>`;
  svg += `<text x="${size / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="${COLORS.text.primary}">Cross-Dependency Matrix</text>`;
  
  // Column headers (rotated)
  infras.forEach((infra, i) => {
    const x = margin + i * cellSize + cellSize / 2;
    const y = margin - 10;
    const name = getInfraDisplayName(infra).split(' ')[0]; // abbreviate
    svg += `<text x="${x}" y="${y}" text-anchor="end" font-size="9" transform="rotate(-45 ${x} ${y})" fill="${COLORS.text.secondary}">${name}</text>`;
  });
  
  // Row headers
  infras.forEach((infra, i) => {
    const x = margin - 10;
    const y = margin + i * cellSize + cellSize / 2 + 3;
    const name = getInfraDisplayName(infra).split(' ')[0]; // abbreviate
    svg += `<text x="${x}" y="${y}" text-anchor="end" font-size="9" fill="${COLORS.text.secondary}">${name}</text>`;
  });
  
  // Draw grid
  for (let i = 0; i <= infras.length; i++) {
    const pos = margin + i * cellSize;
    svg += `<line x1="${margin}" y1="${pos}" x2="${margin + infras.length * cellSize}" y2="${pos}" stroke="${COLORS.grid}" stroke-width="0.5"/>`;
    svg += `<line x1="${pos}" y1="${margin}" x2="${pos}" y2="${margin + infras.length * cellSize}" stroke="${COLORS.grid}" stroke-width="0.5"/>`;
  }
  
  // Fill cells for confirmed edges
  edges.forEach(edge => {
    const fromIdx = infras.indexOf(edge.from);
    const toIdx = infras.indexOf(edge.to);
    
    if (fromIdx >= 0 && toIdx >= 0) {
      const x = margin + toIdx * cellSize;
      const y = margin + fromIdx * cellSize;
      const color = COLORS.severity[edge.timing_sensitivity || 'DELAYED'];
      
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" opacity="0.7"/>`;
      
      // Timing badge
      const badge = (edge.timing_sensitivity || 'D').charAt(0);
      svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 3}" text-anchor="middle" font-size="10" font-weight="bold" fill="white">${badge}</text>`;
    }
  });
  
  // Legend
  const legendY = margin + infras.length * cellSize + 30;
  svg += `<text x="${margin}" y="${legendY}" font-size="9" font-weight="600" fill="${COLORS.text.secondary}">Timing:</text>`;
  
  const legends = [
    { label: 'I=Immediate', color: COLORS.severity.IMMEDIATE },
    { label: 'S=Short-term', color: COLORS.severity.SHORT_TERM },
    { label: 'D=Delayed', color: COLORS.severity.DELAYED },
  ];
  
  legends.forEach((leg, i) => {
    const x = margin + 60 + i * 90;
    svg += `<rect x="${x}" y="${legendY - 8}" width="12" height="12" fill="${leg.color}"/>`;
    svg += `<text x="${x + 16}" y="${legendY}" font-size="8" fill="${COLORS.text.secondary}">${leg.label}</text>`;
  });
  
  svg += '</svg>';
  return svg;
}

/**
 * Generate dependency graph (node-edge diagram)
 * Simpler circular layout
 */
export function renderDependencyGraph(edges: EdgeVM[], infras: string[]): string {
  const width = 560;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;
  const nodeRadius = 30;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="${COLORS.background}"/>`;
  svg += `<text x="${centerX}" y="25" text-anchor="middle" font-size="13" font-weight="bold" fill="${COLORS.text.primary}">Cross-Infrastructure Dependency Graph</text>`;
  
  const orderedInfras = Array.from(new Set(infras.filter(Boolean)));
  const posMap = new Map<string, { x: number; y: number }>();

  // Calculate node positions (circular layout)
  const positions = orderedInfras.map((infra, i) => {
    const angle = (i / Math.max(orderedInfras.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const pos = {
      infra,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
    posMap.set(infra, { x: pos.x, y: pos.y });
    return pos;
  });

  const severityRank: Record<EdgeVM['timing_sensitivity'], number> = {
    IMMEDIATE: 4,
    SHORT_TERM: 3,
    DELAYED: 2,
    STRATEGIC: 1,
  };
  type AggEdge = {
    from: string;
    to: string;
    timing_sensitivity: EdgeVM['timing_sensitivity'];
    rationale?: string;
    count: number;
  };
  const aggMap = new Map<string, AggEdge>();
  for (const edge of edges) {
    if (!posMap.has(edge.from) || !posMap.has(edge.to)) continue;
    const key = `${edge.from}→${edge.to}`;
    const existing = aggMap.get(key);
    if (!existing) {
      aggMap.set(key, { ...edge, count: 1 });
      continue;
    }
    const currentRank = severityRank[existing.timing_sensitivity] ?? 0;
    const nextRank = severityRank[edge.timing_sensitivity] ?? 0;
    existing.count += 1;
    if (nextRank > currentRank) existing.timing_sensitivity = edge.timing_sensitivity;
    if (!existing.rationale && edge.rationale) existing.rationale = edge.rationale;
  }
  const aggregatedEdges = Array.from(aggMap.values());
  const hasEdge = (from: string, to: string) => aggMap.has(`${from}→${to}`);
  const pairSign = (from: string, to: string) => (from < to ? 1 : -1);

  svg += '<defs>';
  const severities: EdgeVM['timing_sensitivity'][] = ['IMMEDIATE', 'SHORT_TERM', 'DELAYED', 'STRATEGIC'];
  for (const sev of severities) {
    const markerId = `arrow-${sev}`;
    const color = COLORS.severity[sev];
    svg += `<marker id="${markerId}" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto" markerUnits="strokeWidth">`;
    svg += `<polygon points="0 0, 9 3.5, 0 7" fill="${color}"/>`;
    svg += '</marker>';
  }
  svg += '</defs>';
  
  // Draw edges first (so nodes appear on top)
  aggregatedEdges.forEach((edge) => {
    const from = posMap.get(edge.from);
    const to = posMap.get(edge.to);
    if (!from || !to) return;

    const color = COLORS.severity[edge.timing_sensitivity || 'DELAYED'];
    const markerId = `arrow-${edge.timing_sensitivity || 'DELAYED'}`;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;

    const startX = from.x + ux * nodeRadius;
    const startY = from.y + uy * nodeRadius;
    const endX = to.x - ux * nodeRadius;
    const endY = to.y - uy * nodeRadius;

    const reciprocal = hasEdge(edge.to, edge.from);
    const curveOffset = reciprocal ? 40 * pairSign(edge.from, edge.to) : 0;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const ctrlX = midX + nx * curveOffset;
    const ctrlY = midY + ny * curveOffset;

    const strokeWidth = 2 + Math.min(edge.count - 1, 2);
    const opacity = edge.timing_sensitivity === 'IMMEDIATE' ? 0.9 : 0.72;
    if (reciprocal) {
      svg += `<path d="M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" marker-end="url(#${markerId})" opacity="${opacity}"/>`;
    } else {
      svg += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="${strokeWidth}" marker-end="url(#${markerId})" opacity="${opacity}"/>`;
    }

    if (edge.count > 1) {
      const labelX = reciprocal ? (startX + 2 * ctrlX + endX) / 4 : midX;
      const labelY = reciprocal ? (startY + 2 * ctrlY + endY) / 4 : midY;
      svg += `<circle cx="${labelX}" cy="${labelY}" r="9" fill="${COLORS.background}" stroke="${color}" stroke-width="1.5"/>`;
      svg += `<text x="${labelX}" y="${labelY + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${color}">${edge.count}</text>`;
    }
  });
  
  // Draw nodes
  positions.forEach(pos => {
    const color = getInfraColor(pos.infra);
    const name = getInfraDisplayName(pos.infra);
    const shortName = name.split(' ')[0];
    
    // Node circle
    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeRadius}" fill="${color}" stroke="white" stroke-width="2"/>`;
    
    // Node label
    svg += `<text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" font-size="10" font-weight="600" fill="white">${shortName}</text>`;
  });

  // Legend
  const legendY = height - 16;
  svg += `<text x="22" y="${legendY}" font-size="9" font-weight="600" fill="${COLORS.text.secondary}">Edge timing:</text>`;
  const legendItems: Array<{ key: EdgeVM['timing_sensitivity']; label: string }> = [
    { key: 'IMMEDIATE', label: 'Immediate' },
    { key: 'SHORT_TERM', label: 'Short term' },
    { key: 'DELAYED', label: 'Delayed' },
    { key: 'STRATEGIC', label: 'Strategic' },
  ];
  legendItems.forEach((item, idx) => {
    const lx = 95 + idx * 105;
    const c = COLORS.severity[item.key];
    svg += `<line x1="${lx}" y1="${legendY - 3}" x2="${lx + 14}" y2="${legendY - 3}" stroke="${c}" stroke-width="2"/>`;
    svg += `<text x="${lx + 18}" y="${legendY}" font-size="8.5" fill="${COLORS.text.secondary}">${item.label}</text>`;
  });
  
  svg += '</svg>';
  return svg;
}
