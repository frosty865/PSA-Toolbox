/**
 * Report Block Composer - Converts ReportVM to Report Blocks
 * Section order and numbers from REPORT_SECTIONS (canonical); TOC and body use same source.
 * NO VOFC TABLES - all content is narrative with analytical considerations.
 */

import type { ReportVM } from './view_model';
import { REPORT_SECTIONS, getSectionNumber, getAppendixSubLabel } from './report_sections';
import type { ReportBlock } from './blocks';
import {
  heading,
  paragraph,
  bulletList,
  figure,
  callout,
  separator,
  pageBreak,
  tableSimple,
} from './blocks';
import {
  renderCurveOverview,
  renderDependencyMatrix,
  renderDependencyGraph,
} from './graphics';
import { formatInlineCitations, compileCitations, CITATION_REGISTRY_VERSION } from './citations/registry';
import type { ExecutiveRiskPostureSnapshotVM } from './snapshot_builder';
import { formatHours } from './format_hours';

/**
 * Compose blocks from Executive Risk Posture Snapshot.
 * 
 * Renders:
 * - Overall Posture banner
 * - Driver summaries (callouts)
 * - Infrastructure sensitivity matrix (as list)
 * - Cascading indicator (if present)
 */
function composeSnapshotBlocks(snapshot: ExecutiveRiskPostureSnapshotVM): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  // Overall posture statement
  blocks.push(paragraph(`**Overall Risk Posture:** ${snapshot.overallPosture}`));

  // Key drivers
  if (snapshot.drivers.length > 0) {
    blocks.push(paragraph('**Key Risk Drivers:**'));
    snapshot.drivers.forEach((driver) => {
      const severity = driver.severity === 'HIGH' ? 'immediate' : driver.severity === 'ELEVATED' ? 'short-term' : 'info';
      blocks.push(callout(
        driver.title,
        `${driver.shortSummary} Affects: ${driver.infrastructures.join(', ')}`,
        { severity }
      ));
    });
  }

  // Infrastructure sensitivity matrix (as narrative table)
  if (snapshot.infraMatrix.length > 0) {
    blocks.push(paragraph('**Infrastructure Sensitivity Matrix:**'));
    const matrixRows = snapshot.infraMatrix.map((row) => ({
      label: `${row.infra}`,
      value: `Impact: ${row.impactSensitivity} | Mitigation: ${row.mitigationDepth} | Recovery: ${row.recoverySensitivity} | Cascade: ${row.cascadeExposure}`,
    }));
    blocks.push(tableSimple(matrixRows, { compact: true }));
  }

  // Cascading indicator
  if (snapshot.cascadingIndicator) {
    blocks.push(paragraph(`**Cross-Infrastructure Exposure:** ${snapshot.cascadingIndicator.summary}`));
  }

  return blocks;
}

/**
 * Main composer: ReportVM -> Blocks
 */
