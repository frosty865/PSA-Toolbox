#!/usr/bin/env python3
"""
Regenerate OFCs Against Frozen Baseline v2

PHASE: STEP 4 of 5 — OFC REGENERATION + SIGNAL VALIDATION

This script:
1. Evaluates assessment responses against Baseline v2 questions
2. Respects gate ordering (EXISTS → OPERABLE → RESILIENCE)
3. Triggers OFCs only when gates evaluate to NO
4. Creates OFC nominations with SYSTEM/ENGINE attributes
5. Produces comprehensive reports

AUTHORITATIVE INPUTS:
- analytics/runtime/baseline_questions_registry_v2.json
- analytics/reports/baseline_migration_table.json (for gate mappings)
- Assessment responses from database
- OFC templates from public/doctrine/ofc_templates_baseline_v1.json

CONSTRAINTS:
- NO modification to baseline questions
- NO modification to OFC templates
- NO new OFC logic paths
- FAIL if OFCs attach to forbidden or retired baseline elements
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from collections import defaultdict
from datetime import datetime
import psycopg2
from urllib.parse import urlparse

# Gate ordering (authoritative)
GATE_ORDER = ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE']

# Forbidden dimensions (should not trigger OFCs)
FORBIDDEN_DIMENSIONS = ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()


def get_db_connection():
    """Get database connection from environment variables."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    env_file = os.path.join(project_root, 'env.local')
    if not os.path.exists(env_file):
        env_file = os.path.join(project_root, '.env.local')
    if os.path.exists(env_file):
        load_env_file(env_file)
    
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        parsed = urlparse(database_url)
        ssl_mode = 'require' if 'supabase' in database_url.lower() else None
        return psycopg2.connect(database_url, sslmode=ssl_mode)
    
    # Fallback to individual components
    user = os.getenv('DATABASE_USER', 'postgres')
    password = os.getenv('DATABASE_PASSWORD', '')
    host = os.getenv('DATABASE_HOST', 'localhost')
    port = os.getenv('DATABASE_PORT', '5432')
    dbname = os.getenv('DATABASE_NAME', 'postgres')
    
    return psycopg2.connect(
        host=host,
        port=port,
        database=dbname,
        user=user,
        password=password
    )


