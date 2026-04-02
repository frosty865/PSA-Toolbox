#!/usr/bin/env python3
"""
IST Text Modernizer
Modernizes phrasing in extracted IST data while preserving meaning.

Performs deterministic rewrites and optional LLM-based modernization.
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
import hashlib

# Forbidden terms that must NOT be introduced
FORBIDDEN_TERMS = [
    "cyber", "cybersecurity", "HIPAA", "PCI", "CJIS", "NIST 800-",
    "data protection", "network", "firewall", "encryption", "malware"
]

def check_forbidden_terms(text: str) -> List[str]:
    """Check if text contains any forbidden terms. Returns list of found terms."""
    found = []
    text_lower = text.lower()
    for term in FORBIDDEN_TERMS:
        if term.lower() in text_lower:
            found.append(term)
    return found

def deterministic_rewrite(text: str) -> str:
    """Apply deterministic rewrite rules."""
    if not text:
        return text
    
    result = text
    
    # Replace dated terms
    replacements = {
        "manpower": "staffing",
        " guards ": " security personnel ",  # Only when referring to roles (with spaces)
        " guard ": " security personnel ",
        "closed circuit television": "video surveillance",
        "CCTV": "video surveillance",
    }
    
    for old, new in replacements.items():
        # Case-insensitive replacement
        result = re.sub(re.escape(old), new, result, flags=re.IGNORECASE)
    
    # Remove double negatives
    result = re.sub(r'\bnot\s+no\b', 'yes', result, flags=re.IGNORECASE)
    result = re.sub(r'\bno\s+not\b', 'yes', result, flags=re.IGNORECASE)
    
    # Normalize question style
    # If it's a question but doesn't end with ?, add it
    if result.strip() and not result.strip().endswith('?'):
        # Check if it looks like a question
        question_starters = ["does", "is", "are", "do", "can", "will", "should", "has", "have"]
        first_word = result.strip().split()[0].lower() if result.strip().split() else ""
        if first_word in question_starters:
            result = result.strip() + "?"
    
    # Remove "should consider" duplications
    result = re.sub(r'\bshould\s+consider\s+should\s+consider\b', 'should consider', result, flags=re.IGNORECASE)
    
    return result.strip()

def modernize_with_llm(text: str, ollama_url: str) -> Optional[str]:
    """Use local Ollama to modernize text. Returns None if unavailable."""
    try:
        import requests
        
        prompt = f"""Rewrite the following text to use modern, clear language while preserving the exact meaning. 
Rules:
- Do NOT add implementation details or "how-to" instructions
- Do NOT mention technologies unless already stated
- Do NOT introduce regulatory, cyber, or data protection language
- Keep the scope focused on physical security, governance, planning, and operations
- Preserve YES/NO answer format if present

Text to modernize:
{text}

Modernized text:"""
        
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": "llama2",  # Default model, can be overridden
                "prompt": prompt,
                "stream": False
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json().get("response", "").strip()
            # Remove any quotes that might wrap the response
            if result.startswith('"') and result.endswith('"'):
                result = result[1:-1]
            return result
        else:
            print(f"  WARNING: Ollama request failed with status {response.status_code}")
            return None
    except ImportError:
        print("  WARNING: requests library not available, skipping LLM pass")
        return None
    except Exception as e:
        print(f"  WARNING: LLM modernization failed: {e}")
        return None

def modernize_record(record: Dict[str, Any], use_llm: bool, ollama_url: Optional[str]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """Modernize a single record. Returns (modernized_record, diff)."""
    diff = {}
    modernized = record.copy()
    
    # Fields to modernize
    text_fields = ["parent_question", "child_node", "vulnerability", "ofc_text"]
    
    for field in text_fields:
        original = record.get(field)
        if not original:
            continue
        
        # Skip Yes/No answers
        if field == "child_node" and original.upper() in ["YES", "NO", "N/A", "N_A"]:
            continue
        
        # Apply deterministic rewrite
        modernized_text = deterministic_rewrite(original)
        
        # Apply LLM if enabled
        if use_llm and ollama_url and modernized_text != original:
            llm_result = modernize_with_llm(modernized_text, ollama_url)
            if llm_result:
                modernized_text = llm_result
        
        # Check for NEWLY INTRODUCED forbidden terms (not already in original)
        original_forbidden = set(check_forbidden_terms(original))
        modernized_forbidden = set(check_forbidden_terms(modernized_text))
        newly_introduced = modernized_forbidden - original_forbidden
        
        if newly_introduced:
            raise ValueError(
                f"Forbidden terms introduced in {field} (row {record.get('row_number')}): {', '.join(sorted(newly_introduced))}"
            )
        
        if modernized_text != original:
            modernized[field] = modernized_text
            diff[field] = {
                "before": original,
                "after": modernized_text
            }
    
    return modernized, diff

def main():
    """Main modernization process."""
    script_dir = Path(__file__).parent
    output_dir = script_dir / "output"
    input_path = output_dir / "ist_normalized_packages.json"
    output_path = output_dir / "ist_normalized_packages_modern.json"
    diff_path = output_dir / "modernize_diff_report.jsonl"
    
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}")
        print("Please run extract_ist_workbook.py first")
        sys.exit(1)
    
    # Check for Ollama (prefer PSA_OLLAMA_URL, fallback to OLLAMA_URL)
    ollama_url = os.getenv("PSA_OLLAMA_URL") or os.getenv("OLLAMA_URL")
    use_llm = bool(ollama_url)
    
    if use_llm:
        print(f"LLM modernization enabled (OLLAMA_URL={ollama_url})")
    else:
        print("LLM modernization disabled (PSA_OLLAMA_URL/OLLAMA_URL not set)")
        print("  Using deterministic rewrites only")
    
    print("=" * 80)
    print("IST Text Modernizer")
    print("=" * 80)
    print()
    print(f"Reading: {input_path}")
    
    # Load packages
    with open(input_path, 'r', encoding='utf-8') as f:
        packages = json.load(f)
    
    # Clear diff file at start
    if diff_path.exists():
        diff_path.unlink()
    
    total_changed = 0
    total_records = 0
    
    # Modernize each discipline
    for disc in packages.get("disciplines", []):
        sheet_name = disc.get("sheet_name", "unknown")
        records = disc.get("records", [])
        print(f"\nProcessing sheet: {sheet_name} ({len(records)} records)")
        
        modernized_records = []
        for record in records:
            total_records += 1
            try:
                modernized, diff = modernize_record(record, use_llm, ollama_url)
                modernized_records.append(modernized)
                
                if diff:
                    total_changed += 1
                    # Write diff to JSONL
                    diff_entry = {
                        "sheet_name": sheet_name,
                        "row_number": record.get("row_number"),
                        "changes": diff
                    }
                    with open(diff_path, 'a', encoding='utf-8') as f:
                        f.write(json.dumps(diff_entry, ensure_ascii=False) + '\n')
            except ValueError as e:
                print(f"  ERROR: {e}")
                sys.exit(1)
            except Exception as e:
                print(f"  ERROR processing record row {record.get('row_number')}: {e}")
                # Continue with original record
                modernized_records.append(record)
        
        disc["records"] = modernized_records
    
    print(f"\nModernized {total_changed}/{total_records} records ({100*total_changed/max(total_records,1):.1f}%)")
    
    # Write modernized packages
    print(f"\nWriting modernized packages: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(packages, f, ensure_ascii=False, indent=2)
    
    print(f"Diff report: {diff_path}")
    print("\n" + "=" * 80)
    print("Modernization complete!")
    print("=" * 80)

if __name__ == "__main__":
    main()

