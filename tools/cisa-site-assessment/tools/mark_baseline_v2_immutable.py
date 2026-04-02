#!/usr/bin/env python3
"""
Mark Baseline v2 Questions as Immutable

Adds immutable flags and source metadata to all Baseline v2 questions.
"""

import json
import os
import sys
from pathlib import Path

def mark_questions_immutable(baseline_path: str, output_path: str = None):
    """Mark all questions in baseline v2 as immutable."""
    if output_path is None:
        output_path = baseline_path
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        baseline = json.load(f)
    
    questions = baseline.get('required_elements', [])
    
    for question in questions:
        # Add metadata if not present
        if 'metadata' not in question:
            question['metadata'] = {}
        
        # Mark as immutable
        question['metadata']['immutable'] = True
        question['metadata']['source'] = 'BASELINE_V2'
        question['metadata']['frozen_version'] = 'Baseline_Questions_v2'
    
    # Update baseline metadata
    baseline['metadata']['questions_marked_immutable'] = True
    baseline['metadata']['immutable_mark_date'] = datetime.now().isoformat() + "Z"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(baseline, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Marked {len(questions)} questions as immutable")
    print(f"✓ Saved to: {output_path}")


if __name__ == '__main__':
    from datetime import datetime
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_v2.json')
    
    mark_questions_immutable(baseline_path)




