#!/usr/bin/env tsx
/**
 * Overlay Wiring Check
 * 
 * Checks whether sector/subsector overlays are implemented and wired in psa_rebuild.
 * Produces evidence-based report on overlay implementation status.
 */

import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { ensureRuntimePoolConnected } from '../app/lib/db/runtime_client';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Clean up environment variables
if (process.env.SUPABASE_RUNTIME_URL) {
  process.env.SUPABASE_RUNTIME_URL = process.env.SUPABASE_RUNTIME_URL.trim().replace(/^\\+|\/+$/, '');
}
if (process.env.SUPABASE_RUNTIME_DB_PASSWORD) {
  process.env.SUPABASE_RUNTIME_DB_PASSWORD = process.env.SUPABASE_RUNTIME_DB_PASSWORD.trim().replace(/^\\+|\/+$/, '');
}

// ============================================================================
// Constants
// ============================================================================

const TABLE_PATTERNS = [
  '%sector%',
  '%subsector%',
  '%spine%',
  '%overlay%',
  '%required_elements%',
  'assessment%',
  'baseline_spines_runtime'
] as const;

const CODE_PATTERNS = [
  'sector',
  'subsector',
  'overlay',
  'sector_id',
  'subsector_id',
  'required_elements',
  'delta'
] as const;

const SCAN_DIRECTORIES = ['app/api', 'app/lib', 'app/admin'] as const;
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;
const SKIP_DIRECTORIES = ['node_modules', '.next', '.git'] as const;

const QUESTION_ENDPOINT_FILES = [
  'app/api/runtime/questions/route.ts',
  'app/api/runtime/assessments/[assessmentId]/questions/route.ts',
  'app/api/runtime/assessments/[assessmentId]/question-universe/route.ts'
] as const;

const SNIPPET_CONTEXT = 50; // Characters before/after pattern match
const MAX_COLUMNS = 30;
const MAX_FINDINGS_DISPLAY = {
  api: 20,
  lib: 10,
  admin: 10
} as const;

// ============================================================================
// Types
// ============================================================================

interface TableInfo {
  schema: string;
  table_name: string;
  row_count: number;
  columns: string[];
}

interface CodeFinding {
  file: string;
  line: number;
  snippet: string;
  pattern: string;
}

interface EndpointAnalysis {
  path: string;
  accepts_sector_subsector: boolean;
  reads_overlay_tables: boolean;
  evidence: string[];
}

interface CategorizedTables {
  reference_tables: TableInfo[];
  overlay_spine_tables: TableInfo[];
  assessment_tables: TableInfo[];
  all_candidate_tables: TableInfo[];
}

interface ConnectionInfo {
  host: string | null;
  database: string | null;
  port: number | null;
}

interface OverlayReport {
  generated_at: string;
  database: {
    connection_info: ConnectionInfo;
    tables: CategorizedTables;
  };
  code_analysis: {
    api_routes: CodeFinding[];
    lib_files: CodeFinding[];
    admin_files: CodeFinding[];
    all_findings: CodeFinding[];
  };
  api_endpoint_analysis: {
    question_endpoints: EndpointAnalysis[];
  };
  conclusion: 'A' | 'B' | 'C';
  conclusion_reason: string;
}

type Conclusion = { conclusion: 'A' | 'B' | 'C'; reason: string };

// ============================================================================
// Database Inspector
// ============================================================================

class DatabaseInspector {
  constructor(private pool: Pool) {}

  async getConnectionInfo(): Promise<ConnectionInfo> {
    try {
      const result = await this.pool.query(`
        SELECT 
          current_database() as database, 
          inet_server_addr() as host, 
          inet_server_port() as port
      `);
      const row = result.rows[0] || {};
      return {
        host: row.host || null,
        database: row.database || null,
        port: row.port || null
      };
    } catch (err) {
      console.warn('  ⚠ Could not get connection info:', err instanceof Error ? err.message : String(err));
      return { host: null, database: null, port: null };
    }
  }

