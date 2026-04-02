#!/usr/bin/env python3
"""
Runtime: Compose Assessment Universe

Composes the question universe for an assessment:
- Baseline CORE (always included) - NOW FROM CANON DB
- Optional modules (additive)
- Optional sector/subsector (additive)

HARD RULE: Only writes to RUNTIME database
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import psycopg2
from urllib.parse import urlparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.runtime.baseline_selector import select_baseline_questions, get_db_connection

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

# Removed get_runtime_db_connection - now using get_db_connection from baseline_selector

def _load_index(path: str) -> Dict:
    """Load a question set index JSON file."""
    full_path = Path(__file__).parent.parent.parent / path
    if not full_path.exists():
        return {}
    with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def _flatten_groups(core_idx: Dict) -> List[Tuple[str, str, Dict]]:
    """Flatten core groups into (group, question_code, meta) tuples."""
    out = []
    for g in sorted(core_idx.get('groups', []), key=lambda x: x.get('order', 0)):
        group_name = g.get('group', '')
        for q in g.get('questions', []):
            out.append((group_name, q, {'group': group_name}))
    return out

def compose(
    assessment_id: str,
    sector_code: Optional[str] = None,
    subsector_code: Optional[str] = None,
    modules: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Compose assessment universe and store in database.
    
    Args:
        assessment_id: UUID of the assessment
        sector_code: Optional sector code
        subsector_code: Optional subsector code
        modules: Optional list of module codes
    
    Returns:
        Dictionary with assessment_id, baseline_core_version, and question count
    """
    modules = modules or []
    
    # Connect to database first (needed for baseline selection)
    conn = get_db_connection()
    
    try:
        # Select baseline questions from CANON (fail-closed if not present)
        baseline_questions = select_baseline_questions(conn)
        
        # Load question set indexes for modules/sector/subsector
        sector = _load_index('psa_engine/question_sets/SECTOR.index.json')
        subsector = _load_index('psa_engine/question_sets/SUBSECTOR.index.json')
        module = _load_index('psa_engine/question_sets/MODULE.index.json')
        
        baseline_core_version = 'BASELINE_CORE_V1'  # Canon baseline version
        
        qlist: List[Tuple[str, str, Dict]] = []
        
        # Baseline CORE from CANON (always)
        for q in baseline_questions:
            qlist.append(('BASELINE_CORE', q['code'], {'source': 'canon'}))
    
        # Sector additive
        if sector_code and sector:
            for q in sector.get('questions_by_sector', {}).get(sector_code, []):
                qlist.append(('SECTOR', q, {'sector_code': sector_code}))
        
        # Subsector additive
        if subsector_code and subsector:
            for q in subsector.get('questions_by_subsector', {}).get(subsector_code, []):
                qlist.append(('SUBSECTOR', q, {'subsector_code': subsector_code}))
        
        # Modules additive
        if module:
            for m in modules:
                for q in module.get('questions_by_module', {}).get(m, []):
                    qlist.append(('MODULE', q, {'module_code': m}))
        
        # Store in database
        cur = conn.cursor()
    
        try:
            # Upsert assessment_definitions
            cur.execute("""
                INSERT INTO public.assessment_definitions (
                    assessment_id, baseline_core_version, sector_code, subsector_code, modules, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, now())
                ON CONFLICT (assessment_id) DO UPDATE SET
                    baseline_core_version = EXCLUDED.baseline_core_version,
                    sector_code = EXCLUDED.sector_code,
                    subsector_code = EXCLUDED.subsector_code,
                    modules = EXCLUDED.modules,
                    updated_at = EXCLUDED.updated_at
            """, (assessment_id, baseline_core_version, sector_code, subsector_code, json.dumps(modules)))
            
            # Delete existing universe (will recreate)
            cur.execute("""
                DELETE FROM public.assessment_question_universe
                WHERE assessment_id = %s
            """, (assessment_id,))
            
            # Insert frozen universe in deterministic order
            order = 1
            for layer, qcode, meta in qlist:
                cur.execute("""
                    INSERT INTO public.assessment_question_universe (
                        assessment_id, layer, question_code, order_index, meta
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (assessment_id, layer, qcode, order, json.dumps(meta)))
                order += 1
            
            conn.commit()
            
            return {
                'assessment_id': assessment_id,
                'baseline_core_version': baseline_core_version,
                'questions': len(qlist),
                'breakdown': {
                    'baseline_core': len([q for q in qlist if q[0] == 'BASELINE_CORE']),
                    'sector': len([q for q in qlist if q[0] == 'SECTOR']),
                    'subsector': len([q for q in qlist if q[0] == 'SUBSECTOR']),
                    'modules': len([q for q in qlist if q[0] == 'MODULE'])
                }
            }
            
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        conn.close()

def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python tools/runtime/compose_assessment_universe.py <assessment_id> [sector_code] [subsector_code] [modules_json]")
        sys.exit(1)
    
    assessment_id = sys.argv[1]
    sector_code = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != 'null' else None
    subsector_code = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != 'null' else None
    modules = json.loads(sys.argv[4]) if len(sys.argv) > 4 else []
    
    try:
        result = compose(assessment_id, sector_code, subsector_code, modules)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()


