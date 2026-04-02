"""
Validation function for generated meanings
Hard fails on violations
"""

import re
from typing import Dict, List, Tuple, Optional, Set


def extract_nouns(text: str) -> List[str]:
    """Extract simple nouns from text (basic heuristic)."""
    # Remove common question words and extract capitalized/noun-like words
    words = re.findall(r'\b[A-Z][a-z]+\b', text)
    # Also extract lowercase words that might be nouns (3+ chars, not stop words)
    stop_words = {'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'will', 'shall', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how'}
    lowercase_words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    nouns = [w for w in lowercase_words if w not in stop_words]
    return list(set(words + nouns))


def extract_evidence_nouns(evidence: List[Dict]) -> Set[str]:
    """Extract common nouns from evidence texts (for anchor validation)."""
    all_nouns = set()
    for item in evidence:
        text = item.get('text', '')
        if text:
            nouns = extract_nouns(text)
            all_nouns.update(n.lower() for n in nouns)
    return all_nouns


def validate_meaning(
    meaning_text: str,
    citations_used: List[str],
    evidence: List[Dict],
    discipline_frame: Dict,
    question_text: str
) -> Tuple[bool, List[str]]:
    """
    Validate generated meaning against constraints.
    
    Args:
        meaning_text: Generated meaning text
        citations_used: List of chunk_ids cited
        evidence: Original evidence list
        discipline_frame: Discipline frame dict
        question_text: Original question text
    
    Returns:
        Tuple of (is_valid, warnings)
    """
    warnings = []
    is_valid = True
    
    # Check forbidden concepts
    forbidden_concepts = discipline_frame.get('forbidden_concepts', [])
    meaning_lower = meaning_text.lower()
    for concept in forbidden_concepts:
        if concept.lower() in meaning_lower:
            warnings.append(f"Contains forbidden concept: {concept}")
            is_valid = False
    
    # Check banned phrases
    banned_phrases = [
        "assesses whether",
        "authoritative guidance",
        "capability",
        "assumes",
        "OFC",
        "operational guidance"
    ]
    for phrase in banned_phrases:
        if phrase.lower() in meaning_lower:
            warnings.append(f"Contains banned phrase: {phrase}")
            is_valid = False
    
    # Check sentence count (max 3)
    sentences = re.split(r'[.!?]+', meaning_text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) > 3:
        warnings.append(f"Too many sentences: {len(sentences)} (max 3)")
        is_valid = False
    
    # Check citations_used is subset of evidence chunk_ids
    evidence_chunk_ids = {e.get('chunk_id') for e in evidence}
    citations_set = set(citations_used)
    if not citations_set.issubset(evidence_chunk_ids):
        invalid_citations = citations_set - evidence_chunk_ids
        warnings.append(f"Invalid citations: {invalid_citations}")
        is_valid = False
    
    # Check meaning mentions at least one key noun from question
    question_nouns = extract_nouns(question_text)
    if question_nouns:
        meaning_mentions_noun = any(
            noun.lower() in meaning_lower 
            for noun in question_nouns[:5]  # Check first 5 nouns
        )
        if not meaning_mentions_noun:
            warnings.append("Meaning does not mention any key nouns from question")
            # This is a warning, not a hard fail
    
    # Evidence anchor validation: meaning must contain at least one concrete noun from evidence
    evidence_nouns = extract_evidence_nouns(evidence)
    if evidence_nouns:
        meaning_mentions_evidence_noun = any(
            noun in meaning_lower 
            for noun in evidence_nouns
        )
        if not meaning_mentions_evidence_noun:
            warnings.append("Meaning does not mention any concrete nouns from evidence (possible generic boilerplate)")
            is_valid = False  # Hard fail - prevents generic outputs
    
    return is_valid, warnings


if __name__ == '__main__':
    # Test validation
    test_meaning = "Biometric access control systems verify identity using unique physical characteristics. They make entry decisions based on verified identity. This helps control who can enter secure areas."
    
    test_evidence = [
        {"chunk_id": "test1", "page_number": 12, "text": "Biometric access control..."},
        {"chunk_id": "test2", "page_number": 15, "text": "Access control systems..."}
    ]
    
    test_frame = {
        "forbidden_concepts": ["maintenance", "inspection"],
        "allowed_concepts": ["identity verification", "access control"]
    }
    
    is_valid, warnings = validate_meaning(
        meaning_text=test_meaning,
        citations_used=["test1", "test2"],
        evidence=test_evidence,
        discipline_frame=test_frame,
        question_text="Is a Biometric Access capability implemented?"
    )
    
    print(f"Valid: {is_valid}")
    print(f"Warnings: {warnings}")