  async discoverTables(): Promise<TableInfo[]> {
    const allTables: TableInfo[] = [];
    const seen = new Set<string>();

    for (const pattern of TABLE_PATTERNS) {
      try {
        const result = await this.pool.query(`
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name ILIKE $1
          ORDER BY table_name
        `, [pattern]);

        for (const row of result.rows) {
          const key = `${row.table_schema}.${row.table_name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const tableInfo = await this.getTableInfo(row.table_schema, row.table_name);
          if (tableInfo) {
            allTables.push(tableInfo);
          }
        }
      } catch (err) {
        console.warn(`  ⚠ Error querying pattern ${pattern}:`, err instanceof Error ? err.message : String(err));
      }
    }

    return allTables.sort((a, b) => a.table_name.localeCompare(b.table_name));
  }

  private async getTableInfo(schema: string, tableName: string): Promise<TableInfo | null> {
    try {
      const [rowCount, columns] = await Promise.all([
        this.getRowCount(schema, tableName),
        this.getColumns(schema, tableName)
      ]);

      return {
        schema,
        table_name: tableName,
        row_count: rowCount,
        columns
      };
    } catch (err) {
      console.warn(`  ⚠ Could not get info for ${schema}.${tableName}:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  private async getRowCount(schema: string, tableName: string): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*)::text as count
        FROM ${schema}.${tableName}
      `);
      return parseInt(String(result.rows[0].count), 10);
    } catch {
      return 0;
    }
  }

  private async getColumns(schema: string, tableName: string): Promise<string[]> {
    try {
      const result = await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
        ORDER BY ordinal_position
        LIMIT $3
      `, [schema, tableName, MAX_COLUMNS]);
      return result.rows.map((r: { column_name: string }) => r.column_name);
    } catch {
      return [];
    }
  }

  categorizeTables(tables: TableInfo[]): CategorizedTables {
    const reference_tables: TableInfo[] = [];
    const overlay_spine_tables: TableInfo[] = [];
    const assessment_tables: TableInfo[] = [];

    for (const table of tables) {
      const name = table.table_name.toLowerCase();

      if (this.isReferenceTable(name)) {
        reference_tables.push(table);
      }
      if (this.isOverlaySpineTable(name)) {
        overlay_spine_tables.push(table);
      }
      if (name.startsWith('assessment')) {
        assessment_tables.push(table);
      }
    }

    return {
      reference_tables,
      overlay_spine_tables,
      assessment_tables,
      all_candidate_tables: tables
    };
  }

  private isReferenceTable(name: string): boolean {
    return name === 'sectors' || 
           name === 'subsectors' || 
           (name.includes('sector') && (name.includes('reference') || name.includes('def')));
  }

  private isOverlaySpineTable(name: string): boolean {
    return (name.includes('sector') || name.includes('subsector') || name.includes('overlay')) &&
           name.includes('spine');
  }
}

// ============================================================================
// Code Scanner
// ============================================================================

class CodeScanner {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  scanForPatterns(patterns: readonly string[]): CodeFinding[] {
    const findings: CodeFinding[] = [];
    const seen = new Set<string>();

    this.scanDirectory(this.baseDir, '', patterns, findings, seen);

    return findings.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
  }

