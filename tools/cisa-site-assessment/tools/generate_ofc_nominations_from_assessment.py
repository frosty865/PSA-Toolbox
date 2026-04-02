#!/usr/bin/env python3
"""
Generate OFC Nominations from Assessment (Selection-Only)

This script:
1. Evaluates assessment responses (NO answers)
2. Selects eligible OFCs from library (no text generation)
3. Creates nominations referencing library OFCs
4. Creates MISSING_LIBRARY_OFC stubs where no library OFC exists

Hard guards:
- Never generates ofc_text from responses
- Never creates nomination with text unless sourced from ofc_library
- Excludes test assessments by default
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set
from collections import defaultdict
import psycopg2
from urllib.parse import urlparse
from datetime import datetime

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

def get_db_connection():
    """Get database connection from DATABASE_URL."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)

def is_test_assessment(assessment: Dict) -> bool:
    """Check if assessment is a test assessment."""
    name = assessment.get('facility_name') or assessment.get('name') or ''
    return (
        assessment.get('qa_flag') == True or
        assessment.get('test_run_id') is not None or
        name.startswith('[QA]') or
        'test' in name.lower()
    )

def get_baseline_responses(conn, assessment_id: str) -> List[Dict]:
    """Get baseline question responses for assessment."""
    cur = conn.cursor()
    
    # Get assessment instance
    cur.execute("""
        SELECT id FROM public.assessment_instances
        WHERE facility_id = $1 OR id = $1
        LIMIT 1
    """, (assessment_id,))
    
    instance_result = cur.fetchone()
    instance_id = instance_result[0] if instance_result else assessment_id
    
    # Get responses
    cur.execute("""
        SELECT 
            ar.question_template_id as element_code,
            ar.response
        FROM public.assessment_responses ar
        WHERE ar.assessment_instance_id = $1
        AND ar.response = 'NO'
    """, (instance_id,))
    
    responses = []
    for row in cur.fetchall():
        responses.append({
            'element_code': row[0],
            'response': row[1]
        })
    
    cur.close()
    return responses

def get_expansion_responses(conn, assessment_id: str) -> List[Dict]:
    """Get expansion question responses for assessment."""
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            aer.question_id,
            aer.response
        FROM public.assessment_expansion_responses aer
        WHERE aer.assessment_id = $1
        AND aer.response = 'NO'
    """, (assessment_id,))
    
    responses = []
    for row in cur.fetchall():
        responses.append({
            'question_id': row[0],
            'response': row[1]
        })
    
    cur.close()
    return responses

def get_applied_profiles(conn, assessment_id: str) -> Dict:
    """Get applied expansion profiles to determine sector/subsector context."""
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            sep.sector,
            sep.subsector
        FROM public.assessment_expansion_profiles aep
        JOIN public.sector_expansion_profiles sep ON aep.profile_id = sep.profile_id
        WHERE aep.assessment_id = $1
        LIMIT 1
    """, (assessment_id,))
    
    result = cur.fetchone()
    cur.close()
    
    if result:
        return {'sector': result[0], 'subsector': result[1]}
    return {'sector': None, 'subsector': None}

def find_eligible_ofcs(
    conn,
    link_type: str,
    link_key: str,
    sector: Optional[str] = None,
    subsector: Optional[str] = None
) -> List[Dict]:
    """Find eligible OFCs from library using scope precedence."""
    cur = conn.cursor()
    
    # Query with scope precedence (SUBSECTOR > SECTOR > BASELINE)
    query = """
        SELECT 
            ofc_id,
            scope,
            sector,
            subsector,
            link_type,
            link_key,
            ofc_text,
            solution_role,
            citation_count
        FROM public.v_eligible_ofc_library
        WHERE link_type = %s AND link_key = %s
        ORDER BY 
            CASE scope
                WHEN 'SUBSECTOR' THEN 3
                WHEN 'SECTOR' THEN 2
                WHEN 'BASELINE' THEN 1
                ELSE 0
            END DESC
        LIMIT 1
    """
    
    params = [link_type, link_key]
    
    # If sector/subsector provided, prefer matching scope
    if subsector:
        query = query.replace('LIMIT 1', 'AND scope = \'SUBSECTOR\' AND sector = %s AND subsector = %s LIMIT 1')
        params.extend([sector, subsector])
    elif sector:
        query = query.replace('LIMIT 1', 'AND scope = \'SECTOR\' AND sector = %s LIMIT 1')
        params.append(sector)
    
    cur.execute(query, params)
    results = cur.fetchall()
    
    ofcs = []
    for row in results:
        ofcs.append({
            'ofc_id': str(row[0]),
            'scope': row[1],
            'sector': row[2],
            'subsector': row[3],
            'link_type': row[4],
            'link_key': row[5],
            'ofc_text': row[6],
            'solution_role': row[7],
            'citation_count': row[8]
        })
    
    cur.close()
    return ofcs

