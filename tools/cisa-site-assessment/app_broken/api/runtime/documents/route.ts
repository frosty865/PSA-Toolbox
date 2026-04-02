import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    
    const query = `
      SELECT DISTINCT ON (cr.document_id)
        cr.document_id,
        cr.raw_payload->>'source_document' as filename,
        cr.ingested_at,
        (cr.raw_payload->>'coverage_percent')::numeric as latest_coverage_percent,
        (cr.raw_payload->>'disciplines_covered')::integer as disciplines_covered,
        (cr.raw_payload->>'disciplines_total')::integer as disciplines_total,
        cr.raw_payload->>'schema_version' as schema_version
      FROM coverage_runs cr
      WHERE cr.raw_payload->>'schema_version' = 'phase2_coverage.v1'
      ORDER BY cr.document_id, cr.ingested_at DESC
    `;

    const result = await pool.query(query);
    
    const documents = result.rows.map(row => ({
      document_id: row.document_id,
      filename: row.filename || 'Unknown',
      ingested_at: row.ingested_at,
      latest_coverage_percent: row.latest_coverage_percent ? parseFloat(row.latest_coverage_percent) : null,
      disciplines_covered: row.disciplines_covered ? parseInt(row.disciplines_covered) : null,
      disciplines_total: row.disciplines_total ? parseInt(row.disciplines_total) : null,
      schema_version: row.schema_version || 'phase2_coverage.v1',
    }));

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

