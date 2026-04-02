#!/usr/bin/env tsx
/**
 * Introspect table schema from a database and generate CREATE TABLE statement
 * 
 * Usage:
 *   npx tsx tools/db/introspect_table_schema.ts <pool> <schema> <table>
 * 
 * Example:
 *   npx tsx tools/db/introspect_table_schema.ts corpus public canonical_sources
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getCorpusPool } from '../../app/lib/db/corpus_client';
import { getRuntimePool } from '../../app/lib/db/runtime_client';

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  udt_name: string;
}

interface Constraint {
  name: string;
  type: string;
  definition: string;
}

interface ForeignKey {
  constraint_name: string;
  columns: string[];
  referenced_table: string;
  referenced_columns: string[];
  on_delete: string;
  on_update: string;
}

interface Index {
  name: string;
  definition: string;
  unique: boolean;
}

async function introspectTable(
  pool: any,
  schema: string,
  table: string
): Promise<{
  columns: ColumnDef[];
  primaryKey: string[];
  checkConstraints: Constraint[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
  createStatement: string;
}> {
  const fqtn = `${schema}.${table}`;
  
  // Check if table exists
  const existsResult = await pool.query(`SELECT to_regclass($1) as reg`, [fqtn]);
  if (!existsResult.rows[0]?.reg) {
    throw new Error(`Table ${fqtn} does not exist`);
  }
  
  // Get columns with full type information
  const columnsResult = await pool.query(`
    SELECT 
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);
  
  const columns: ColumnDef[] = columnsResult.rows.map((row: any) => ({
    name: row.column_name,
    type: row.data_type,
    udt_name: row.udt_name,
    nullable: row.is_nullable === 'YES',
    default: row.column_default,
    character_maximum_length: row.character_maximum_length,
    numeric_precision: row.numeric_precision,
    numeric_scale: row.numeric_scale,
  }));
  
  // Get primary key
  const pkResult = await pool.query(`
    SELECT 
      a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    ORDER BY a.attnum
  `, [fqtn]);
  
  const primaryKey = pkResult.rows.map((row: any) => row.column_name);
  
  // Get check constraints
  const checkResult = await pool.query(`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass
      AND contype = 'c'
  `, [fqtn]);
  
  const checkConstraints: Constraint[] = checkResult.rows.map((row: any) => ({
    name: row.constraint_name,
    type: 'CHECK',
    definition: row.definition,
  }));
  
  // Get foreign keys with ON DELETE/UPDATE actions
  const fkResult = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `, [schema, table]);
  
  const fkMap = new Map<string, ForeignKey>();
  for (const row of fkResult.rows) {
    if (!fkMap.has(row.constraint_name)) {
      fkMap.set(row.constraint_name, {
        constraint_name: row.constraint_name,
        columns: [],
        referenced_table: `${row.foreign_table_schema}.${row.foreign_table_name}`,
        referenced_columns: [],
        on_delete: row.delete_rule,
        on_update: row.update_rule,
      });
    }
    const fk = fkMap.get(row.constraint_name)!;
    fk.columns.push(row.column_name);
    fk.referenced_columns.push(row.foreign_column_name);
  }
  
  const foreignKeys = Array.from(fkMap.values());
  
  // Get indexes (excluding PK index)
  const indexResult = await pool.query(`
    SELECT
      i.indexname as name,
      i.indexdef as definition,
      i.indexdef LIKE '%UNIQUE%' as is_unique
    FROM pg_indexes i
    WHERE i.schemaname = $1 AND i.tablename = $2
      AND i.indexname NOT LIKE '%_pkey'
    ORDER BY i.indexname
  `, [schema, table]);
  
  const indexes: Index[] = indexResult.rows.map((row: any) => ({
    name: row.name,
    definition: row.definition,
    unique: row.is_unique || false,
  }));
  
  // Generate CREATE TABLE statement
  const colDefs: string[] = [];
  
  for (const col of columns) {
    let colDef = `  ${col.name} `;
    
    // Determine type
    if (col.type === 'ARRAY') {
      colDef += `${col.udt_name}[]`;
    } else if (col.type === 'USER-DEFINED') {
      colDef += col.udt_name;
    } else if (col.character_maximum_length !== null) {
      colDef += `${col.type}(${col.character_maximum_length})`;
    } else if (col.numeric_precision !== null && col.numeric_scale !== null) {
      colDef += `${col.type}(${col.numeric_precision},${col.numeric_scale})`;
    } else {
      colDef += col.type;
    }
    
    if (!col.nullable) {
      colDef += ' NOT NULL';
    }
    
    if (col.default !== null) {
      colDef += ` DEFAULT ${col.default}`;
    }
    
    colDefs.push(colDef);
  }
  
  // Add primary key constraint
  if (primaryKey.length > 0) {
    colDefs.push(`  PRIMARY KEY (${primaryKey.join(', ')})`);
  }
  
  // Add check constraints
  for (const check of checkConstraints) {
    // Extract just the check expression from the definition
    const match = check.definition.match(/CHECK \((.+)\)/);
    if (match) {
      colDefs.push(`  CONSTRAINT ${check.name} CHECK (${match[1]})`);
    }
  }
  
  // Add foreign keys
  for (const fk of foreignKeys) {
    const fkDef = `  CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.columns.join(', ')}) ` +
      `REFERENCES ${fk.referenced_table} (${fk.referenced_columns.join(', ')})`;
    
    if (fk.on_delete !== 'NO ACTION') {
      const deleteAction = fk.on_delete.replace('_', ' ');
      colDefs.push(`${fkDef} ON DELETE ${deleteAction}`);
    } else {
      colDefs.push(fkDef);
    }
  }
  
  const createStatement = `CREATE TABLE IF NOT EXISTS ${fqtn} (\n${colDefs.join(',\n')}\n);`;
  
  // Add indexes
  const indexStatements: string[] = [];
  for (const idx of indexes) {
    indexStatements.push(idx.definition + ';');
  }
  
  return {
    columns,
    primaryKey,
    checkConstraints,
    foreignKeys,
    indexes,
    createStatement: createStatement + '\n\n' + indexStatements.join('\n'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: npx tsx tools/db/introspect_table_schema.ts <pool> <schema> <table>');
    console.error('  pool: "corpus" or "runtime"');
    process.exit(1);
  }
  
  const [poolName, schema, table] = args;
  
  let pool: any;
  if (poolName === 'corpus') {
    pool = getCorpusPool();
  } else if (poolName === 'runtime') {
    pool = getRuntimePool();
  } else {
    console.error(`Invalid pool: ${poolName}. Must be "corpus" or "runtime"`);
    process.exit(1);
  }
  
  try {
    const result = await introspectTable(pool, schema, table);
    console.log('-- Generated CREATE TABLE statement for', `${schema}.${table}`);
    console.log('-- From', poolName.toUpperCase(), 'database\n');
    console.log(result.createStatement);
    
    // Also output JSON for programmatic use
    if (process.env.OUTPUT_JSON === 'true') {
      console.log('\n-- JSON output:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
