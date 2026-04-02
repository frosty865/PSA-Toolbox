#!/usr/bin/env python3
"""
Validate CONTROL_RESILIENCE Gate End-to-End

This script:
1. Finds a CONTROL_RESILIENCE question with an OFC template
2. Finds the QA assessment
3. Ensures prerequisites (EXISTS=YES, OPERABLE=YES) for the same subtype
4. Inserts RESILIENCE=NO response
5. Runs OFC regeneration
6. Verifies the results
"""

import json
import os
import sys
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Set
import psycopg2
from urllib.parse import urlparse


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
    else:
        # Fallback to individual env vars
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'psa'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )


def find_resilience_question_with_ofc():
    """Find a CONTROL_RESILIENCE question that has an OFC template."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    # Load migration table
    migration_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.json')
    with open(migration_path, 'r') as f:
        migration_data = json.load(f)
    
    # Load OFC templates
    ofc_path = os.path.join(project_root, 'public', 'doctrine', 'ofc_templates_baseline_v1.json')
    with open(ofc_path, 'r') as f:
        ofc_templates = json.load(f)
    
    ofc_codes = {t['required_element_code'] for t in ofc_templates}
    
    # Find CONTROL_RESILIENCE questions
    resilience_questions = []
    for entry in migration_data['migration_table']:
        if entry.get('mapped_gate') == 'CONTROL_RESILIENCE':
            question_id = entry['legacy_question_id']
            if question_id in ofc_codes:
                resilience_questions.append({
                    'question_id': question_id,
                    'discipline': entry['discipline'],
                    'subtype': entry['subtype'],
                    'entry': entry
                })
    
    if not resilience_questions:
        raise Exception("No CONTROL_RESILIENCE questions with OFC templates found")
    
    # Use the first one (BASE-022)
    selected = resilience_questions[0]
    print(f"Selected CONTROL_RESILIENCE question: {selected['question_id']}")
    print(f"  Discipline: {selected['discipline']}")
    print(f"  Subtype: {selected['subtype']}")
    
    return selected


def find_qa_assessment(conn):
    """Find the QA assessment and its instance."""
    cur = conn.cursor()
    
    # Check if qa_flag column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessments'
        AND column_name = 'qa_flag'
    """)
    has_qa_flag = cur.fetchone() is not None
    
    result = None
    if has_qa_flag:
        # Try to find by qa_flag first
        cur.execute("""
            SELECT id, facility_name, qa_flag
            FROM public.assessments
            WHERE qa_flag = true
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = cur.fetchone()
    
    if not result:
        # Fallback to name prefix
        if has_qa_flag:
            cur.execute("""
                SELECT id, facility_name, qa_flag
                FROM public.assessments
                WHERE facility_name LIKE '[QA]%'
                ORDER BY created_at DESC
                LIMIT 1
            """)
        else:
            cur.execute("""
                SELECT id, facility_name, NULL as qa_flag
                FROM public.assessments
                WHERE facility_name LIKE '[QA]%'
                ORDER BY created_at DESC
                LIMIT 1
            """)
        result = cur.fetchone()
    
    if not result:
        cur.close()
        raise Exception("No QA assessment found. Please create one first.")
    
    assessment_id, name, qa_flag = result
    print(f"\nFound QA assessment:")
    print(f"  ID: {assessment_id}")
    print(f"  Name: {name}")
    if qa_flag is not None:
        print(f"  QA Flag: {qa_flag}")
    
    # Find existing assessment_instance (check by id first, then by facility_id)
    cur.execute("""
        SELECT id FROM public.assessment_instances
        WHERE id = %s OR facility_id = %s
        LIMIT 1
    """, (assessment_id, assessment_id))
    
    instance_result = cur.fetchone()
    
    if instance_result:
        instance_id = str(instance_result[0])
        print(f"  Instance ID: {instance_id}")
    else:
        # For QA assessments, we can use the assessment_id as the instance_id
        # since the regenerate script checks if assessment_id is itself an instance_id
        # But we still need to create a proper instance for responses
        # Try to find an existing template to use, or use NULL if allowed
        cur.execute("""
            SELECT id FROM public.assessment_templates LIMIT 1
        """)
        template_result = cur.fetchone()
        template_id = template_result[0] if template_result else None
        
        # Try to find an existing instance to see what status it uses
        cur.execute("""
            SELECT status FROM public.assessment_instances LIMIT 1
        """)
        example = cur.fetchone()
        status_value = example[0] if example else None
        
        # Create instance with facility_id = assessment_id so regenerate script can find it
        if template_id and status_value:
            cur.execute("""
                INSERT INTO public.assessment_instances (id, template_id, facility_id, facility_name, status)
                VALUES (gen_random_uuid(), %s, %s, %s, %s)
                RETURNING id
            """, (template_id, assessment_id, name, status_value))
        elif template_id:
            cur.execute("""
                INSERT INTO public.assessment_instances (id, template_id, facility_id, facility_name)
                VALUES (gen_random_uuid(), %s, %s, %s)
                RETURNING id
            """, (template_id, assessment_id, name))
        else:
            # Create instance without template_id (if allowed)
            try:
                if status_value:
                    cur.execute("""
                        INSERT INTO public.assessment_instances (id, facility_id, facility_name, status)
                        VALUES (gen_random_uuid(), %s, %s, %s)
                        RETURNING id
                    """, (assessment_id, name, status_value))
                else:
                    cur.execute("""
                        INSERT INTO public.assessment_instances (id, facility_id, facility_name)
                        VALUES (gen_random_uuid(), %s, %s)
                        RETURNING id
                    """, (assessment_id, name))
                instance_id = str(cur.fetchone()[0])
                conn.commit()
                print(f"  Created Instance ID: {instance_id}")
            except Exception as e:
                # If that fails, use assessment_id as instance_id
                print(f"  ⚠️  Could not create instance: {e}")
                instance_id = assessment_id
                print(f"  Using assessment ID as instance ID: {instance_id}")
                cur.close()
                return str(assessment_id), instance_id
        
        if 'instance_id' not in locals():
            instance_id = str(cur.fetchone()[0])
        conn.commit()
        print(f"  Created Instance ID: {instance_id}")
    
    cur.close()
    
    return str(assessment_id), instance_id


def find_subtype_questions(conn, question_id: str, discipline: str, subtype: str):
    """Find all questions for the same subtype (EXISTS, OPERABLE, RESILIENCE)."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    # Load baseline v2 registry
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_v2.json')
    with open(baseline_path, 'r') as f:
        baseline_data = json.load(f)
    
    # Find questions for this subtype
    subtype_questions = []
    for q in baseline_data['required_elements']:
        if (q.get('discipline_name') == discipline and 
            q.get('discipline_subtype_name') == subtype):
            subtype_questions.append(q)
    
    # Load migration table to get gates
    migration_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.json')
    with open(migration_path, 'r') as f:
        migration_data = json.load(f)
    
    migration_lookup = {e['legacy_question_id']: e for e in migration_data['migration_table']}
    
    # Map questions to gates
    questions_by_gate = {}
    for q in subtype_questions:
        code = q.get('element_code')
        if code in migration_lookup:
            gate = migration_lookup[code].get('mapped_gate')
            if gate:
                questions_by_gate[gate] = q
    
    print(f"\nFound questions for subtype '{subtype}':")
    for gate in ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE']:
        if gate in questions_by_gate:
            q = questions_by_gate[gate]
            print(f"  {gate}: {q.get('element_code')} - {q.get('title', 'N/A')}")
        else:
            print(f"  {gate}: NOT FOUND")
    
    return questions_by_gate


def ensure_prerequisites(conn, instance_id: str, questions_by_gate: Dict):
    """Ensure EXISTS=YES and OPERABLE=YES for the subtype."""
    cur = conn.cursor()
    
    # Check existing responses
    for gate in ['CONTROL_EXISTS', 'CONTROL_OPERABLE']:
        if gate not in questions_by_gate:
            print(f"\n⚠️  Warning: {gate} question not found for this subtype")
            continue
        
        question = questions_by_gate[gate]
        element_code = question.get('element_code')
        
        # Check if response exists
        cur.execute("""
            SELECT response, id
            FROM public.assessment_responses
            WHERE assessment_instance_id = %s
            AND question_template_id = %s
        """, (instance_id, element_code))
        
        result = cur.fetchone()
        
        if result:
            current_response, response_id = result
            print(f"\n{gate} ({element_code}): Current response = {current_response}")
            if current_response != 'YES':
                # Update to YES
                cur.execute("""
                    UPDATE public.assessment_responses
                    SET response = 'YES', responded_at = NOW()
                    WHERE id = %s
                """, (response_id,))
                conn.commit()
                print(f"  → Updated to YES")
        else:
            # Insert YES response
            cur.execute("""
                INSERT INTO public.assessment_responses (
                    id, assessment_instance_id, question_template_id, response, responded_at
                )
                VALUES (gen_random_uuid(), %s, %s, 'YES', NOW())
            """, (instance_id, element_code))
            conn.commit()
            print(f"{gate} ({element_code}): Inserted YES response")
    
    cur.close()


def insert_resilience_no(conn, instance_id: str, question: Dict):
    """Insert RESILIENCE=NO response."""
    cur = conn.cursor()
    element_code = question.get('element_code')
    
    # Check if response exists
    cur.execute("""
        SELECT response, id
        FROM public.assessment_responses
        WHERE assessment_instance_id = %s
        AND question_template_id = %s
    """, (instance_id, element_code))
    
    result = cur.fetchone()
    
    if result:
        current_response, response_id = result
        if current_response == 'NO':
            print(f"\n✓ CONTROL_RESILIENCE ({element_code}) already set to NO")
        else:
            # Update to NO
            cur.execute("""
                UPDATE public.assessment_responses
                SET response = 'NO', responded_at = NOW()
                WHERE id = %s
            """, (response_id,))
            conn.commit()
            print(f"\n✓ Updated CONTROL_RESILIENCE ({element_code}) to NO")
    else:
            # Insert NO response
        cur.execute("""
            INSERT INTO public.assessment_responses (
                id, assessment_instance_id, question_template_id, response, responded_at
            )
            VALUES (gen_random_uuid(), %s, %s, 'NO', NOW())
        """, (instance_id, element_code))
        conn.commit()
        print(f"\n✓ Inserted CONTROL_RESILIENCE ({element_code}) = NO")
    
    cur.close()
    return element_code


def get_nomination_count_before(conn, assessment_id: str, instance_id: str = None):
    """Get count of nominations before regeneration."""
    cur = conn.cursor()
    # Check nominations by assessment_id or finding_id matching our question
    if instance_id:
        cur.execute("""
            SELECT COUNT(*) 
            FROM public.ofc_nominations
            WHERE assessment_id = %s OR assessment_id = %s
        """, (assessment_id, instance_id))
    else:
        cur.execute("""
            SELECT COUNT(*) 
            FROM public.ofc_nominations
            WHERE assessment_id = %s
        """, (assessment_id,))
    count = cur.fetchone()[0]
    cur.close()
    return count


def get_nomination_count_after(conn, assessment_id: str, instance_id: str = None):
    """Get count of nominations after regeneration."""
    cur = conn.cursor()
    
    # Check if gate_triggered_by column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_nominations'
        AND column_name = 'gate_triggered_by'
    """)
    has_gate_column = cur.fetchone() is not None
    
    search_ids = [assessment_id]
    if instance_id:
        search_ids.append(instance_id)
    
    if has_gate_column:
        if len(search_ids) == 2:
            cur.execute("""
                SELECT COUNT(*), 
                       COUNT(*) FILTER (WHERE gate_triggered_by = 'CONTROL_RESILIENCE')
                FROM public.ofc_nominations
                WHERE assessment_id = %s OR assessment_id = %s
            """, (assessment_id, instance_id))
        else:
            cur.execute("""
                SELECT COUNT(*), 
                       COUNT(*) FILTER (WHERE gate_triggered_by = 'CONTROL_RESILIENCE')
                FROM public.ofc_nominations
                WHERE assessment_id = %s
            """, (assessment_id,))
    else:
        # Fallback: count all nominations (can't filter by gate)
        if len(search_ids) == 2:
            cur.execute("""
                SELECT COUNT(*), 0
                FROM public.ofc_nominations
                WHERE assessment_id = %s OR assessment_id = %s
            """, (assessment_id, instance_id))
        else:
            cur.execute("""
                SELECT COUNT(*), 0
                FROM public.ofc_nominations
                WHERE assessment_id = %s
            """, (assessment_id,))
    
    total, resilience_count = cur.fetchone()
    cur.close()
    return total, resilience_count


def get_resilience_nominations(conn, assessment_id: str, question_code: str, instance_id: str = None):
    """Get the new RESILIENCE nominations."""
    cur = conn.cursor()
    
    # Check if gate_triggered_by column exists
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'ofc_nominations'
        AND column_name = 'gate_triggered_by'
    """)
    has_gate_column = cur.fetchone() is not None
    
    if has_gate_column:
        if instance_id:
            cur.execute("""
                SELECT nomination_id, proposed_title, status, submitted_by, submitted_role, gate_triggered_by
                FROM public.ofc_nominations
                WHERE (assessment_id = %s OR assessment_id = %s)
                AND gate_triggered_by = 'CONTROL_RESILIENCE'
                AND (finding_id = %s OR finding_id::text = %s)
                ORDER BY submitted_at DESC
            """, (assessment_id, instance_id, question_code, question_code))
        else:
            cur.execute("""
                SELECT nomination_id, proposed_title, status, submitted_by, submitted_role, gate_triggered_by
                FROM public.ofc_nominations
                WHERE assessment_id = %s
                AND gate_triggered_by = 'CONTROL_RESILIENCE'
                AND (finding_id = %s OR finding_id::text = %s)
                ORDER BY submitted_at DESC
            """, (assessment_id, question_code, question_code))
    else:
        # Fallback: get all nominations for this assessment and question
        if instance_id:
            cur.execute("""
                SELECT nomination_id, proposed_title, status, submitted_by, submitted_role, NULL as gate_triggered_by
                FROM public.ofc_nominations
                WHERE (assessment_id = %s OR assessment_id = %s)
                AND (finding_id = %s OR finding_id::text = %s)
                ORDER BY submitted_at DESC
            """, (assessment_id, instance_id, question_code, question_code))
        else:
            cur.execute("""
                SELECT nomination_id, proposed_title, status, submitted_by, submitted_role, NULL as gate_triggered_by
                FROM public.ofc_nominations
                WHERE assessment_id = %s
                AND (finding_id = %s OR finding_id::text = %s)
                ORDER BY submitted_at DESC
            """, (assessment_id, question_code, question_code))
    
    nominations = []
    for row in cur.fetchall():
        nominations.append({
            'nomination_id': str(row[0]),
            'proposed_title': row[1],
            'status': row[2],
            'submitted_by': row[3],
            'submitted_role': row[4],
            'gate_triggered_by': row[5] if has_gate_column else None
        })
    
    cur.close()
    return nominations