def create_nomination(
    conn,
    assessment_id: str,
    link_type: str,
    link_key: str,
    scope: str,
    ofc_id: Optional[str] = None,
    ofc_text_snapshot: Optional[str] = None,
    sector: Optional[str] = None,
    subsector: Optional[str] = None
) -> Optional[str]:
    """Create OFC nomination (idempotent)."""
    cur = conn.cursor()
    
    # Check if nomination already exists
    cur.execute("""
        SELECT nomination_id FROM public.ofc_nominations
        WHERE assessment_id = %s
        AND link_type = %s
        AND link_key = %s
        AND (ofc_id = %s OR (ofc_id IS NULL AND %s IS NULL))
        LIMIT 1
    """, (assessment_id, link_type, link_key, ofc_id, ofc_id))
    
    if cur.fetchone():
        return None  # Already exists
    
    # Create nomination
    status_reason = 'MISSING_LIBRARY_OFC' if ofc_id is None else None
    
    cur.execute("""
        INSERT INTO public.ofc_nominations (
            assessment_id,
            ofc_id,
            link_type,
            link_key,
            scope,
            sector,
            subsector,
            proposed_title,
            proposed_ofc_text,
            ofc_text_snapshot,
            evidence_excerpt,
            submitted_by,
            submitted_role,
            status,
            status_reason
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING nomination_id
    """, (
        assessment_id,
        ofc_id,
        link_type,
        link_key,
        scope,
        sector,
        subsector,
        f"OFC for {link_key}" if ofc_id else f"Missing library OFC for {link_key}",
        ofc_text_snapshot or '',  # proposed_ofc_text (required field)
        ofc_text_snapshot,  # ofc_text_snapshot (copied from library)
        f"Library OFC selected for {link_key}" if ofc_id else "Library OFC missing",
        'SYSTEM',
        'ENGINEER',
        'SUBMITTED',
        status_reason
    ))
    
    nomination_id = str(cur.fetchone()[0])
    conn.commit()
    cur.close()
    
    return nomination_id

