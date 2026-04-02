#!/usr/bin/env python3
"""List all ALT_SAFE assessment questions from extracted JSON."""

import json
from pathlib import Path

def main():
    json_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'alt_safe_model_extracted.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    questions = []
    for section in data['sections']:
        section_title = section.get('section_title', '')
        for question in section.get('question_items', []):
            questions.append({
                'question_key': question.get('question_key', ''),
                'section': section_title,
                'has_details': len(question.get('conditional_detail_blocks', [])) > 0,
                'has_tech_selector': len(question.get('technology_selectors', [])) > 0
            })
    
    print("=" * 80)
    print("ALT_SAFE ASSESSMENT QUESTIONS")
    print("=" * 80)
    print(f"\nTotal Questions: {len(questions)}\n")
    
    for i, q in enumerate(questions, 1):
        details = " [HAS DETAILS]" if q['has_details'] else ""
        tech = " [HAS TECH SELECTOR]" if q['has_tech_selector'] else ""
        print(f"{i:2d}. {q['question_key']:25s} | {q['section'][:45]}{details}{tech}")
    
    print("\n" + "=" * 80)
    print("\nQuestion Keys (for mapping):")
    for i, q in enumerate(questions, 1):
        print(f"{i:2d}. {q['question_key']}")

if __name__ == '__main__':
    main()

