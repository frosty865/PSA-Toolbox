#!/usr/bin/env python3
"""
Generate Sector and Subsector Question Layers

This script populates sector- and subsector-specific questions for all disciplines
and subtypes, ensuring they are additive-only and never restate baseline questions.

Rules:
- Baseline questions are universal and already complete
- Sector/subsector questions MUST introduce scope NOT covered by baseline
- Questions are file-authoritative (no database writes)
- All questions must be capability-based (same template style)
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
import psycopg2
from urllib.parse import urlparse

# Question templates by subtype category
QUESTION_TEMPLATES = {
    "SYSTEMS": "The facility has system capabilities to support {subtype_scope} that address {condition}.",
    "PLANS_PROCEDURES": "The facility has documented plans or procedures that enable the facility to manage {subtype_scope} capabilities in support of {condition}.",
    "MAINTENANCE_ASSURANCE": "The facility has defined activities to sustain {subtype_scope} capabilities in environments where {condition} applies.",
    "PERSONNEL_RESPONSIBILITY": "The facility has documented roles and responsibilities for {subtype_scope} capabilities related to {condition}."
}

# Map discipline subtypes to question template categories
# This is a simplified mapping - in practice, you'd need to determine this based on subtype characteristics
SUBTYPE_TEMPLATE_MAP = {
    # Default mappings - these should be refined based on actual subtype characteristics
    "default": "SYSTEMS"
}


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
    # Load environment variables
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..', '..')
    env_file = os.path.join(project_root, 'env.local')
    if not os.path.exists(env_file):
        env_file = os.path.join(project_root, '.env.local')
    if os.path.exists(env_file):
        load_env_file(env_file)
    
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Parse URL to handle SSL requirements
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


def load_baseline_questions(registry_path: str) -> Dict:
    """Load baseline questions from registry."""
    with open(registry_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_baseline_question_texts(baseline_data: Dict) -> Set[str]:
    """Extract all baseline question texts for duplicate checking."""
    questions = set()
    for element in baseline_data.get('required_elements', []):
        question_text = element.get('question_text', '').strip().lower()
        if question_text:
            questions.add(question_text)
    return questions


def load_taxonomy_from_db(conn) -> Tuple[List[Dict], List[Dict], List[Dict], List[Dict]]:
    """Load sectors, subsectors, disciplines, and subtypes from database."""
    cur = conn.cursor()
    
    # Load sectors
    cur.execute("""
        SELECT id, sector_name, name, description, is_active
        FROM sectors
        WHERE is_active = true
        ORDER BY sector_name, name
    """)
    sectors = []
    for row in cur.fetchall():
        sectors.append({
            'id': str(row[0]),
            'sector_name': row[1] or row[2] or 'Unknown',
            'name': row[2] or row[1] or 'Unknown',
            'description': row[3],
            'is_active': row[4]
        })
    
    # Load subsectors
    cur.execute("""
        SELECT id, name, sector_id, description, is_active
        FROM subsectors
        WHERE is_active = true
        ORDER BY name
    """)
    subsectors = []
    for row in cur.fetchall():
        subsectors.append({
            'id': str(row[0]),
            'name': row[1],
            'sector_id': str(row[2]),
            'description': row[3],
            'is_active': row[4]
        })
    
    # Load disciplines
    cur.execute("""
        SELECT id, name, code, description, category, is_active
        FROM disciplines
        WHERE is_active = true
        ORDER BY category, name
    """)
    disciplines = []
    for row in cur.fetchall():
        disciplines.append({
            'id': str(row[0]),
            'name': row[1],
            'code': row[2],
            'description': row[3],
            'category': row[4],
            'is_active': row[5]
        })
    
    # Load discipline subtypes
    cur.execute("""
        SELECT id, name, code, description, discipline_id, is_active
        FROM discipline_subtypes
        WHERE is_active = true
        ORDER BY name
    """)
    subtypes = []
    for row in cur.fetchall():
        subtypes.append({
            'id': str(row[0]),
            'name': row[1],
            'code': row[2],
            'description': row[3],
            'discipline_id': str(row[4]),
            'is_active': row[5]
        })
    
    cur.close()
    return sectors, subsectors, disciplines, subtypes


def determine_template_category(subtype: Dict, discipline: Dict) -> str:
    """Determine which question template category to use for a subtype."""
    # This is a simplified implementation
    # In practice, you'd analyze subtype characteristics, discipline category, etc.
    subtype_name_lower = subtype.get('name', '').lower()
    
    # Heuristic-based mapping
    if 'system' in subtype_name_lower or 'capability' in subtype_name_lower:
        return "SYSTEMS"
    elif 'plan' in subtype_name_lower or 'procedure' in subtype_name_lower or 'policy' in subtype_name_lower:
        return "PLANS_PROCEDURES"
    elif 'maintenance' in subtype_name_lower or 'assurance' in subtype_name_lower or 'testing' in subtype_name_lower:
        return "MAINTENANCE_ASSURANCE"
    elif 'personnel' in subtype_name_lower or 'responsibility' in subtype_name_lower or 'role' in subtype_name_lower:
        return "PERSONNEL_RESPONSIBILITY"
    else:
        return SUBTYPE_TEMPLATE_MAP.get("default", "SYSTEMS")


def generate_question_text(
    template_category: str,
    subtype_scope: str,
    condition: str
) -> str:
    """Generate question text from template."""
    template = QUESTION_TEMPLATES.get(template_category, QUESTION_TEMPLATES["SYSTEMS"])
    return template.format(
        subtype_scope=subtype_scope,
        condition=condition
    )


def should_generate_question(
    baseline_questions: Set[str],
    discipline: Dict,
    subtype: Dict,
    sector: Optional[Dict] = None,
    subsector: Optional[Dict] = None
) -> Tuple[bool, str]:
    """
    Determine if a question should be generated.
    Returns (should_generate, rationale)
    """
    # Check if baseline already covers this discipline/subtype combination
    # This is a simplified check - in practice, you'd need more sophisticated analysis
    rationale = f"Baseline questions do not address {subtype['name']} capabilities in the context of "
    
    if subsector:
        rationale += f"{subsector['name']} subsector within {sector['sector_name']} sector."
        condition = f"{subsector['name']} subsector requirements"
    elif sector:
        rationale += f"{sector['sector_name']} sector."
        condition = f"{sector['sector_name']} sector requirements"
    else:
        return False, ""
    
    # For now, we'll generate questions for all combinations
    # In practice, you'd check doctrine/authority to determine if sector/subsector
    # introduces constraints not covered by baseline
    return True, rationale


def generate_sector_questions(
    baseline_questions: Set[str],
    sectors: List[Dict],
    disciplines: List[Dict],
    subtypes: List[Dict],
    output_dir: Path
) -> Dict[str, int]:
    """Generate sector-level questions."""
    counts = {}
    
    # Group subtypes by discipline
    subtypes_by_discipline: Dict[str, List[Dict]] = {}
    for subtype in subtypes:
        disc_id = subtype['discipline_id']
        if disc_id not in subtypes_by_discipline:
            subtypes_by_discipline[disc_id] = []
        subtypes_by_discipline[disc_id].append(subtype)
    
    # Create discipline lookup
    discipline_lookup = {d['id']: d for d in disciplines}
    
    for sector in sectors:
        sector_name_safe = sector['sector_name'].replace('/', '_').replace('\\', '_')
        sector_dir = output_dir / 'sector' / sector_name_safe
        sector_dir.mkdir(parents=True, exist_ok=True)
        
        sector_count = 0
        
        for discipline in disciplines:
            discipline_name_safe = discipline['name'].replace('/', '_').replace('\\', '_')
            discipline_dir = sector_dir / discipline_name_safe
            discipline_dir.mkdir(parents=True, exist_ok=True)
            
            # Get subtypes for this discipline
            discipline_subtypes = subtypes_by_discipline.get(discipline['id'], [])
            
            for subtype in discipline_subtypes:
                subtype_name_safe = subtype['name'].replace('/', '_').replace('\\', '_')
                output_file = discipline_dir / f"{subtype_name_safe}.json"
                
                # Determine if question should be generated
                should_gen, rationale = should_generate_question(
                    baseline_questions,
                    discipline,
                    subtype,
                    sector=sector
                )
                
                if not should_gen:
                    continue
                
                # Determine template category
                template_category = determine_template_category(subtype, discipline)
                
                # Generate questions for each template category
                questions = []
                condition = f"{sector['sector_name']} sector requirements"
                
                for template_cat in QUESTION_TEMPLATES.keys():
                    question_text = generate_question_text(
                        template_cat,
                        subtype['name'],
                        condition
                    )
                    
                    # Check for duplicates
                    question_lower = question_text.lower().strip()
                    if question_lower in baseline_questions:
                        continue  # Skip if it restates baseline
                    
                    questions.append({
                        "question_text": question_text,
                        "template_category": template_cat,
                        "discipline_id": discipline['id'],
                        "discipline_name": discipline['name'],
                        "discipline_subtype_id": subtype['id'],
                        "discipline_subtype_name": subtype['name'],
                        "sector_id": sector['id'],
                        "sector_name": sector['sector_name']
                    })
                
                if questions:
                    output_data = {
                        "metadata": {
                            "authority_scope": "SECTOR",
                            "sector_id": sector['id'],
                            "sector_name": sector['sector_name'],
                            "discipline_id": discipline['id'],
                            "discipline_name": discipline['name'],
                            "discipline_subtype_id": subtype['id'],
                            "discipline_subtype_name": subtype['name']
                        },
                        "rationale": rationale,
                        "questions": questions
                    }
                    
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(output_data, f, indent=2, ensure_ascii=False)
                    
                    sector_count += len(questions)
        
        counts[sector['sector_name']] = sector_count
        print(f"Generated {sector_count} questions for sector: {sector['sector_name']}")
    
    return counts


def generate_subsector_questions(
    baseline_questions: Set[str],
    sectors: List[Dict],
    subsectors: List[Dict],
    disciplines: List[Dict],
    subtypes: List[Dict],
    output_dir: Path
) -> Dict[str, int]:
    """Generate subsector-level questions."""
    counts = {}
    
    # Group subsectors by sector
    subsectors_by_sector: Dict[str, List[Dict]] = {}
    for subsector in subsectors:
        sector_id = subsector['sector_id']
        if sector_id not in subsectors_by_sector:
            subsectors_by_sector[sector_id] = []
        subsectors_by_sector[sector_id].append(subsector)
    
    # Group subtypes by discipline
    subtypes_by_discipline: Dict[str, List[Dict]] = {}
    for subtype in subtypes:
        disc_id = subtype['discipline_id']
        if disc_id not in subtypes_by_discipline:
            subtypes_by_discipline[disc_id] = []
        subtypes_by_discipline[disc_id].append(subtype)
    
    # Create lookups
    sector_lookup = {s['id']: s for s in sectors}
    discipline_lookup = {d['id']: d for d in disciplines}
    
    for sector in sectors:
        sector_subsectors = subsectors_by_sector.get(sector['id'], [])
        
        for subsector in sector_subsectors:
            sector_name_safe = sector['sector_name'].replace('/', '_').replace('\\', '_')
            subsector_name_safe = subsector['name'].replace('/', '_').replace('\\', '_')
            subsector_dir = output_dir / 'subsector' / sector_name_safe / subsector_name_safe
            subsector_dir.mkdir(parents=True, exist_ok=True)
            
            subsector_count = 0
            
            for discipline in disciplines:
                discipline_name_safe = discipline['name'].replace('/', '_').replace('\\', '_')
                discipline_dir = subsector_dir / discipline_name_safe
                discipline_dir.mkdir(parents=True, exist_ok=True)
                
                # Get subtypes for this discipline
                discipline_subtypes = subtypes_by_discipline.get(discipline['id'], [])
                
                for subtype in discipline_subtypes:
                    subtype_name_safe = subtype['name'].replace('/', '_').replace('\\', '_')
                    output_file = discipline_dir / f"{subtype_name_safe}.json"
                    
                    # Determine if question should be generated
                    should_gen, rationale = should_generate_question(
                        baseline_questions,
                        discipline,
                        subtype,
                        sector=sector,
                        subsector=subsector
                    )
                    
                    if not should_gen:
                        continue
                    
                    # Generate questions
                    questions = []
                    condition = f"{subsector['name']} subsector requirements within {sector['sector_name']} sector"
                    
                    for template_cat in QUESTION_TEMPLATES.keys():
                        question_text = generate_question_text(
                            template_cat,
                            subtype['name'],
                            condition
                        )
                        
                        # Check for duplicates
                        question_lower = question_text.lower().strip()
                        if question_lower in baseline_questions:
                            continue  # Skip if it restates baseline
                        
                        questions.append({
                            "question_text": question_text,
                            "template_category": template_cat,
                            "discipline_id": discipline['id'],
                            "discipline_name": discipline['name'],
                            "discipline_subtype_id": subtype['id'],
                            "discipline_subtype_name": subtype['name'],
                            "sector_id": sector['id'],
                            "sector_name": sector['sector_name'],
                            "subsector_id": subsector['id'],
                            "subsector_name": subsector['name']
                        })
                    
                    if questions:
                        output_data = {
                            "metadata": {
                                "authority_scope": "SUBSECTOR",
                                "sector_id": sector['id'],
                                "sector_name": sector['sector_name'],
                                "subsector_id": subsector['id'],
                                "subsector_name": subsector['name'],
                                "discipline_id": discipline['id'],
                                "discipline_name": discipline['name'],
                                "discipline_subtype_id": subtype['id'],
                                "discipline_subtype_name": subtype['name']
                            },
                            "rationale": rationale,
                            "questions": questions
                        }
                        
                        with open(output_file, 'w', encoding='utf-8') as f:
                            json.dump(output_data, f, indent=2, ensure_ascii=False)
                        
                        subsector_count += len(questions)
            
            counts[f"{sector['sector_name']}/{subsector['name']}"] = subsector_count
            print(f"Generated {subsector_count} questions for subsector: {subsector['name']} ({sector['sector_name']})")
    
    return counts


def validate_questions(
    baseline_questions: Set[str],
    output_dir: Path
) -> Tuple[bool, List[str]]:
    """Validate generated questions for duplicates and baseline restatements."""
    errors = []
    all_generated_questions: Dict[str, List[str]] = {}  # question_text -> [file_paths]
    
    # Collect all generated questions
    for root, dirs, files in os.walk(output_dir):
        for file in files:
            if file.endswith('.json'):
                file_path = Path(root) / file
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        for q in data.get('questions', []):
                            question_text = q.get('question_text', '').strip().lower()
                            if question_text:
                                if question_text not in all_generated_questions:
                                    all_generated_questions[question_text] = []
                                all_generated_questions[question_text].append(str(file_path))
                except Exception as e:
                    errors.append(f"Error reading {file_path}: {e}")
    
    # Check for duplicates
    for question_text, file_paths in all_generated_questions.items():
        if len(file_paths) > 1:
            errors.append(f"Duplicate question found in {len(file_paths)} files: '{question_text[:100]}...'")
            errors.append(f"  Files: {', '.join(file_paths)}")
    
    # Check for baseline restatements
    for question_text in all_generated_questions.keys():
        if question_text in baseline_questions:
            file_paths = all_generated_questions[question_text]
            errors.append(f"Question restates baseline: '{question_text[:100]}...'")
            errors.append(f"  Files: {', '.join(file_paths)}")
    
    return len(errors) == 0, errors


def main():
    """Main execution function."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # Paths
    baseline_registry = project_root / 'analytics' / 'runtime' / 'baseline_questions_registry.json'
    output_dir = project_root / 'analytics' / 'questions'
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load baseline questions
    print("Loading baseline questions...")
    if not baseline_registry.exists():
        print(f"ERROR: Baseline questions registry not found at {baseline_registry}")
        sys.exit(1)
    
    baseline_data = load_baseline_questions(str(baseline_registry))
    baseline_questions = get_baseline_question_texts(baseline_data)
    print(f"Loaded {len(baseline_questions)} baseline questions")
    
    # Load taxonomy from database
    print("Loading taxonomy from database...")
    try:
        conn = get_db_connection()
        sectors, subsectors, disciplines, subtypes = load_taxonomy_from_db(conn)
        conn.close()
        
        print(f"Loaded {len(sectors)} sectors, {len(subsectors)} subsectors, {len(disciplines)} disciplines, {len(subtypes)} subtypes")
    except Exception as e:
        print(f"ERROR: Failed to load taxonomy from database: {e}")
        sys.exit(1)
    
    # Generate sector questions
    print("\nGenerating sector questions...")
    sector_counts = generate_sector_questions(
        baseline_questions,
        sectors,
        disciplines,
        subtypes,
        output_dir
    )
    
    # Generate subsector questions
    print("\nGenerating subsector questions...")
    subsector_counts = generate_subsector_questions(
        baseline_questions,
        sectors,
        subsectors,
        disciplines,
        subtypes,
        output_dir
    )
    
    # Validate
    print("\nValidating generated questions...")
    is_valid, errors = validate_questions(baseline_questions, output_dir)
    
    if not is_valid:
        print("\nVALIDATION FAILED:")
        for error in errors:
            print(f"  {error}")
        sys.exit(1)
    
    print("\nValidation passed!")
    
    # Print summary
    print("\n=== SUMMARY ===")
    print(f"Sector questions:")
    for sector_name, count in sector_counts.items():
        print(f"  {sector_name}: {count} questions")
    print(f"\nSubsector questions:")
    for subsector_key, count in subsector_counts.items():
        print(f"  {subsector_key}: {count} questions")
    
    total_sector = sum(sector_counts.values())
    total_subsector = sum(subsector_counts.values())
    print(f"\nTotal: {total_sector} sector questions, {total_subsector} subsector questions")


if __name__ == '__main__':
    main()