def generate_nominations_for_assessment(
    conn,
    assessment_id: str,
    include_test: bool = False
) -> Dict:
    """Generate OFC nominations for an assessment."""
    cur = conn.cursor()
    
    # Get assessment
    cur.execute("""
        SELECT id, facility_name, name, qa_flag, test_run_id
        FROM public.assessments
        WHERE id = %s
    """, (assessment_id,))
    
    assessment_result = cur.fetchone()
    if not assessment_result:
        return {'error': 'Assessment not found'}
    
    assessment = {
        'id': assessment_result[0],
        'facility_name': assessment_result[1],
        'name': assessment_result[2],
        'qa_flag': assessment_result[3],
        'test_run_id': assessment_result[4]
    }
    
    # Check if test assessment
    if not include_test and is_test_assessment(assessment):
        return {'error': 'Test assessment excluded (use include_test=true)'}
    
    # Get applied profiles for context
    profile_context = get_applied_profiles(conn, assessment_id)
    
    # Get baseline responses (NO answers)
    baseline_responses = get_baseline_responses(conn, assessment_id)
    
    # Get expansion responses (NO answers)
    expansion_responses = get_expansion_responses(conn, assessment_id)
    
    # Load ALT_SAFE question mapping (element_code -> question_key)
    # For now, we'll use element_code as link_key for PRIMARY_QUESTION
    # In production, you'd load alt_safe_model_extracted.json to map properly
    
    nominations_created = []
    missing_library = []
    
    # Process baseline responses
    for response in baseline_responses:
        element_code = response['element_code']
        
        # Find eligible OFCs
        ofcs = find_eligible_ofcs(
            conn,
            'PRIMARY_QUESTION',
            element_code,  # Using element_code as link_key (should map to ALT_SAFE question_key)
            profile_context.get('sector'),
            profile_context.get('subsector')
        )
        
        if ofcs:
            # Select best match (first one from precedence-ordered query)
            ofc = ofcs[0]
            nomination_id = create_nomination(
                conn,
                assessment_id,
                'PRIMARY_QUESTION',
                element_code,
                ofc['scope'],
                ofc['ofc_id'],
                ofc['ofc_text'],
                ofc.get('sector'),
                ofc.get('subsector')
            )
            if nomination_id:
                nominations_created.append({
                    'nomination_id': nomination_id,
                    'link_type': 'PRIMARY_QUESTION',
                    'link_key': element_code,
                    'ofc_id': ofc['ofc_id'],
                    'scope': ofc['scope']
                })
        else:
            # Create MISSING_LIBRARY_OFC stub
            nomination_id = create_nomination(
                conn,
                assessment_id,
                'PRIMARY_QUESTION',
                element_code,
                'BASELINE',
                None,  # ofc_id = NULL
                None,  # ofc_text_snapshot = NULL
                None,
                None
            )
            if nomination_id:
                missing_library.append({
                    'nomination_id': nomination_id,
                    'link_type': 'PRIMARY_QUESTION',
                    'link_key': element_code,
                    'scope': 'BASELINE'
                })
    
    # Process expansion responses
    for response in expansion_responses:
        question_id = response['question_id']
        
        # Find eligible OFCs
        ofcs = find_eligible_ofcs(
            conn,
            'EXPANSION_QUESTION',
            question_id,
            profile_context.get('sector'),
            profile_context.get('subsector')
        )
        
        if ofcs:
            ofc = ofcs[0]
            nomination_id = create_nomination(
                conn,
                assessment_id,
                'EXPANSION_QUESTION',
                question_id,
                ofc['scope'],
                ofc['ofc_id'],
                ofc['ofc_text'],
                ofc.get('sector'),
                ofc.get('subsector')
            )
            if nomination_id:
                nominations_created.append({
                    'nomination_id': nomination_id,
                    'link_type': 'EXPANSION_QUESTION',
                    'link_key': question_id,
                    'ofc_id': ofc['ofc_id'],
                    'scope': ofc['scope']
                })
        else:
            nomination_id = create_nomination(
                conn,
                assessment_id,
                'EXPANSION_QUESTION',
                question_id,
                'SUBSECTOR',  # Expansion is typically subsector
                None,
                None,
                profile_context.get('sector'),
                profile_context.get('subsector')
            )
            if nomination_id:
                missing_library.append({
                    'nomination_id': nomination_id,
                    'link_type': 'EXPANSION_QUESTION',
                    'link_key': question_id,
                    'scope': 'SUBSECTOR'
                })
    
    cur.close()
    
    return {
        'assessment_id': assessment_id,
        'nominations_created': len(nominations_created),
        'missing_library_count': len(missing_library),
        'nominations': nominations_created,
        'missing_library': missing_library
    }

def main():
    project_root = Path(__file__).parent.parent
    
    # Get assessment ID from command line or process all
    if len(sys.argv) > 1:
        assessment_ids = [sys.argv[1]]
    else:
        # Process all non-test assessments
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM public.assessments
            WHERE (qa_flag = false OR qa_flag IS NULL)
            AND (test_run_id IS NULL)
            AND (facility_name NOT LIKE '[QA]%' OR facility_name IS NULL)
            AND (facility_name NOT ILIKE '%test%' OR facility_name IS NULL)
        """)
        assessment_ids = [str(row[0]) for row in cur.fetchall()]
        cur.close()
        conn.close()
    
    if not assessment_ids:
        print("No assessments to process")
        return
    
    print(f"Processing {len(assessment_ids)} assessment(s)...")
    
    conn = get_db_connection()
    
    all_results = []
    all_missing = []
    
    for assessment_id in assessment_ids:
        print(f"\n{'='*80}")
        print(f"Processing assessment: {assessment_id}")
        print('='*80)
        
        result = generate_nominations_for_assessment(conn, assessment_id)
        
        if 'error' in result:
            print(f"✗ Error: {result['error']}")
            continue
        
        print(f"✓ Created {result['nominations_created']} nominations")
        print(f"⚠️  {result['missing_library_count']} missing library OFCs")
        
        all_results.append(result)
        all_missing.extend(result['missing_library'])
    
    # Save reports
    report_path = project_root / 'analytics' / 'reports' / 'ofc_nomination_generation_report.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'results': all_results
        }, f, indent=2)
    
    missing_queue_path = project_root / 'analytics' / 'reports' / 'ofc_missing_library_queue.json'
    with open(missing_queue_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'missing_library_ofcs': all_missing
        }, f, indent=2)
    
    print(f"\n✓ Reports saved:")
    print(f"  - {report_path}")
    print(f"  - {missing_queue_path}")
    print("\n✅ Generation complete!")
    
    conn.close()

if __name__ == '__main__':
    main()