def load_baseline_v2(registry_path: str) -> Dict:
    """Load Baseline v2 questions registry."""
    with open(registry_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_migration_table(migration_path: str) -> Dict[str, Dict]:
    """Load migration table and create lookup by question_id."""
    with open(migration_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lookup = {}
    for entry in data.get('migration_table', []):
        question_id = entry.get('legacy_question_id')
        if question_id:
            lookup[question_id] = {
                'mapped_gate': entry.get('mapped_gate'),
                'action': entry.get('action'),
                'legacy_dimension': entry.get('legacy_dimension'),
                'notes': entry.get('notes')
            }
    
    return lookup


def load_ofc_templates(templates_path: str) -> Dict[str, List[Dict]]:
    """Load OFC templates and create lookup by element_code."""
    with open(templates_path, 'r', encoding='utf-8') as f:
        templates = json.load(f)
    
    lookup = defaultdict(list)
    for template in templates:
        element_code = template.get('required_element_code')
        if element_code:
            lookup[element_code].append(template)
    
    return lookup


def get_assessment_responses(conn, assessment_id: Optional[str] = None) -> List[Dict]:
    """Get assessment responses from database."""
    cur = conn.cursor()
    
    try:
        # Discover table structure
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assessment_responses'
            ORDER BY ordinal_position
        """)
        columns = [row[0] for row in cur.fetchall()]
        
        if not columns:
            print("⚠️  WARNING: assessment_responses table not found")
            cur.close()
            return []
        
        # Map column names
        assessment_id_col = None
        element_id_col = None
        response_col = None
        updated_col = None
        
        for col in columns:
            if col in ('assessment_id', 'assessment_instance_id', 'assessment_uuid', 'assessment'):
                assessment_id_col = col
            elif col in ('element_id', 'question_template_id', 'required_element_id', 'element_uuid'):
                element_id_col = col
            elif col in ('response', 'answer', 'value'):
                response_col = col
            elif col in ('updated_at', 'responded_at', 'updated', 'modified_at', 'created_at'):
                updated_col = col
        
        if not assessment_id_col or not element_id_col or not response_col:
            print(f"⚠️  WARNING: Missing required columns. Available: {columns}")
            print(f"   Found: assessment_id_col={assessment_id_col}, element_id_col={element_id_col}, response_col={response_col}")
            cur.close()
            return []
        
        # Build query
        select_cols = [assessment_id_col, element_id_col, response_col]
        if updated_col:
            select_cols.append(updated_col)
        else:
            select_cols.append("NULL as updated_at")
        
        # Get all responses
        # If using assessment_instance_id, responses are keyed by instance_id
        if assessment_id_col == 'assessment_instance_id':
            query = f"""
                SELECT 
                    ar.{assessment_id_col} as instance_or_assessment_id,
                    ar.{element_id_col},
                    ar.{response_col}
                    {f', ar.{updated_col}' if updated_col else ', NULL as updated_at'}
                FROM public.assessment_responses ar
                ORDER BY ar.{assessment_id_col}, ar.{element_id_col}
            """
        else:
            query = f"""
                SELECT {', '.join(select_cols)}
                FROM public.assessment_responses
                ORDER BY {assessment_id_col}, {element_id_col}
            """
        cur.execute(query)
        
        rows = cur.fetchall()
        cur.close()
        
        # Return responses with instance_id as assessment_id key
        # This allows us to match by instance_id when processing
        result = []
        for row in rows:
            result.append({
                'assessment_id': str(row[0]),  # This is actually instance_id if using assessment_instance_id
                'element_id': str(row[1]),
                'response': row[2],
                'updated_at': row[3].isoformat() if updated_col and row[3] else None
            })
        return result
        
    except Exception as e:
        print(f"⚠️  ERROR querying assessment_responses: {e}")
        cur.close()
        return []


def get_assessments(conn) -> List[Dict]:
    """Get all assessments from database."""
    cur = conn.cursor()
    
    # Try to discover the table structure
    try:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assessments'
            ORDER BY ordinal_position
        """)
        columns = [row[0] for row in cur.fetchall()]
        
        if not columns:
            # Table doesn't exist or no columns found
            print("⚠️  WARNING: assessments table not found or has no columns")
            return []
        
        # Build query based on available columns
        # Try common column name variations
        id_col = None
        name_col = None
        created_col = None
        
        for col in columns:
            if col in ('id', 'assessment_id', 'uuid'):
                id_col = col
            if col in ('name', 'facility_name', 'title'):
                name_col = col
            if col in ('created_at', 'created', 'date_created'):
                created_col = col
        
        if not id_col:
            print(f"⚠️  WARNING: Could not find ID column in assessments table. Available columns: {columns}")
            return []
        
        # Build SELECT query
        select_cols = [id_col]
        if name_col:
            select_cols.append(name_col)
        else:
            select_cols.append("NULL as name")
        if created_col:
            select_cols.append(created_col)
        else:
            select_cols.append("NULL as created_at")
        
        # Exclude test assessments from OFC regeneration
        # Test marker rule: qa_flag = true OR test_run_id IS NOT NULL
        where_clause = "WHERE 1=1"
        
        # Check for qa_flag column
        has_qa_flag = 'qa_flag' in columns
        has_test_run_id = 'test_run_id' in columns
        
        if has_qa_flag:
            where_clause += " AND (qa_flag = false OR qa_flag IS NULL)"
        if has_test_run_id:
            where_clause += " AND (test_run_id IS NULL)"
        # Fallback: exclude by name prefix
        if name_col:
            where_clause += f" AND ({name_col} NOT LIKE '[QA]%' OR {name_col} IS NULL)"
        
        query = f"""
            SELECT {', '.join(select_cols)}
            FROM public.assessments
            {where_clause}
            ORDER BY {created_col if created_col else id_col} DESC
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        result = []
        for row in rows:
            assessment = {
                'assessment_id': str(row[0]),
                'name': row[1] if name_col and row[1] else 'Unnamed',
                'created_at': row[2].isoformat() if created_col and row[2] else None
            }
            result.append(assessment)
        
        cur.close()
        return result
        
    except Exception as e:
        print(f"⚠️  ERROR querying assessments table: {e}")
        cur.close()
        return []


def get_question_by_id(baseline: Dict, question_id: str) -> Optional[Dict]:
    """Get question from baseline by element_id or element_code."""
    for question in baseline.get('required_elements', []):
        if question.get('element_id') == question_id or question.get('element_code') == question_id:
            return question
    return None


def get_gate_for_question(question: Dict, migration_lookup: Dict[str, Dict]) -> Optional[str]:
    """Get mapped gate for a question from migration table."""
    question_id = question.get('element_id') or question.get('element_code')
    if not question_id:
        return None
    
    migration_info = migration_lookup.get(question_id)
    if not migration_info:
        return None
    
    # Check if question is retired
    if migration_info.get('action') == 'RETIRE':
        return None
    
    return migration_info.get('mapped_gate')


def evaluate_gates_for_subtype(
    subtype_questions: List[Dict],
    responses: Dict[str, str],
    migration_lookup: Dict[str, Dict]
) -> Tuple[Dict[str, Optional[str]], Dict[str, Dict]]:
    """
    Evaluate gates for a subtype, respecting gate ordering.
    
    Returns:
        - Dict mapping gate names to their evaluation result (YES/NO/N_A/None).
          None means gate was skipped due to ordering.
        - Dict mapping gate names to the question that was evaluated
    """
    gate_results = {}
    gate_questions = {}
    
    # Group questions by gate
    questions_by_gate = defaultdict(list)
    for question in subtype_questions:
        gate = get_gate_for_question(question, migration_lookup)
        if gate:
            questions_by_gate[gate].append(question)
    
    # Evaluate gates in order
    for gate in GATE_ORDER:
        if gate not in questions_by_gate:
            gate_results[gate] = None
            gate_questions[gate] = None
            continue
        
        # Get response for this gate's question
        gate_question = questions_by_gate[gate][0]  # Use first question if multiple
        question_id = gate_question.get('element_id') or gate_question.get('element_code')
        response = responses.get(question_id)
        
        # Check if previous gate failed (skip if so)
        if gate == 'CONTROL_OPERABLE':
            if gate_results.get('CONTROL_EXISTS') == 'NO':
                gate_results[gate] = None  # Skipped
                gate_questions[gate] = None
                continue
        elif gate == 'CONTROL_RESILIENCE':
            if gate_results.get('CONTROL_EXISTS') == 'NO' or gate_results.get('CONTROL_OPERABLE') == 'NO':
                gate_results[gate] = None  # Skipped
                gate_questions[gate] = None
                continue
        
        # Store question for this gate
        gate_questions[gate] = gate_question
        
        # Evaluate gate (handle both N/A and N_A formats)
        if response in ('N_A', 'N/A'):
            gate_results[gate] = 'N_A'  # Excluded from scoring but recorded
        elif response == 'NO':
            gate_results[gate] = 'NO'
        elif response == 'YES':
            gate_results[gate] = 'YES'
        else:
            gate_results[gate] = None  # No response
    
    return gate_results, gate_questions


def should_trigger_ofc(gate: str, gate_result: Optional[str]) -> bool:
    """Determine if OFC should be triggered for a gate result."""
    # Only trigger on NO responses
    return gate_result == 'NO'


def is_retired_question(question: Dict, migration_lookup: Dict[str, Dict]) -> bool:
    """Check if question is retired."""
    question_id = question.get('element_id') or question.get('element_code')
    if not question_id:
        return True
    
    migration_info = migration_lookup.get(question_id)
    if not migration_info:
        return False
    
    return migration_info.get('action') == 'RETIRE'


def is_forbidden_dimension(question: Dict) -> bool:
    """Check if question references forbidden dimension."""
    dimension = question.get('capability_dimension', '')
    return dimension in FORBIDDEN_DIMENSIONS


def create_ofc_nomination(
    conn,
    assessment_id: str,
    question: Dict,
    ofc_template: Dict,
    gate: str,
    discipline_id: Optional[str] = None,
    discipline_subtype_id: Optional[str] = None
) -> str:
    """Create OFC nomination in database."""
    cur = conn.cursor()
    
    # Extract OFC text from template
    ofc_text = ofc_template.get('ofc_text', 'Implement and maintain the capability described by the associated required element.')
    
    # Create nomination
    cur.execute("""
        INSERT INTO public.ofc_nominations (
            assessment_id,
            discipline_id,
            discipline_subtype_id,
            proposed_title,
            proposed_ofc_text,
            evidence_excerpt,
            evidence_page,
            submitted_by,
            submitted_role,
            status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING nomination_id
    """, (
        assessment_id,
        discipline_id or question.get('discipline_id'),
        discipline_subtype_id or question.get('discipline_subtype_id'),
        f"{question.get('title', 'Baseline Control')} - {gate}",
        ofc_text,
        f"Baseline gate {gate} evaluated to NO for {question.get('element_code', 'unknown')}",
        None,
        'SYSTEM',
        'ENGINEER',  # Valid values: 'FIELD', 'ENGINEER', 'GOVERNANCE'
        'SUBMITTED'
    ))
    
    nomination_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    
    return str(nomination_id)


def get_assessment_instance_ids(conn, assessment_id: str) -> List[str]:
    """Get assessment_instance_ids for an assessment."""
    cur = conn.cursor()
    instance_ids = []
    try:
        # Try multiple approaches to find instances linked to this assessment
        # 1. Check if assessment_id is itself an instance_id
        cur.execute("""
            SELECT id FROM public.assessment_instances
            WHERE id = %s
        """, (assessment_id,))
        if cur.fetchone():
            instance_ids.append(assessment_id)
        
        # 2. Check if there's a direct link (assessment might have instance_id column)
        # For now, we'll also check by looking for instances created around the same time
        # or with metadata linking to this assessment
        
        cur.close()
        return instance_ids
    except Exception as e:
        cur.close()
        return instance_ids


def regenerate_ofcs_for_assessment(
    conn,
    assessment_id: str,
    baseline: Dict,
    migration_lookup: Dict[str, Dict],
    ofc_templates: Dict[str, List[Dict]],
    responses: List[Dict]
) -> Dict:
    """
    Regenerate OFCs for a single assessment.
    
    Returns statistics and validation results.
    """
    # Get assessment_instance_ids for this assessment
    # For QA assessments, the instance_id might be what we need to match
    instance_ids = get_assessment_instance_ids(conn, assessment_id)
    
    # Also check if assessment_id is itself an instance_id (common for QA)
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id FROM public.assessment_instances WHERE id = %s
        """, (assessment_id,))
        if cur.fetchone():
            if assessment_id not in instance_ids:
                instance_ids.append(assessment_id)
    except:
        pass
    finally:
        cur.close()
    
    # Filter responses for this assessment
    # Responses use assessment_instance_id, so we match by instance_id
    assessment_responses = {}
    response_count = 0
    for r in responses:
        # Match by assessment_id (if direct) or instance_id
        response_key = r['assessment_id']  # This is actually instance_id from responses
        if response_key == assessment_id or response_key in instance_ids:
            question_id = r['element_id']
            # question_template_id in responses is element_code (e.g., "BASE-000")
            assessment_responses[question_id] = r['response']
            response_count += 1
    
    if response_count > 0:
        print(f"    Found {response_count} responses for this assessment")
    else:
        # Debug: show what we're looking for vs what we have
        print(f"    No responses found. Looking for assessment_id={assessment_id}, instance_ids={instance_ids}")
        print(f"    Available response keys: {set(r['assessment_id'] for r in responses[:5])}")
    
    # Group questions by subtype
    questions_by_subtype = defaultdict(list)
    for question in baseline.get('required_elements', []):
        subtype_id = question.get('discipline_subtype_id')
        if subtype_id:
            questions_by_subtype[subtype_id].append(question)
    
    # Statistics
    stats = {
        'total_ofcs_created': 0,
        'ofcs_by_gate': defaultdict(int),
        'ofcs_by_discipline': defaultdict(int),
        'skipped_questions': [],
        'validation_errors': []
    }
    
    created_ofcs = []
    
    # Process each subtype
    for subtype_id, subtype_questions in questions_by_subtype.items():
        # Get responses for this subtype's questions
        subtype_responses = {}
        for question in subtype_questions:
            question_id = question.get('element_id') or question.get('element_code')
            element_code = question.get('element_code')
            # Check both element_id and element_code in responses
            # Responses use question_template_id which is element_code (e.g., "BASE-000")
            if question_id in assessment_responses:
                subtype_responses[question_id] = assessment_responses[question_id]
            elif element_code and element_code in assessment_responses:
                subtype_responses[question_id] = assessment_responses[element_code]
            # Also check if question_template_id matches element_code directly
            elif element_code:
                # Responses might have element_code as the key
                for resp_key, resp_value in assessment_responses.items():
                    if resp_key == element_code or resp_key.endswith(element_code):
                        subtype_responses[question_id] = resp_value
                        break
        
        # Evaluate gates
        gate_results, gate_questions = evaluate_gates_for_subtype(subtype_questions, subtype_responses, migration_lookup)
        
        # Check each gate for OFC triggers
        for gate, gate_result in gate_results.items():
            if not should_trigger_ofc(gate, gate_result):
                if gate_result == 'YES':
                    print(f"      Gate {gate} = YES (no OFC)")
                elif gate_result == 'N_A':
                    print(f"      Gate {gate} = N_A (excluded)")
                continue
            print(f"      Gate {gate} = NO (should trigger OFC)")
            
            # Get the question that corresponds to this gate
            gate_question = gate_questions.get(gate)
            if not gate_question:
                continue
            
            # Validation: Check for forbidden/retired questions
            if is_retired_question(gate_question, migration_lookup):
                stats['validation_errors'].append({
                    'question_id': gate_question.get('element_id'),
                    'reason': 'retired_question',
                    'gate': gate
                })
                continue
            
            if is_forbidden_dimension(gate_question):
                stats['validation_errors'].append({
                    'question_id': gate_question.get('element_id'),
                    'reason': 'forbidden_dimension',
                    'dimension': gate_question.get('capability_dimension'),
                    'gate': gate
                })
                continue
            
            # Find OFC template
            element_code = gate_question.get('element_code')
            templates = ofc_templates.get(element_code, [])
            
            print(f"        Looking for OFC template for {element_code}: found {len(templates)} templates")
            
            if not templates:
                stats['skipped_questions'].append({
                    'question_id': element_code,
                    'gate': gate,
                    'reason': 'no_ofc_template'
                })
                print(f"        ⚠️  No OFC template found for {element_code}")
                continue
            
            # Create OFC nomination for each template (usually one)
            for template in templates:
                try:
                    print(f"        Creating OFC nomination for {element_code} ({gate})...")
                    nomination_id = create_ofc_nomination(
                        conn,
                        assessment_id,
                        gate_question,
                        template,
                        gate
                    )
                    
                    created_ofcs.append({
                        'nomination_id': nomination_id,
                        'question_id': element_code,
                        'gate': gate,
                        'discipline': gate_question.get('discipline_name'),
                        'subtype': gate_question.get('discipline_subtype_name')
                    })
                    
                    stats['total_ofcs_created'] += 1
                    stats['ofcs_by_gate'][gate] += 1
                    stats['ofcs_by_discipline'][gate_question.get('discipline_name', 'Unknown')] += 1
                    print(f"        ✓ Created OFC nomination: {nomination_id}")
                    
                except Exception as e:
                    print(f"        ✗ Failed to create OFC: {e}")
                    stats['validation_errors'].append({
                        'question_id': element_code,
                        'gate': gate,
                        'reason': 'creation_failed',
                        'error': str(e)
                    })
    
    return {
        'stats': stats,
        'created_ofcs': created_ofcs
    }


def get_v1_ofc_count_simulation(
    conn,
    assessment_id: str,
    responses: List[Dict],
    baseline: Dict
) -> int:
    """
    Simulate Baseline v1 OFC count (all NO responses, no gate ordering).
    This provides a baseline for comparison.
    """
    assessment_responses = {r['element_id']: r['response'] for r in responses if r['assessment_id'] == assessment_id}
    
    # Count all NO responses for baseline questions (v1 behavior: all NO → OFC)
    # Note: v1 didn't have gate ordering, so all NO responses would trigger OFCs
    no_count = 0
    for question in baseline.get('required_elements', []):
        question_id = question.get('element_id') or question.get('element_code')
        response = assessment_responses.get(question_id)
        if response == 'NO':
            no_count += 1
    
    return no_count


def generate_comparison_report(
    all_results: Dict[str, Dict],
    v1_counts: Dict[str, int],
    output_dir: str
) -> Dict:
    """Generate v1 vs v2 comparison report."""
    
    comparison_data = []
    total_v1 = sum(v1_counts.values())
    total_v2 = sum(r['stats']['total_ofcs_created'] for r in all_results.values())
    
    for assessment_id, result in all_results.items():
        v1_count = v1_counts.get(assessment_id, 0)
        v2_count = result['stats']['total_ofcs_created']
        delta = v2_count - v1_count
        delta_pct = (delta / v1_count * 100) if v1_count > 0 else 0
        
        comparison_data.append({
            'assessment_id': assessment_id,
            'v1_ofc_count': v1_count,
            'v2_ofc_count': v2_count,
            'delta': delta,
            'delta_percentage': round(delta_pct, 2),
            'by_gate': dict(result['stats']['ofcs_by_gate'])
        })
    
    comparison_report = {
        'metadata': {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'baseline_v1_description': 'All NO responses trigger OFCs (no gate ordering)',
            'baseline_v2_description': 'Gate-ordered evaluation (EXISTS → OPERABLE → RESILIENCE)',
            'total_assessments': len(comparison_data)
        },
        'summary': {
            'total_v1_ofcs': total_v1,
            'total_v2_ofcs': total_v2,
            'total_delta': total_v2 - total_v1,
            'delta_percentage': round((total_v2 - total_v1) / total_v1 * 100, 2) if total_v1 > 0 else 0
        },
        'by_assessment': comparison_data
    }
    
    comparison_path = os.path.join(output_dir, 'ofc_comparison_v1_vs_v2.json')
    with open(comparison_path, 'w', encoding='utf-8') as f:
        json.dump(comparison_report, f, indent=2)
    print(f"✓ Comparison Report (v1 vs v2): {comparison_path}")
    
    return comparison_report


def generate_reports(
    all_results: Dict[str, Dict],
    baseline: Dict,
    v1_counts: Dict[str, int],
    output_dir: str
):
    """Generate comprehensive reports."""
    
    # Aggregate statistics
    total_ofcs = sum(r['stats']['total_ofcs_created'] for r in all_results.values())
    total_by_gate = defaultdict(int)
    total_by_discipline = defaultdict(int)
    total_validation_errors = 0
    total_skipped = 0
    
    for result in all_results.values():
        for gate, count in result['stats']['ofcs_by_gate'].items():
            total_by_gate[gate] += count
        for discipline, count in result['stats']['ofcs_by_discipline'].items():
            total_by_discipline[discipline] += count
        total_validation_errors += len(result['stats']['validation_errors'])
        total_skipped += len(result['stats']['skipped_questions'])
    
    # 1. OFC Attachment Report
    attachment_report = {
        'metadata': {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'baseline_version': baseline.get('metadata', {}).get('baseline_version', 'Baseline_Questions_v2'),
            'total_assessments_processed': len(all_results)
        },
        'summary': {
            'total_ofcs_generated': total_ofcs,
            'total_validation_errors': total_validation_errors,
            'total_skipped': total_skipped
        },
        'by_gate': dict(total_by_gate),
        'by_discipline': dict(total_by_discipline),
        'by_assessment': {
            assessment_id: {
                'total_ofcs': result['stats']['total_ofcs_created'],
                'by_gate': dict(result['stats']['ofcs_by_gate']),
                'by_discipline': dict(result['stats']['ofcs_by_discipline'])
            }
            for assessment_id, result in all_results.items()
        }
    }
    
    # 2. Validation Log
    validation_log = {
        'metadata': {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'total_errors': total_validation_errors,
            'total_skipped': total_skipped
        },
        'validation_errors': [],
        'skipped_questions': []
    }
    
    for assessment_id, result in all_results.items():
        for error in result['stats']['validation_errors']:
            validation_log['validation_errors'].append({
                'assessment_id': assessment_id,
                **error
            })
        for skipped in result['stats']['skipped_questions']:
            validation_log['skipped_questions'].append({
                'assessment_id': assessment_id,
                **skipped
            })
    
    # 3. Sample Assessment Walkthrough (use first assessment with OFCs)
    sample_walkthrough = None
    for assessment_id, result in all_results.items():
        if result['created_ofcs']:
            sample_walkthrough = {
                'assessment_id': assessment_id,
                'total_ofcs': result['stats']['total_ofcs_created'],
                'ofcs': result['created_ofcs'][:10],  # First 10 OFCs
                'gate_evaluation_example': {
                    'ofc': result['created_ofcs'][0] if result['created_ofcs'] else None,
                    'description': 'Shows baseline failure → OFC attachment flow'
                }
            }
            break
    
    # Write reports
    os.makedirs(output_dir, exist_ok=True)
    
    attachment_report_path = os.path.join(output_dir, 'ofc_attachment_report.json')
    with open(attachment_report_path, 'w', encoding='utf-8') as f:
        json.dump(attachment_report, f, indent=2)
    print(f"✓ OFC Attachment Report: {attachment_report_path}")
    
    validation_log_path = os.path.join(output_dir, 'ofc_validation_log.json')
    with open(validation_log_path, 'w', encoding='utf-8') as f:
        json.dump(validation_log, f, indent=2)
    print(f"✓ Validation Log: {validation_log_path}")
    
    if sample_walkthrough:
        walkthrough_path = os.path.join(output_dir, 'sample_assessment_walkthrough.json')
        with open(walkthrough_path, 'w', encoding='utf-8') as f:
            json.dump(sample_walkthrough, f, indent=2)
        print(f"✓ Sample Assessment Walkthrough: {walkthrough_path}")
    
    # 4. Comparison Report
    comparison_report = generate_comparison_report(all_results, v1_counts, output_dir)
    
    # Print summary
    print("\n" + "=" * 80)
    print("OFC REGENERATION SUMMARY")
    print("=" * 80)
    print(f"Total Assessments Processed: {len(all_results)}")
    print(f"Total OFCs Generated (v2): {total_ofcs}")
    print(f"Total OFCs (v1 simulation): {sum(v1_counts.values())}")
    print(f"Delta: {total_ofcs - sum(v1_counts.values())} ({comparison_report['summary']['delta_percentage']}%)")
    print(f"\nBy Gate:")
    for gate in GATE_ORDER:
        print(f"  {gate}: {total_by_gate[gate]}")
    print(f"\nBy Discipline (top 10):")
    for discipline, count in sorted(total_by_discipline.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {discipline}: {count}")
    print(f"\nValidation Errors: {total_validation_errors}")
    print(f"Skipped Questions: {total_skipped}")
    
    # Fail if validation errors found
    if total_validation_errors > 0:
        print("\n⚠️  WARNING: Validation errors found. Review validation_log.json")
        print("   Task will FAIL if OFCs attached to forbidden/retired elements.")
        return False
    
    return True


def main():
    """Main execution."""
    print("=" * 80)
    print("OFC REGENERATION - BASELINE v2")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_v2.json')
    migration_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.json')
    ofc_templates_path = os.path.join(project_root, 'public', 'doctrine', 'ofc_templates_baseline_v1.json')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    
    # Load data
    print("Loading Baseline v2...")
    baseline = load_baseline_v2(baseline_path)
    print(f"✓ Loaded {len(baseline.get('required_elements', []))} questions")
    
    print("Loading migration table...")
    migration_lookup = load_migration_table(migration_path)
    print(f"✓ Loaded {len(migration_lookup)} migration entries")
    
    print("Loading OFC templates...")
    ofc_templates = load_ofc_templates(ofc_templates_path)
    print(f"✓ Loaded {sum(len(templates) for templates in ofc_templates.values())} OFC templates")
    
    # Connect to database
    print("\nConnecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Get assessments
    print("\nFetching assessments...")
    assessments = get_assessments(conn)
    print(f"✓ Found {len(assessments)} assessments")
    
    # Get all responses
    print("Fetching assessment responses...")
    all_responses = get_assessment_responses(conn)
    print(f"✓ Found {len(all_responses)} responses")
    
    # Process each assessment
    print("\n" + "=" * 80)
    print("PROCESSING ASSESSMENTS")
    print("=" * 80)
    print()
    
    # Build instance_id to assessment_id mapping
    instance_to_assessment = {}
    cur = conn.cursor()
    try:
        # Get all instances and try to map them to assessments
        # For QA assessments, we'll process by instance_id directly
        cur.execute("""
            SELECT id, template_id FROM public.assessment_instances
        """)
        for row in cur.fetchall():
            instance_id = str(row[0])
            template_id = row[1]
            # template_id is a template name, not assessment_id
            # For now, we'll process instances separately
            instance_to_assessment[instance_id] = None  # Will be set if we find a link
    except:
        pass
    finally:
        cur.close()
    
    all_results = {}
    v1_counts = {}
    
    # Process assessments
    for assessment in assessments:
        assessment_id = assessment['assessment_id']
        print(f"Processing assessment: {assessment_id} ({assessment.get('name', 'Unnamed')})...")
        
        # Calculate v1 OFC count for comparison
        v1_count = get_v1_ofc_count_simulation(conn, assessment_id, all_responses, baseline)
        v1_counts[assessment_id] = v1_count
        
        result = regenerate_ofcs_for_assessment(
            conn,
            assessment_id,
            baseline,
            migration_lookup,
            ofc_templates,
            all_responses
        )
        
        all_results[assessment_id] = result
        print(f"  ✓ Created {result['stats']['total_ofcs_created']} OFCs (v1 simulation: {v1_count})")
        if result['stats']['validation_errors']:
            print(f"  ⚠️  {len(result['stats']['validation_errors'])} validation errors")
        if result['stats']['skipped_questions']:
            print(f"  ⚠️  {len(result['stats']['skipped_questions'])} skipped questions")
    
    # Also process instances that have responses but no assessment match
    # This handles QA assessments where instance_id is the key
    instance_ids_with_responses = set(r['assessment_id'] for r in all_responses)
    processed_instance_ids = set()
    
    # Find which instances belong to which assessments (for reporting)
    for instance_id in instance_ids_with_responses:
        if instance_id in processed_instance_ids:
            continue
        
        # Check if this instance_id matches any assessment_id (for QA)
        matching_assessment = None
        for assessment in assessments:
            if assessment['assessment_id'] == instance_id:
                matching_assessment = assessment
                break
        
        if matching_assessment:
            # Already processed as assessment
            continue
        
        # Process as standalone instance (for QA assessments)
        # Use instance_id as the "assessment_id" for processing
        print(f"Processing instance: {instance_id} (standalone/QA)...")
        
        v1_count = get_v1_ofc_count_simulation(conn, instance_id, all_responses, baseline)
        v1_counts[instance_id] = v1_count
        
        result = regenerate_ofcs_for_assessment(
            conn,
            instance_id,  # Use instance_id as assessment_id
            baseline,
            migration_lookup,
            ofc_templates,
            all_responses
        )
        
        all_results[instance_id] = result
        processed_instance_ids.add(instance_id)
        print(f"  ✓ Created {result['stats']['total_ofcs_created']} OFCs (v1 simulation: {v1_count})")
    
    conn.close()
    
    # Generate reports
    print("\n" + "=" * 80)
    print("GENERATING REPORTS")
    print("=" * 80)
    print()
    
    success = generate_reports(all_results, baseline, v1_counts, output_dir)
    
    if not success:
        print("\n❌ TASK FAILED: Validation errors detected")
        sys.exit(1)
    
    print("\n✅ TASK COMPLETE: OFC regeneration successful")
    sys.exit(0)


if __name__ == '__main__':
    main()

