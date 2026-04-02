export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SUBSECTOR_SCHEMAS } from "@/app/lib/config/subsector_field_schemas";
import { getRuntimePool } from '@/app/lib/db/runtime_client';

// Modules are now loaded from database (assessment_modules table)

export async function GET() {
  try {
    const pool = getRuntimePool();

    // Verify which database we're connected to
    const dbInfoResult = await pool.query(`
      SELECT current_database() as db_name, 
             inet_server_addr() as server_addr,
             inet_server_port() as server_port
    `);
    const dbInfo = dbInfoResult.rows[0];
    
    // Check connection string info (sanitized)
    const connStr = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL || 'not set';
    const sanitizedConnStr = connStr.includes('@') 
      ? connStr.split('@')[1]?.split('/')[0] || 'unknown'
      : connStr;

    // First, get a direct count of rows in the tables
    // Cast to text to avoid INT32 serialization issues with large counts
    const sectorCountResult = await pool.query(`SELECT COUNT(*)::text as count FROM sectors`);
    const subsectorCountResult = await pool.query(`SELECT COUNT(*)::text as count FROM subsectors`);
    const sectorCount = parseInt(String(sectorCountResult.rows[0]?.count || '0'), 10);
    const subsectorCount = parseInt(String(subsectorCountResult.rows[0]?.count || '0'), 10);
    
    console.log(`[API /api/runtime/metadata] Database connection info:`, {
      db_name: dbInfo?.db_name,
      server: `${dbInfo?.server_addr}:${dbInfo?.server_port}`,
      connection_string_hint: sanitizedConnStr
    });
    console.log(`[API /api/runtime/metadata] Direct counts: ${sectorCount} sectors, ${subsectorCount} subsectors in database`);

    // Fetch all sectors from database (including inactive ones)
    // Schema: id (text PK), sector_name (text), name (text nullable), is_active (boolean)
    const sectorsQuery = `SELECT id, sector_name, name, is_active FROM sectors ORDER BY COALESCE(sector_name, name), name`;

    console.log(`[API /api/runtime/metadata] Executing sectors query: ${sectorsQuery}`);
    const sectorsResult = await pool.query(sectorsQuery);
    
    console.log(`[API /api/runtime/metadata] Found ${sectorsResult.rows.length} sectors in database`);
    
    // Map sectors to expected format (include all, not just active)
    // Use actual 'id' field as sector_code since sector_code column doesn't exist
    const sectors = (sectorsResult.rows || []).map((s: Record<string, unknown>) => {
      const sectorName = typeof s.sector_name === 'string'
        ? s.sector_name
        : (typeof s.name === 'string' ? s.name : `Sector ${String(s.id ?? "")}`);
      // Use the actual 'id' field as the code (it's text like "general", "education_facilities", etc.)
      const sectorCode = typeof s.id === 'string'
        ? s.id
        : `SECTOR_${String(sectorName).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      return {
        sector_code: sectorCode,
        label: sectorName
      };
    });
    
    console.log(`[API /api/runtime/metadata] Returning ${sectors.length} sectors:`, sectors.map(s => s.label));

    // Fetch all subsectors from database (including inactive ones)
    // Schema: id (text PK), name (text), sector_id (text FK to sectors.id), is_active (boolean)
    const subsectorsQuery = `
      SELECT s.id, s.name, s.sector_id, s.is_active, sec.sector_name, sec.name as sector_name_alt
      FROM subsectors s
      LEFT JOIN sectors sec ON s.sector_id = sec.id
      ORDER BY s.name
    `;

    const subsectorsResult = await pool.query(subsectorsQuery);
    
    console.log(`[API /api/runtime/metadata] Found ${subsectorsResult.rows.length} subsectors in database`);
    
    // Map subsectors to expected format (include all, with minimal filtering)
    // Deduplicate by subsector_code to prevent React key conflicts
    const subsectorsMap = new Map<string, Record<string, unknown>>();

    (subsectorsResult.rows || [])
      .filter((s: Record<string, unknown>) => {
        const name = typeof s.name === 'string' ? s.name.trim() : '';
        // Only filter out truly empty or invalid names
        if (!name || name.length === 0) {
          return false;
        }
        // Keep all subsectors, even if they have short names (they might be valid codes)
        return true;
      })
      .forEach((s: Record<string, unknown>) => {
        const subsectorName = typeof s.name === 'string' ? s.name : `Subsector ${String(s.id ?? "")}`;
        // Use the actual 'id' field as the code (it's text like "ed1", "ed2", etc.)
        const subsectorCode = typeof s.id === 'string'
          ? s.id
          : `SUBSECTOR_${String(subsectorName).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
        // Use sector_id (text) as sector_code since it references sectors.id
        const sectorCode = typeof s.sector_id === 'string' ? s.sector_id : '';
        
        // Only keep first occurrence of each subsector_code
        if (!subsectorsMap.has(subsectorCode)) {
          subsectorsMap.set(subsectorCode, {
            subsector_code: subsectorCode,
            sector_code: sectorCode,
            label: subsectorName
          });
        }
      });
    
    const subsectors = Array.from(subsectorsMap.values());
    
    console.log(`[API /api/runtime/metadata] Returning ${subsectors.length} subsectors`);

    // Fetch modules from database
    let modules: Array<{ module_code: string; label: string }> = [];
    try {
      const modulesResult = await pool.query(`
        SELECT module_code, module_name
        FROM public.assessment_modules
        WHERE is_active = true
        ORDER BY module_code
      `);
      modules = modulesResult.rows
        .map((m: Record<string, unknown>) => ({
          module_code: typeof m.module_code === 'string' ? m.module_code : null,
          label: typeof m.module_name === 'string' ? m.module_name : null,
        }))
        .filter((m): m is { module_code: string; label: string } => !!m.module_code && !!m.label);
      console.log(`[API /api/runtime/metadata] Found ${modules.length} active modules in database`);
    } catch (moduleError: unknown) {
      const msg = moduleError instanceof Error ? moduleError.message : String(moduleError ?? "");
      console.warn("[API /api/runtime/metadata] Could not load modules (table may not exist yet):", msg);
      modules = [];
    }

    console.log(`[API /api/runtime/metadata] Successfully returning ${sectors.length} sectors, ${subsectors.length} subsectors, and ${modules.length} modules`);
    
    const response = {
      sectors,
      subsectors,
      modules,
      subsectorSchemas: SUBSECTOR_SCHEMAS,
      _debug: {
        database: {
          db_name: dbInfo?.db_name,
          server: `${dbInfo?.server_addr}:${dbInfo?.server_port}`,
          connection_hint: sanitizedConnStr
        },
        sectorCountInDB: sectorCount,
        subsectorCountInDB: subsectorCount,
        sectorsFound: sectorsResult.rows.length,
        sectorsReturned: sectors.length,
        subsectorsFound: subsectorsResult.rows.length,
        subsectorsReturned: subsectors.length,
        sectorsQuery: sectorsQuery,
        subsectorsQuery: subsectorsQuery,
        sectorsRaw: sectorsResult.rows.map((s: Record<string, unknown>) => ({
          id: s.id,
          sector_name: s.sector_name,
          name: s.name,
          sector_code: s.sector_code,
          is_active: s.is_active
        })),
        subsectorsRaw: subsectorsResult.rows.map((s: Record<string, unknown>) => ({
          id: s.id,
          name: s.name,
          sector_id: s.sector_id,
          subsector_code: s.subsector_code,
          is_active: s.is_active,
          sector_name: s.sector_name,
          sector_name_alt: s.sector_name_alt,
          sec_sector_code: s.sec_sector_code
        }))
      }
    };
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    const err = error && typeof error === "object" ? error as { message?: string; stack?: string; code?: string } : {};
    console.error("[API /api/runtime/metadata] Error:", error);
    console.error("[API /api/runtime/metadata] Error details:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
    
    // Fail hard - no fallbacks. Return proper error response.
    return NextResponse.json(
      {
        error: "Failed to fetch metadata from database",
        message: err.message ?? "Unknown database error",
        code: err.code,
        hint: "Check server logs for database connection details",
      },
      { status: 500 }
    );
  }
}