def main():
    print("=" * 80)
    print("CONTROL_RESILIENCE Gate End-to-End Validation")
    print("=" * 80)
    
    # Step 1: Find CONTROL_RESILIENCE question with OFC template
    print("\n[STEP 1] Finding CONTROL_RESILIENCE question with OFC template...")
    resilience_info = find_resilience_question_with_ofc()
    question_id = resilience_info['question_id']
    
    # Step 2: Connect to database and find QA assessment
    print("\n[STEP 2] Finding QA assessment...")
    conn = get_db_connection()
    assessment_id, instance_id = find_qa_assessment(conn)
    
    # Step 3: Find all questions for the subtype
    print("\n[STEP 3] Finding subtype questions...")
    questions_by_gate = find_subtype_questions(
        conn, 
        question_id,
        resilience_info['discipline'],
        resilience_info['subtype']
    )
    
    # Step 4: Ensure prerequisites
    print("\n[STEP 4] Ensuring prerequisites (EXISTS=YES, OPERABLE=YES)...")
    ensure_prerequisites(conn, instance_id, questions_by_gate)
    
    # Step 5: Insert RESILIENCE=NO
    print("\n[STEP 5] Inserting CONTROL_RESILIENCE=NO response...")
    resilience_question = questions_by_gate.get('CONTROL_RESILIENCE')
    if not resilience_question:
        raise Exception(f"CONTROL_RESILIENCE question not found for {resilience_info['subtype']}")
    
    question_code = insert_resilience_no(conn, instance_id, resilience_question)
    
    # Step 6: Get nomination count before
    print("\n[STEP 6] Getting nomination count before regeneration...")
    count_before = get_nomination_count_before(conn, assessment_id, instance_id)
    print(f"  Nominations before: {count_before}")
    
    # Step 7: Run OFC regeneration
    print("\n[STEP 7] Running OFC regeneration script...")
    import subprocess
    script_dir = os.path.dirname(os.path.abspath(__file__))
    regen_script = os.path.join(script_dir, 'regenerate_ofcs_baseline_v2.py')
    
    try:
        result = subprocess.run(
            [sys.executable, regen_script],
            cwd=script_dir,
            capture_output=True,
            text=True,
            timeout=300,
            encoding='utf-8',
            errors='replace'
        )
        if result.returncode == 0:
            print("  ✓ OFC regeneration completed successfully")
            if result.stdout:
                # Show relevant parts of output
                output_lines = result.stdout.split('\n')
                relevant = [l for l in output_lines if 'BASE-022' in l or 'RESILIENCE' in l or '685b407e' in l]
                if relevant:
                    print("  Relevant output:")
                    for line in relevant[-10:]:
                        print(f"    {line}")
        else:
            print(f"  ⚠️  OFC regeneration returned code {result.returncode}")
            if result.stderr:
                print("  Error:", result.stderr[-500:])
    except subprocess.TimeoutExpired:
        print("  ⚠️  OFC regeneration timed out")
    except Exception as e:
        print(f"  ⚠️  Error running OFC regeneration: {e}")
        print("  Please run manually: cd tools && python regenerate_ofcs_baseline_v2.py")
    
    # Step 8: Verify results
    print("\n[STEP 8] Verifying results...")
    count_after, resilience_count = get_nomination_count_after(conn, assessment_id, instance_id)
    print(f"  Nominations after: {count_after}")
    print(f"  RESILIENCE nominations: {resilience_count}")
    
    if count_after > count_before:
        print(f"\n✓ Total nominations increased by {count_after - count_before}")
    else:
        print(f"\n⚠️  Total nominations did not increase (before: {count_before}, after: {count_after})")
    
    # Get the new RESILIENCE nominations
    resilience_nominations = get_resilience_nominations(conn, assessment_id, question_code, instance_id)
    
    if resilience_nominations:
        print(f"\n✓ Found {len(resilience_nominations)} RESILIENCE nomination(s):")
        for nom in resilience_nominations:
            print(f"\n  Nomination ID: {nom['nomination_id']}")
            print(f"    Title: {nom['proposed_title']}")
            print(f"    Status: {nom['status']}")
            print(f"    Submitted by: {nom['submitted_by']}")
            print(f"    Submitted role: {nom['submitted_role']}")
            print(f"    Gate triggered: {nom['gate_triggered_by']}")
            
            # Verify attributes
            if nom['status'] == 'SUBMITTED':
                print(f"    ✓ Status = SUBMITTED")
            else:
                print(f"    ✗ Status = {nom['status']} (expected SUBMITTED)")
            
            if nom['submitted_by'] == 'SYSTEM':
                print(f"    ✓ submitted_by = SYSTEM")
            else:
                print(f"    ✗ submitted_by = {nom['submitted_by']} (expected SYSTEM)")
            
            if nom['submitted_role'] == 'ENGINE':
                print(f"    ✓ submitted_role = ENGINE")
            else:
                print(f"    ✗ submitted_role = {nom['submitted_role']} (expected ENGINE)")
    else:
        print("\n✗ No RESILIENCE nominations found!")
    
    # Check gate distribution from report
    print("\n[STEP 9] Checking gate distribution from report...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    report_path = os.path.join(project_root, 'analytics', 'reports', 'ofc_attachment_report.json')
    if os.path.exists(report_path):
        with open(report_path, 'r') as f:
            report = json.load(f)
        
        if 'gate_distribution' in report:
            gate_dist = report['gate_distribution']
            print(f"\n  Gate Distribution:")
            print(f"    CONTROL_EXISTS: {gate_dist.get('CONTROL_EXISTS', 0)}")
            print(f"    CONTROL_OPERABLE: {gate_dist.get('CONTROL_OPERABLE', 0)}")
            print(f"    CONTROL_RESILIENCE: {gate_dist.get('CONTROL_RESILIENCE', 0)}")
            
            if gate_dist.get('CONTROL_RESILIENCE', 0) > 0:
                print(f"    ✓ CONTROL_RESILIENCE > 0")
            else:
                print(f"    ✗ CONTROL_RESILIENCE = 0 (expected > 0)")
        else:
            print("  ⚠️  Gate distribution not found in report")
    else:
        print("  ⚠️  Report file not found")
    
    conn.close()
    
    print("\n" + "=" * 80)
    print("Validation Complete")
    print("=" * 80)
    print(f"\nQuestion ID used: {question_code}")
    if resilience_nominations:
        print(f"Nomination ID(s): {', '.join([n['nomination_id'] for n in resilience_nominations])}")
    print(f"Gate distribution: CONTROL_RESILIENCE = {resilience_count}")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