export function composeReportBlocks(vm: ReportVM): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const usedCitationKeys: string[] = [];
  
  // Track citations as we build blocks
  const trackCitations = (keys?: string[]) => {
    if (keys && keys.length > 0) {
      usedCitationKeys.push(...keys);
    }
  };
  
  // ========== SECTION 1: EXECUTIVE IMPACT OVERVIEW ==========
  const sec1Num = getSectionNumber(0);
  blocks.push(heading(1, REPORT_SECTIONS[0].title, { number: sec1Num, pageBreakBefore: true }));
  
  blocks.push(paragraph(vm.executive.purpose_scope || 'This report assesses asset dependency vulnerabilities and infrastructure resilience posture.'));

  // Executive Risk Posture Snapshot: 3-paragraph narrative only (no driver labels, no matrix)
  const executiveNarrative = vm.executive.executive_risk_posture_narrative;
  const hasExecutiveSnapshot = (executiveNarrative?.length ?? 0) > 0 || !!vm.executive.risk_posture_snapshot;
  if (executiveNarrative && executiveNarrative.length > 0) {
    blocks.push(heading(2, 'Executive Risk Posture Snapshot', { number: '1.1' }));
    executiveNarrative.forEach((p) => blocks.push(paragraph(p)));
  } else if (vm.executive.risk_posture_snapshot) {
    blocks.push(heading(2, 'Executive Risk Posture Snapshot', { number: '1.1' }));
    blocks.push(paragraph('The following snapshot synthesizes key risk drivers, infrastructure sensitivity, and cascading exposure indicators.'));
    blocks.push(...composeSnapshotBlocks(vm.executive.risk_posture_snapshot));
  }

  // Curve overview graphic
  if (vm.executive.curve_summaries.length > 0) {
    const curveHeadingNum = hasExecutiveSnapshot ? `${sec1Num}.2` : `${sec1Num}.1`;
    const figureNum = hasExecutiveSnapshot ? `Figure ${sec1Num}-2` : `Figure ${sec1Num}-1`;
    blocks.push(heading(2, 'Impact Curves', { number: curveHeadingNum }));
    blocks.push(paragraph('The following charts illustrate operational loss over time for each critical infrastructure dependency. Impact severity is categorized by time-to-impact threshold.'));
    
    const curveSvg = renderCurveOverview(vm.executive.curve_summaries);
    blocks.push(figure('curve_overview', curveSvg, {
      caption: `${figureNum}: Infrastructure Impact Curves Overview`,
      alt: 'Combined impact curves showing operational loss over time for all infrastructures',
      size: 'full-width',
    }));
  }
  
  // Key risk drivers (infographic-style)
  if (vm.executive.key_risk_drivers.length > 0) {
    const driverHeadingNum = hasExecutiveSnapshot ? `${sec1Num}.3` : `${sec1Num}.2`;
    blocks.push(heading(2, 'Key Risk Drivers', { number: driverHeadingNum }));
    blocks.push(paragraph('The following risk drivers represent the most critical vulnerabilities identified across all infrastructures:'));
    
    vm.executive.key_risk_drivers.forEach((driver, idx) => {
      // Map severity to callout severity
      const calloutSeverity = driver.severity === 'HIGH' ? 'immediate' : driver.severity === 'ELEVATED' ? 'short-term' : 'info';
      
      blocks.push(callout(
        driver.title,
        driver.narrative,
        {
          severity: calloutSeverity,
        }
      ));
    });
  }
  
  // Cross-dependency overview
  if (vm.executive.cross_dependency_overview.confirmed_edges.length > 0) {
    const cdHeadingNum = hasExecutiveSnapshot ? `${sec1Num}.4` : `${sec1Num}.3`;
    const matrixFigureNum = hasExecutiveSnapshot ? `Figure ${sec1Num}-3` : `Figure ${sec1Num}-2`;
    const graphFigureNum = hasExecutiveSnapshot ? `Figure ${sec1Num}-4` : `Figure ${sec1Num}-3`;
    
    blocks.push(heading(2, 'Cross-Dependency Overview', { number: cdHeadingNum }));
    blocks.push(paragraph('Infrastructure dependencies create cascading risk pathways. The following visualizations identify confirmed dependencies and timing sensitivities.'));
    
    const infras = Array.from(new Set([
      ...vm.executive.cross_dependency_overview.confirmed_edges.map(e => e.from),
      ...vm.executive.cross_dependency_overview.confirmed_edges.map(e => e.to),
    ]));
    
    // Matrix
    const matrixSvg = renderDependencyMatrix(vm.executive.cross_dependency_overview.confirmed_edges, infras);
    blocks.push(figure('dependency_matrix', matrixSvg, {
      caption: `${matrixFigureNum}: Cross-Dependency Matrix`,
      alt: 'Matrix showing infrastructure dependencies and timing sensitivities',
      size: 'large',
    }));
    
    // Optional: Dependency graph
    if (vm.executive.cross_dependency_overview.confirmed_edges.length > 2) {
      const graphSvg = renderDependencyGraph(vm.executive.cross_dependency_overview.confirmed_edges, infras);
      blocks.push(figure('dependency_graph', graphSvg, {
        caption: `${graphFigureNum}: Dependency Graph`,
        alt: 'Node-edge graph showing directional dependencies',
        size: 'large',
      }));
    }
  }
  
  blocks.push(separator());
  
  // ========== SECTIONS 2-6: INFRASTRUCTURE ASSESSMENTS (canonical order) ==========
  vm.infrastructures.forEach((infra, idx) => {
    const sectionNumber = getSectionNumber(idx + 1);
    
    blocks.push(pageBreak());
    blocks.push(heading(1, infra.display_name, { number: sectionNumber, pageBreakBefore: false }));
    
    // Optional intro
    if (infra.intro) {
      blocks.push(heading(2, infra.intro.title || 'Overview', { number: `${sectionNumber}.1` }));
      blocks.push(paragraph(infra.intro.purpose));
    }
    
    // Impact summary
    blocks.push(heading(2, 'Impact Summary', { number: `${sectionNumber}.2` }));
    
    const curve = infra.curve;
    const timeStr = typeof curve.time_to_impact_hr === 'number' ? formatHours(curve.time_to_impact_hr) : '—';
    const lossStr = typeof curve.loss_no_backup_pct === 'number' ? `${curve.loss_no_backup_pct}%` : '—';
    const recoveryStr = typeof curve.recovery_hr === 'number' ? formatHours(curve.recovery_hr) : '—';
    const backupSentence = curve.backup_available && typeof curve.loss_with_backup_pct === 'number' && typeof curve.backup_duration_hr === 'number'
      ? `Backup systems can reduce loss to ${curve.loss_with_backup_pct}% for up to ${formatHours(curve.backup_duration_hr)}.`
      : curve.backup_available
        ? 'Backup capability is present.'
        : 'No backup capability is currently available.';
    const impactText = `This infrastructure exhibits **${curve.severity}** impact characteristics with a time-to-impact of ${timeStr} and ${lossStr} operational loss without backup capability. ${backupSentence} Recovery time is estimated at ${recoveryStr}.`;
    
    blocks.push(paragraph(impactText));
    
    // Vulnerabilities (replaces Structural Findings + Analytical Considerations)
    const vulns = infra.vulnerabilities ?? [];
    if (vulns.length > 0) {
      blocks.push(heading(2, 'Vulnerabilities', { number: `${sectionNumber}.3` }));
      
      vulns.forEach((vuln, vulnIdx) => {
        blocks.push(heading(3, vuln.title, { number: `${sectionNumber}.3.${vulnIdx + 1}` }));
        blocks.push(paragraph(vuln.summary));
        
        if (vuln.ofcs && vuln.ofcs.length > 0) {
          blocks.push(paragraph('Options for Consideration:', { indent: 0 }));
          vuln.ofcs.slice(0, 3).forEach((ofc) => {
            blocks.push(paragraph(`• **${ofc.title}**: ${ofc.text}`, { indent: 1 }));
          });
        }
      });
    }
    
    // Sensitivity summary
    if (infra.sensitivity_summary) {
      blocks.push(heading(2, 'Dependency Sensitivity', { number: `${sectionNumber}.5` }));
      blocks.push(paragraph(infra.sensitivity_summary));
    }
    
    blocks.push(separator());
  });
  
  // ========== SECTION 7: CROSS-DEPENDENCY & CASCADING RISK ==========
  const sec7Num = getSectionNumber(6);
  blocks.push(pageBreak());
  blocks.push(heading(1, REPORT_SECTIONS[6].title, { number: sec7Num }));
  
  blocks.push(paragraph('Cross-infrastructure dependencies amplify risk through cascading failure pathways. This section identifies confirmed edges and conditions that may accelerate or compound disruption.'));
  
  // Confirmed edges
  if (vm.cross_dependency.confirmed_edges && vm.cross_dependency.confirmed_edges.length > 0) {
    blocks.push(heading(2, 'Confirmed Dependencies', { number: `${sec7Num}.1` }));
    
    vm.cross_dependency.confirmed_edges.forEach(edge => {
      const edgeText = `**${edge.from} → ${edge.to}**: ${edge.timing_sensitivity} timing sensitivity${edge.rationale ? ` — ${edge.rationale}` : ''}.`;
      blocks.push(paragraph(edgeText, { indent: 0 }));
    });
  }
  
  // Cascading conditions
  if (vm.cross_dependency.cascading_conditions && vm.cross_dependency.cascading_conditions.length > 0) {
    blocks.push(heading(2, 'Cascading Conditions', { number: `${sec7Num}.2` }));
    
    vm.cross_dependency.cascading_conditions.forEach((condition, idx) => {
      blocks.push(heading(3, condition.title, { number: `${sec7Num}.2.${idx + 1}` }));
      
      const citationKeys = condition.citations?.map(c => typeof c === 'string' ? c : c.key) || [];
      const citationText = citationKeys.length > 0 
        ? ` ${formatInlineCitations(citationKeys)}`
        : '';
      blocks.push(paragraph(condition.narrative + citationText));
      trackCitations(citationKeys);
    });
  }
  
  // Module findings (if enabled)
  if (vm.cross_dependency.module_findings && vm.cross_dependency.module_findings.length > 0) {
    blocks.push(heading(2, 'Module-Specific Findings', { number: `${sec7Num}.3` }));
    
    vm.cross_dependency.module_findings.forEach((modFinding, idx) => {
      blocks.push(heading(3, `${modFinding.module_name}: ${modFinding.title}`, { number: `${sec7Num}.3.${idx + 1}` }));
      
      const citationKeys = modFinding.citations?.map(c => typeof c === 'string' ? c : c.key) || [];
      const citationText = citationKeys.length > 0 
        ? ` ${formatInlineCitations(citationKeys)}`
        : '';
      blocks.push(paragraph(modFinding.narrative + citationText));
      trackCitations(citationKeys);
    });
  }
  
  // Analytical Considerations for cross-dep
  if (vm.cross_dependency.analytical_considerations.length > 0) {
    blocks.push(heading(2, 'Analytical Considerations', { number: `${sec7Num}.4` }));
    
    vm.cross_dependency.analytical_considerations.forEach((consideration, considIdx) => {
      blocks.push(heading(3, consideration.heading, { number: `${sec7Num}.4.${considIdx + 1}` }));
      
      consideration.paragraphs.forEach(para => {
        const citationKeys = para.citations?.map(c => typeof c === 'string' ? c : c.key) || [];
        const citationText = citationKeys.length > 0 
          ? ` ${formatInlineCitations(citationKeys)}`
          : '';
        blocks.push(paragraph(para.text + citationText, { indent: 0 }));
        trackCitations(citationKeys);
      });
    });
  }
  
  blocks.push(separator());
  
  // ========== SECTION 8: RISK POSTURE SYNTHESIS ==========
  const sec8Num = getSectionNumber(7);
  blocks.push(pageBreak());
  blocks.push(heading(1, vm.synthesis.heading || REPORT_SECTIONS[7].title, { number: sec8Num }));
  
  vm.synthesis.sections.forEach((section, idx) => {
    blocks.push(heading(2, section.heading, { number: `${sec8Num}.${idx + 1}` }));
    section.paragraphs.forEach(para => {
      const citationKeys = para.citations?.map(c => typeof c === 'string' ? c : c.key) || [];
      const citationText = citationKeys.length > 0 
        ? ` ${formatInlineCitations(citationKeys)}`
        : '';
      blocks.push(paragraph(para.text + citationText));
      trackCitations(citationKeys);
    });
  });
  
  blocks.push(separator());
  
  // ========== SECTION 9: METHODOLOGY ==========
  const sec9Num = getSectionNumber(8);
  blocks.push(pageBreak());
  blocks.push(heading(1, REPORT_SECTIONS[8].title, { number: sec9Num }));
  
  vm.methodology.sections.forEach((section, idx) => {
    blocks.push(heading(2, section.heading, { number: `${sec9Num}.${idx + 1}` }));
    section.paragraphs.forEach(para => {
      blocks.push(paragraph(para));
    });
  });
  
  blocks.push(separator());
  
  // ========== SECTION 10: APPENDICES ==========
  const sec10Num = getSectionNumber(9);
  blocks.push(pageBreak());
  blocks.push(heading(1, REPORT_SECTIONS[9].title, { number: sec10Num }));
  
  blocks.push(heading(2, `Appendix ${getAppendixSubLabel(0).split('.')[1]}: Impact Curve Inputs`, { number: getAppendixSubLabel(0) }));
  blocks.push(paragraph('The following tables document the quantitative inputs used to generate infrastructure impact curves:'));
  
  vm.appendices.curve_inputs.forEach(curveInput => {
    blocks.push(heading(3, curveInput.infra, { number: undefined }));
    blocks.push(tableSimple(curveInput.items, { compact: true }));
  });
  
  blocks.push(heading(2, `Appendix ${getAppendixSubLabel(1).split('.')[1]}: References & Citations`, { number: getAppendixSubLabel(1) }));
  blocks.push(paragraph('The following authoritative sources were referenced in this assessment:'));
  
  if (process.env.NODE_ENV !== 'production' && CITATION_REGISTRY_VERSION !== 'v1') {
    throw new Error(`Wrong citation registry: expected v1, got ${CITATION_REGISTRY_VERSION}`);
  }
  const compiledCitations = compileCitations(usedCitationKeys);
  
  // Group by org
  const citationsByOrg = compiledCitations.reduce((acc, cit) => {
    if (!acc[cit.org]) acc[cit.org] = [];
    acc[cit.org].push(cit);
    return acc;
  }, {} as Record<string, typeof compiledCitations>);
  
  Object.entries(citationsByOrg).forEach(([org, citations]) => {
    blocks.push(heading(3, org, { number: undefined }));
    
    const items = citations.map(cit => ({ text: cit.full }));
    blocks.push(bulletList(items));
  });
  
  if (vm.appendices.dependency_graph && vm.appendices.dependency_graph.nodes.length > 0) {
    blocks.push(heading(2, `Appendix ${getAppendixSubLabel(2).split('.')[1]}: Dependency Graph`, { number: getAppendixSubLabel(2) }));
    blocks.push(paragraph('The following diagram illustrates infrastructure dependencies as a directed graph:'));
    
    const graphData = vm.appendices.dependency_graph;
    const infras = graphData.nodes.map(n => n.id);
    const edges = graphData.edges.map(e => ({
      from: e.from,
      to: e.to,
      timing_sensitivity: ('DELAYED' as const),
      rationale: e.label,
    }));
    
    const graphSvg = renderDependencyGraph(edges, infras);
    blocks.push(figure('dependency_graph', graphSvg, {
      caption: 'Appendix C: Infrastructure Dependency Graph',
      alt: 'Detailed dependency graph showing all infrastructure relationships',
      size: 'full-width',
    }));
  }
  
  if (vm.appendices.module_summaries && vm.appendices.module_summaries.length > 0) {
    blocks.push(heading(2, `Appendix ${getAppendixSubLabel(3).split('.')[1]}: Module Summaries`, { number: getAppendixSubLabel(3) }));
    
    vm.appendices.module_summaries.forEach((modSum, idx) => {
      blocks.push(heading(3, modSum.name, { number: undefined }));
      blocks.push(paragraph(modSum.summary));
    });
  }
  
  return blocks;
}