  private scanDirectory(
    dir: string,
    relativePath: string,
    patterns: readonly string[],
    findings: CodeFinding[],
    seen: Set<string>
  ): void {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        if (this.shouldSkip(entry)) continue;

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        const filePath = relativePath ? `${relativePath}/${entry}` : entry;

        if (stat.isDirectory()) {
          this.scanDirectory(fullPath, filePath, patterns, findings, seen);
        } else if (stat.isFile() && this.isTargetFile(filePath, entry)) {
          this.scanFile(fullPath, filePath, patterns, findings, seen);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  private shouldSkip(entry: string): boolean {
    return SKIP_DIRECTORIES.includes(entry as any) ||
           (entry.startsWith('.') && entry !== '.env.local');
  }

  private isTargetFile(filePath: string, entry: string): boolean {
    const ext = entry.substring(entry.lastIndexOf('.'));
    if (!FILE_EXTENSIONS.includes(ext as any)) return false;

    return SCAN_DIRECTORIES.some(dir => filePath.startsWith(dir));
  }

  private scanFile(
    fullPath: string,
    filePath: string,
    patterns: readonly string[],
    findings: CodeFinding[],
    seen: Set<string>
  ): void {
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        for (const pattern of patterns) {
          const lowerLine = line.toLowerCase();
          const lowerPattern = pattern.toLowerCase();

          if (lowerLine.includes(lowerPattern)) {
            const key = `${filePath}:${lineNum}:${pattern}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const snippet = this.extractSnippet(line, lowerPattern);
            findings.push({
              file: filePath,
              line: lineNum,
              snippet,
              pattern
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  private extractSnippet(line: string, pattern: string): string {
    const index = line.toLowerCase().indexOf(pattern);
    const start = Math.max(0, index - SNIPPET_CONTEXT);
    const end = Math.min(line.length, index + pattern.length + SNIPPET_CONTEXT);
    return line.substring(start, end).trim();
  }

  categorizeFindings(findings: CodeFinding[]): {
    api_routes: CodeFinding[];
    lib_files: CodeFinding[];
    admin_files: CodeFinding[];
  } {
    return {
      api_routes: findings.filter(f => f.file.startsWith('app/api')),
      lib_files: findings.filter(f => f.file.startsWith('app/lib')),
      admin_files: findings.filter(f => f.file.startsWith('app/admin'))
    };
  }
}

// ============================================================================
// Endpoint Analyzer
// ============================================================================

class EndpointAnalyzer {
  analyzeQuestionEndpoints(): EndpointAnalysis[] {
    const endpoints: EndpointAnalysis[] = [];

    for (const filePath of QUESTION_ENDPOINT_FILES) {
      const analysis = this.analyzeEndpoint(filePath);
      if (analysis) {
        endpoints.push(analysis);
      }
    }

    return endpoints;
  }

  private analyzeEndpoint(filePath: string): EndpointAnalysis | null {
    const fullPath = join(process.cwd(), filePath);
    
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      const evidence: string[] = [];
      let acceptsSectorSubsector = false;
      let readsOverlayTables = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        if (this.acceptsSectorSubsector(lower)) {
          acceptsSectorSubsector = true;
          evidence.push(`Line ${i + 1}: ${line.trim().substring(0, 100)}`);
        }

        if (this.readsOverlayTables(lower)) {
          readsOverlayTables = true;
          evidence.push(`Line ${i + 1}: ${line.trim().substring(0, 100)}`);
        }
      }

      return {
        path: filePath,
        accepts_sector_subsector: acceptsSectorSubsector,
        reads_overlay_tables: readsOverlayTables,
        evidence
      };
    } catch {
      return null;
    }
  }

  private acceptsSectorSubsector(line: string): boolean {
    return line.includes('sector_code') ||
           line.includes('subsector_code') ||
           line.includes('sector_id') ||
           line.includes('subsector_id');
  }

  private readsOverlayTables(line: string): boolean {
    return (line.includes('sector_spines') || line.includes('subsector_spines')) ||
           (line.includes('overlay') && line.includes('from'));
  }
}

// ============================================================================
// Conclusion Determiner
// ============================================================================

class ConclusionDeterminer {
  determine(
    tables: CategorizedTables,
    codeFindings: CodeFinding[],
    endpoints: EndpointAnalysis[]
  ): Conclusion {
    const hasReferenceTables = tables.reference_tables.length > 0 &&
      tables.reference_tables.some(t => t.row_count > 0);
    
    const hasOverlaySpineTables = tables.overlay_spine_tables.length > 0 &&
      tables.overlay_spine_tables.some(t => t.row_count > 0);
    
    const hasWiredEndpoints = endpoints.some(e => e.reads_overlay_tables);

    if (hasOverlaySpineTables && hasWiredEndpoints) {
      return {
        conclusion: 'A',
        reason: 'Overlay tables exist with rows AND API endpoints query them. Overlays are implemented and wired.'
      };
    }

    if (hasOverlaySpineTables || hasReferenceTables) {
      return {
        conclusion: 'B',
        reason: 'Overlay/reference tables exist but API endpoints do not query them. Overlays exist but are NOT wired.'
      };
    }

    return {
      conclusion: 'C',
      reason: 'No overlay spine tables found. Only baseline is active (baseline_spines_runtime).'
    };
  }
}

// ============================================================================
// Report Generator
// ============================================================================

class ReportGenerator {
  private readonly reportsDir: string;

  constructor() {
    this.reportsDir = join(process.cwd(), 'tools', 'reports');
    mkdirSync(this.reportsDir, { recursive: true });
  }

  generate(report: OverlayReport): void {
    const mdPath = join(this.reportsDir, 'overlay_wiring_report.md');
    const md = this.buildMarkdown(report);
    writeFileSync(mdPath, md, 'utf-8');
    console.log(`✓ Wrote report: ${mdPath}`);
  }

  private buildMarkdown(report: OverlayReport): string {
    const sections = [
      this.buildHeader(report),
      this.buildDatabaseSection(report),
      this.buildCodeAnalysisSection(report),
      this.buildEndpointAnalysisSection(report),
      this.buildConclusionSection(report)
    ];

    return sections.join('\n\n');
  }

  private buildHeader(report: OverlayReport): string {
    return `# Overlay Wiring Report

**Generated:** ${new Date(report.generated_at).toLocaleString()}

---`;
  }

  private buildDatabaseSection(report: OverlayReport): string {
    const { connection_info, tables } = report.database;

    return `## 1. Runtime DB: Table Existence + Counts

**Connection Info:**
- Host: ${connection_info.host || 'unknown'}
- Database: ${connection_info.database || 'unknown'}
- Port: ${connection_info.port || 'unknown'}

### Reference Tables (sectors/subsectors)

${this.formatTableSection(tables.reference_tables, ['Schema', 'Table Name', 'Row Count', 'Sample Columns'])}

### Overlay Spine Tables

${this.formatTableSection(tables.overlay_spine_tables, ['Schema', 'Table Name', 'Row Count', 'Sample Columns'])}

### Assessment Tables (with sector/subsector columns)

${this.formatAssessmentTables(tables.assessment_tables)}

### All Candidate Tables (by pattern match)

${this.formatAllTables(tables.all_candidate_tables)}`;
  }

  private formatTableSection(tables: TableInfo[], headers: string[]): string {
    if (tables.length === 0) {
      return '*No tables found.*';
    }

    const headerRow = `| ${headers.join(' | ')} |`;
    const separator = `|${headers.map(() => '---').join('|')}|`;
    const rows = tables.map(table => {
      const cols = table.columns.slice(0, 5);
      const colsStr = cols.join(', ') + (table.columns.length > 5 ? '...' : '');
      return `| ${table.schema} | ${table.table_name} | ${table.row_count} | ${colsStr} |`;
    });

    return [headerRow, separator, ...rows].join('\n');
  }

  private formatAssessmentTables(tables: TableInfo[]): string {
    const withSector = tables.filter(t =>
      t.columns.some(c => c.toLowerCase().includes('sector'))
    );

    if (withSector.length === 0) {
      return '*No assessment tables with sector/subsector columns found.*';
    }

    const headerRow = '| Schema | Table Name | Row Count | Sector-Related Columns |';
    const separator = '|--------|------------|-----------|----------------------|';
    const rows = withSector.map(table => {
      const sectorCols = table.columns.filter(c => c.toLowerCase().includes('sector'));
      return `| ${table.schema} | ${table.table_name} | ${table.row_count} | ${sectorCols.join(', ')} |`;
    });

    return [headerRow, separator, ...rows].join('\n');
  }

  private formatAllTables(tables: TableInfo[]): string {
    const headerRow = '| Schema | Table Name | Row Count | Columns |';
    const separator = '|--------|------------|-----------|---------|';
    const rows = tables.map(table =>
      `| ${table.schema} | ${table.table_name} | ${table.row_count} | ${table.columns.length} columns |`
    );

    return [headerRow, separator, ...rows].join('\n');
  }

  private buildCodeAnalysisSection(report: OverlayReport): string {
    const { api_routes, lib_files, admin_files } = report.code_analysis;

    return `## 2. Code Wiring: API Usage

### API Routes (app/api)

${this.formatFindings(api_routes, MAX_FINDINGS_DISPLAY.api)}

### Library Files (app/lib)

${this.formatFindings(lib_files, MAX_FINDINGS_DISPLAY.lib)}

### Admin Files (app/admin)

${this.formatFindings(admin_files, MAX_FINDINGS_DISPLAY.admin)}`;
  }

  private formatFindings(findings: CodeFinding[], maxDisplay: number): string {
    if (findings.length === 0) {
      return '*No overlay-related code found.*';
    }

    const displayed = findings.slice(0, maxDisplay);
    const lines = [
      `Found ${findings.length} occurrences:`,
      '',
      ...displayed.map(f => `- **${f.file}:${f.line}** (pattern: \`${f.pattern}\`)`),
      ...displayed.map(f => `  \`${f.snippet}\``),
      ''
    ];

    if (findings.length > maxDisplay) {
      lines.push(`*... and ${findings.length - maxDisplay} more occurrences*`);
    }

    return lines.join('\n');
  }

  private buildEndpointAnalysisSection(report: OverlayReport): string {
    const { question_endpoints } = report.api_endpoint_analysis;

    const headerRow = '| Endpoint | Accepts Sector/Subsector | Reads Overlay Tables | Evidence |';
    const separator = '|----------|-------------------------|---------------------|----------|';
    const rows = question_endpoints.map(endpoint => {
      const accepts = endpoint.accepts_sector_subsector ? '✅ Yes' : '❌ No';
      const reads = endpoint.reads_overlay_tables ? '✅ Yes' : '❌ No';
      const evidence = endpoint.evidence.length > 0
        ? endpoint.evidence[0].substring(0, 80) + '...'
        : 'None';
      return `| ${endpoint.path} | ${accepts} | ${reads} | ${evidence} |`;
    });

    return `## 3. API Endpoint Analysis

### Question Endpoints

${[headerRow, separator, ...rows].join('\n')}`;
  }

  private buildConclusionSection(report: OverlayReport): string {
    const conclusionLabels = {
      A: '✅ Overlays exist + wired',
      B: '⚠️ Overlays exist but NOT wired',
      C: '❌ Overlays do not exist (baseline only)'
    };

    const { database, code_analysis, api_endpoint_analysis } = report;
    const wiredCount = api_endpoint_analysis.question_endpoints.filter(e => e.reads_overlay_tables).length;

    return `## 4. Conclusion

**Result: ${conclusionLabels[report.conclusion]}**

${report.conclusion_reason}

### Evidence Summary

- Reference tables found: ${database.tables.reference_tables.length}
- Overlay spine tables found: ${database.tables.overlay_spine_tables.length}
- Code occurrences found: ${code_analysis.all_findings.length}
- Endpoints querying overlays: ${wiredCount}`;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('Overlay Wiring Check');
    console.log('='.repeat(80));
    console.log();

    // Connect to database
    console.log('Connecting to runtime database...');
    const pool = await ensureRuntimePoolConnected();
    console.log('✓ Database connected');

    // Initialize components
    const dbInspector = new DatabaseInspector(pool);
    const codeScanner = new CodeScanner(process.cwd());
    const endpointAnalyzer = new EndpointAnalyzer();
    const conclusionDeterminer = new ConclusionDeterminer();
    const reportGenerator = new ReportGenerator();

    // Gather data
    console.log('\nDiscovering tables...');
    const connectionInfo = await dbInspector.getConnectionInfo();
    const allTables = await dbInspector.discoverTables();
    const categorizedTables = dbInspector.categorizeTables(allTables);
    console.log(`✓ Found ${allTables.length} candidate tables`);
    console.log(`  - Reference tables: ${categorizedTables.reference_tables.length}`);
    console.log(`  - Overlay spine tables: ${categorizedTables.overlay_spine_tables.length}`);
    console.log(`  - Assessment tables: ${categorizedTables.assessment_tables.length}`);

    console.log('\nScanning code...');
    const allFindings = codeScanner.scanForPatterns(CODE_PATTERNS);
    const categorizedFindings = codeScanner.categorizeFindings(allFindings);
    console.log(`✓ Found ${allFindings.length} code occurrences`);
    console.log(`  - API routes: ${categorizedFindings.api_routes.length}`);
    console.log(`  - Library files: ${categorizedFindings.lib_files.length}`);
    console.log(`  - Admin files: ${categorizedFindings.admin_files.length}`);

    console.log('\nAnalyzing question endpoints...');
    const endpoints = endpointAnalyzer.analyzeQuestionEndpoints();
    console.log(`✓ Analyzed ${endpoints.length} endpoints`);

    // Determine conclusion
    const conclusion = conclusionDeterminer.determine(
      categorizedTables,
      allFindings,
      endpoints
    );

    // Build and write report
    const report: OverlayReport = {
      generated_at: new Date().toISOString(),
      database: {
        connection_info: connectionInfo,
        tables: categorizedTables
      },
      code_analysis: {
        ...categorizedFindings,
        all_findings: allFindings
      },
      api_endpoint_analysis: {
        question_endpoints: endpoints
      },
      conclusion: conclusion.conclusion,
      conclusion_reason: conclusion.reason
    };

    console.log('\nWriting report...');
    reportGenerator.generate(report);

    console.log('\n' + '='.repeat(80));
    console.log('✓ Overlay wiring check complete!');
    console.log('='.repeat(80));
    const conclusionLabels = {
      A: '✅ Overlays exist + wired',
      B: '⚠️ Overlays exist but NOT wired',
      C: '❌ Overlays do not exist (baseline only)'
    };
    console.log(`\nConclusion: ${conclusionLabels[conclusion.conclusion]}`);
    console.log(`Reason: ${conclusion.reason}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

main();
