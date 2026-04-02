#!/usr/bin/env python3
"""
Generate baseline component coverage report.

This report is informational only and shows:
- Components by discipline
- Number of questions per component
- Components with zero questions (if any)
"""

import json
from pathlib import Path
from collections import defaultdict

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.parent.parent
COMPONENT_LIBRARY = SCRIPT_DIR / "model" / "canonical_library" / "v1" / "physical_security_components.json"
MAPPING_FILE = SCRIPT_DIR / "analytics" / "mappings" / "baseline_question_component_map.json"
OUTPUT_FILE = SCRIPT_DIR / "analytics" / "reports" / "baseline_component_coverage.json"


def load_json(filepath):
    """Load JSON file and return parsed data."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_report():
    """Generate component coverage report."""
    print("Loading files...")
    components_data = load_json(COMPONENT_LIBRARY)
    mapping_data = load_json(MAPPING_FILE)
    
    # Build component to question mapping
    component_to_questions = defaultdict(list)
    for mapping in mapping_data["mappings"]:
        question_code = mapping["question_code"]
        question_title = mapping.get("question_title", "")
        for component_code in mapping["components"]:
            component_to_questions[component_code].append({
                "question_code": question_code,
                "question_title": question_title
            })
    
    # Build discipline grouping
    components_by_discipline = defaultdict(list)
    for component in components_data["components"]:
        discipline = component["discipline"]
        component_code = component["code"]
        question_count = len(component_to_questions.get(component_code, []))
        
        components_by_discipline[discipline].append({
            "component_code": component_code,
            "component_name": component["name"],
            "question_count": question_count,
            "questions": component_to_questions.get(component_code, [])
        })
    
    # Build report structure
    report = {
        "baseline_version": "Baseline_Questions_v1",
        "generated_at": str(Path(__file__).stat().st_mtime),
        "description": "Component-level coverage analysis for Baseline Questions v1. This report is informational only.",
        "summary": {
            "total_components": len(components_data["components"]),
            "components_with_questions": len([c for c in components_data["components"] 
                                             if component_to_questions.get(c["code"])]),
            "components_with_zero_questions": len([c for c in components_data["components"] 
                                                  if not component_to_questions.get(c["code"])]),
            "total_questions_mapped": len(mapping_data["mappings"])
        },
        "components_by_discipline": {}
    }
    
    # Add discipline data
    for discipline, comps in sorted(components_by_discipline.items()):
        report["components_by_discipline"][discipline] = {
            "component_count": len(comps),
            "components_with_questions": len([c for c in comps if c["question_count"] > 0]),
            "components_with_zero_questions": len([c for c in comps if c["question_count"] == 0]),
            "components": sorted(comps, key=lambda x: (-x["question_count"], x["component_code"]))
        }
    
    # Add zero-question components list
    zero_question_components = [
        {
            "component_code": c["code"],
            "component_name": c["name"],
            "discipline": c["discipline"]
        }
        for c in components_data["components"]
        if not component_to_questions.get(c["code"])
    ]
    
    report["components_with_zero_questions"] = sorted(
        zero_question_components,
        key=lambda x: (x["discipline"], x["component_code"])
    )
    
    # Write report
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\nReport generated: {OUTPUT_FILE}")
    print(f"Total components: {report['summary']['total_components']}")
    print(f"Components with questions: {report['summary']['components_with_questions']}")
    print(f"Components with zero questions: {report['summary']['components_with_zero_questions']}")
    print(f"Total questions mapped: {report['summary']['total_questions_mapped']}")


if __name__ == "__main__":
    generate_report()

