"""
Orchestrator for generating meanings for the 14 core baseline questions
Uses RAG: retrieval -> Ollama generation -> validation -> storage
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from model.meaning.retrieve_evidence import retrieve_evidence, load_discipline_frames
from model.meaning.ollama_generate_meaning import generate_meaning
from model.meaning.validate_meaning import validate_meaning
from model.db.db import db_select, db_upsert_question_meaning
from model.db.db_config import get_db_mode
import subprocess


def load_core_14_questions() -> List[Dict]:
    """Load the 14 core baseline questions (discipline-level, subtype_code IS NULL)."""
    mode = get_db_mode()
    
    if mode == "postgres":
        query = """
        SELECT 
            canon_id,
            discipline_code,
            question_text
        FROM public.baseline_spines_runtime
        WHERE active = true
          AND subtype_code IS NULL
        ORDER BY discipline_code
        """
        rows = db_select(query)
    else:
        # Supabase REST mode
        rows = db_select(
            'baseline_spines_runtime',
            select='canon_id,discipline_code,question_text',
            filters={'active': 'true', 'subtype_code': 'is.null'},
            limit=100
        )
        # Filter subtype_code IS NULL in Python (PostgREST filter may not work as expected)
        rows = [r for r in rows if r.get('subtype_code') is None]
        # Sort by discipline_code
        rows.sort(key=lambda x: x.get('discipline_code', ''))
    
    return rows


def save_meaning_to_db(
    canon_id: str,
    discipline: str,
    meaning_text: str,
    citations: List[Dict],
    model_name: str,
    warnings: List[str]
) -> bool:
    """Save generated meaning to database using db adapter."""
    try:
        db_upsert_question_meaning(
            canon_id=canon_id,
            discipline=discipline,
            meaning_text=meaning_text,
            citations=citations,
            model_name=model_name,
            warnings=warnings
        )
        return True
    except Exception as e:
        print(f"  ERROR: Failed to save meaning to DB: {e}")
        return False


def build_meaning_for_question(question: Dict) -> Dict:
    """
    Build meaning for a single question.
    
    Returns:
        Dict with success, canon_id, and reason/warnings
    """
    canon_id = question['canon_id']
    discipline = question['discipline_code']
    question_text = question['question_text']
    
    print(f"\nProcessing {canon_id} ({discipline})...")
    print(f"  Question: {question_text}")
    
    result = {
        'canon_id': canon_id,
        'discipline': discipline,
        'success': False,
        'reason': None,
        'warnings': []
    }
    
    # Step 1: Retrieve evidence (with debug report)
    print("  Step 1: Retrieving evidence...")
    evidence, retrieval_warnings, debug_info = retrieve_evidence(canon_id, question_text, discipline, debug_report=True)
    result['warnings'].extend(retrieval_warnings)
    result['retrieval_debug'] = debug_info
    
    # Gate: Only proceed if retrieval passed
    if not debug_info.get('retrieval_passed', False):
        failure_reason = debug_info.get('failure_reason', 'Retrieval failed')
        result['reason'] = failure_reason
        result['retrieval_stats'] = {
            'evidence_before_filtering': debug_info.get('evidence_before_filtering', 0),
            'evidence_after_filtering': debug_info.get('evidence_after_filtering', 0),
            'distinct_documents': debug_info.get('distinct_documents', 0),
            'keywords_extracted': debug_info.get('keywords_extracted', [])
        }
        print(f"  ❌ Retrieval failed: {failure_reason}")
        return result
    
    if not evidence:
        failure_reason = f"No evidence retrieved: {', '.join(retrieval_warnings)}"
        result['reason'] = failure_reason
        print(f"  ❌ {failure_reason}")
        return result
    
    print(f"  ✓ Retrieved {len(evidence)} evidence items from {debug_info.get('distinct_documents', 0)} distinct documents")
    
    # Step 2: Load discipline frame
    frames = load_discipline_frames()
    if discipline not in frames:
        result['reason'] = f"No discipline frame for {discipline}"
        return result
    
    frame = frames[discipline]
    meaning_goal = frame.get('meaning_goal', '')
    forbidden_concepts = frame.get('forbidden_concepts', [])
    
    # Step 3: Generate meaning with Ollama
    print("  Step 2: Generating meaning with Ollama...")
    constraints = {
        'forbidden_concepts': forbidden_concepts,
        'must_avoid_phrases': [
            'authoritative guidance',
            'capability',
            'assesses whether',
            'assumes',
            'OFC'
        ],
        'max_sentences': 3
    }
    
    generation_result = generate_meaning(
        canon_id=canon_id,
        discipline=discipline,
        question_text=question_text,
        meaning_goal=meaning_goal,
        constraints=constraints,
        evidence=evidence
    )
    
    if 'error' in generation_result:
        result['reason'] = f"Ollama generation failed: {generation_result['error']}"
        return result
    
    meaning_text = generation_result.get('meaning_text', '')
    citations_used = generation_result.get('citations_used', [])
    
    if not meaning_text:
        result['reason'] = "Ollama returned empty meaning_text"
        return result
    
    print(f"  Generated meaning: {meaning_text[:100]}...")
    
    # Step 4: Validate meaning
    print("  Step 3: Validating meaning...")
    is_valid, validation_warnings = validate_meaning(
        meaning_text=meaning_text,
        citations_used=citations_used,
        evidence=evidence,
        discipline_frame=frame,
        question_text=question_text
    )
    
    result['warnings'].extend(validation_warnings)
    
    if not is_valid:
        result['reason'] = f"Validation failed: {', '.join(validation_warnings)}"
        return result
    
    # Step 5: Map citations
    citations = []
    for chunk_id in citations_used:
        # Find evidence item with this chunk_id
        evidence_item = next((e for e in evidence if e.get('chunk_id') == chunk_id), None)
        if evidence_item:
            citations.append({
                'chunk_id': chunk_id,
                'corpus_document_id': evidence_item.get('corpus_document_id'),
                'page_number': evidence_item.get('page_number')
            })
    
    # Step 6: Save to database
    print("  Step 4: Saving to database...")
    model_name = os.getenv('OLLAMA_MODEL', 'llama2')
    success = save_meaning_to_db(
        canon_id=canon_id,
        discipline=discipline,
        meaning_text=meaning_text,
        citations=citations,
        model_name=model_name,
        warnings=result['warnings']
    )
    
    if not success:
        result['reason'] = "Failed to save to database"
        return result
    
    result['success'] = True
    result['meaning_text'] = meaning_text
    print(f"  ✓ Success!")
    
    return result


def main():
    """Main orchestrator function."""
    print("=" * 80)
    print("Building meanings for 14 core baseline questions")
    print("=" * 80)
    
    # HARD GATE: Verify DB is reachable before any work
    print("\n[GATE] Verifying database connectivity...")
    try:
        smoketest_path = Path(__file__).parent.parent.parent / "tools" / "db" / "db_smoketest.py"
        result = subprocess.run(
            [sys.executable, str(smoketest_path)],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',  # Replace encoding errors instead of failing
            timeout=15  # Hard timeout for smoketest itself
        )
        
        if result.returncode == 2:
            print("❌ Database unreachable")
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr)
            print("\n❌ Cannot generate meanings without corpus DB.")
            sys.exit(2)
        elif result.returncode == 3:
            print("❌ Missing required database objects")
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr)
            print("\n❌ Cannot generate meanings without corpus DB.")
            sys.exit(3)
        elif result.returncode != 0:
            print("❌ Database smoketest failed")
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr)
            print("\n❌ Cannot generate meanings without corpus DB.")
            sys.exit(result.returncode)
        
        # Print smoketest output for visibility
        if result.stdout:
            print(result.stdout)
        
        print("✓ Database connectivity verified")
    except subprocess.TimeoutExpired:
        print("❌ Database smoketest TIMEOUT (exceeded 15s)")
        print("\n❌ Cannot generate meanings without corpus DB.")
        sys.exit(2)
    except Exception as e:
        print(f"❌ Database smoketest error: {type(e).__name__}: {e}")
        print("\n❌ Cannot generate meanings without corpus DB.")
        sys.exit(2)
    
    # Load questions
    print("\nLoading core 14 questions...")
    questions = load_core_14_questions()
    
    if not questions:
        print("ERROR: No core questions found")
        return
    
    print(f"Found {len(questions)} core questions")
    
    # Process each question
    results = []
    failed_results = []
    
    for question in questions:
        result = build_meaning_for_question(question)
        results.append(result)
        
        # Track failures separately
        if not result['success']:
            failed_results.append({
                'canon_id': result['canon_id'],
                'discipline': result['discipline'],
                'failure_reason': result['reason'],
                'retrieval_stats': result.get('retrieval_debug', {}),
                'warnings': result['warnings']
            })
    
    # Generate report
    print("\n" + "=" * 80)
    print("Summary")
    print("=" * 80)
    
    success_count = sum(1 for r in results if r['success'])
    fail_count = len(results) - success_count
    
    print(f"Total questions: {len(results)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {fail_count}")
    
    # Save success report
    report_dir = Path(__file__).parent.parent.parent / "analytics" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_file = report_dir / "core14_meaning_build.json"
    
    report = {
        'generated_at': str(Path(__file__).stat().st_mtime),
        'total_questions': len(results),
        'successful': success_count,
        'failed': fail_count,
        'results': results
    }
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nSuccess report saved to: {report_file}")
    
    # Save failure report
    if failed_results:
        failed_report_file = report_dir / "core14_meaning_failed.json"
        failed_report = {
            'generated_at': str(Path(__file__).stat().st_mtime),
            'total_failed': len(failed_results),
            'failures': failed_results
        }
        
        with open(failed_report_file, 'w', encoding='utf-8') as f:
            json.dump(failed_report, f, indent=2)
        
        print(f"Failure report saved to: {failed_report_file}")
    
    # Print failures
    if fail_count > 0:
        print("\nFailures:")
        for result in results:
            if not result['success']:
                print(f"  {result['canon_id']}: {result['reason']}")
                if result.get('retrieval_debug'):
                    debug = result['retrieval_debug']
                    print(f"    - Evidence before filtering: {debug.get('evidence_before_filtering', 0)}")
                    print(f"    - Evidence after filtering: {debug.get('evidence_after_filtering', 0)}")
                    print(f"    - Distinct documents: {debug.get('distinct_documents', 0)}")


if __name__ == '__main__':
    main()
