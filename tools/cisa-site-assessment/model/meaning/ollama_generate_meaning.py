"""
Ollama-based meaning generation (closed world, compression only)
Uses Ollama to compress retrieved evidence into plain-language meaning
"""

import os
import json
import requests
from typing import Dict, List, Optional


def get_ollama_url() -> str:
    """Get Ollama URL from environment or use default.
    
    Priority:
    1. PSA_OLLAMA_URL (canonical PSA_System variable)
    2. OLLAMA_URL (legacy fallback)
    3. Default: http://127.0.0.1:11434
    """
    return os.getenv('PSA_OLLAMA_URL') or os.getenv('OLLAMA_URL') or 'http://127.0.0.1:11434'


def get_ollama_model() -> str:
    """Get Ollama model name from environment or use default."""
    return os.getenv('OLLAMA_MODEL', 'llama2')


def generate_meaning(
    canon_id: str,
    discipline: str,
    question_text: str,
    meaning_goal: str,
    constraints: Dict,
    evidence: List[Dict]
) -> Dict:
    """
    Generate meaning using Ollama (closed world, compression only).
    
    Args:
        canon_id: Question canon_id
        discipline: Discipline code
        question_text: Question text
        meaning_goal: Goal from discipline frame
        constraints: Dict with forbidden_concepts, must_avoid_phrases, max_sentences
        evidence: List of evidence dicts with chunk_id, page_number, text
    
    Returns:
        Dict with meaning_text and citations_used, or error dict
    """
    ollama_url = get_ollama_url()
    model = get_ollama_model()
    
    # Build prompt
    system_prompt = """You generate plain-language explanations for security assessment questions.
You MUST only use the evidence provided. Do not add outside knowledge.
Write at an 8th grade reading level. Short sentences. Conversational.
Your response MUST be valid JSON only, no other text."""

    user_input = {
        "canon_id": canon_id,
        "discipline": discipline,
        "question_text": question_text,
        "meaning_goal": meaning_goal,
        "constraints": constraints,
        "evidence": evidence
    }
    
    user_prompt = f"""Generate a plain-language explanation for this security assessment question.

Question: {question_text}
Discipline: {discipline}
Goal: {meaning_goal}

Constraints:
- Forbidden concepts: {', '.join(constraints.get('forbidden_concepts', []))}
- Must avoid phrases: {', '.join(constraints.get('must_avoid_phrases', []))}
- Maximum sentences: {constraints.get('max_sentences', 3)}

Evidence (use ONLY this evidence):
{json.dumps(evidence, indent=2)}

Generate a meaning that:
1. Teaches one clear idea about what the question is asking
2. Uses only the evidence provided
3. Is written at 8th grade reading level
4. Uses short, conversational sentences
5. Removes doubt about why the question matters

Respond with JSON ONLY:
{{
  "meaning_text": "Three sentences max. Teaches one clear idea. No doubt.",
  "citations_used": ["chunk_id1", "chunk_id2", "chunk_id3"]
}}"""

    try:
        # Call Ollama API
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": model,
                "prompt": f"{system_prompt}\n\n{user_prompt}",
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Lower temperature for more deterministic output
                    "top_p": 0.9
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            return {
                "error": f"Ollama API error: {response.status_code}",
                "response_text": response.text[:200]
            }
        
        # Parse response
        result = response.json()
        response_text = result.get('response', '').strip()
        
        # Try to extract JSON from response
        # Ollama may wrap JSON in markdown code blocks or add extra text
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            json_text = response_text[json_start:json_end]
            try:
                parsed = json.loads(json_text)
                return parsed
            except json.JSONDecodeError:
                pass
        
        # Fallback: try to parse entire response as JSON
        try:
            parsed = json.loads(response_text)
            return parsed
        except json.JSONDecodeError:
            return {
                "error": "Failed to parse JSON from Ollama response",
                "response_text": response_text[:500]
            }
        
    except requests.exceptions.RequestException as e:
        return {
            "error": f"Ollama request failed: {str(e)}"
        }
    except Exception as e:
        return {
            "error": f"Unexpected error: {str(e)}"
        }


if __name__ == '__main__':
    # Test generation
    test_evidence = [
        {
            "chunk_id": "test1",
            "page_number": 12,
            "text": "Biometric access control systems use unique physical characteristics to verify identity."
        },
        {
            "chunk_id": "test2",
            "page_number": 15,
            "text": "Access control systems make entry decisions based on verified identity."
        }
    ]
    
    result = generate_meaning(
        canon_id="BASE-ACS",
        discipline="ACS",
        question_text="Is a Biometric Access capability implemented?",
        meaning_goal="Explain how access control systems verify identity and control entry.",
        constraints={
            "forbidden_concepts": ["maintenance", "inspection"],
            "must_avoid_phrases": ["authoritative guidance", "capability", "assesses whether"],
            "max_sentences": 3
        },
        evidence=test_evidence
    )
    
    print(json.dumps(result, indent=2))
