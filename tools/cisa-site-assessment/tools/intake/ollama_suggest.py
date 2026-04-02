#!/usr/bin/env python3
"""
Ollama Suggestion Module (Advisory Only)

Provides metadata suggestions using Ollama analysis. PSA-scope only.
Never auto-routes - suggestions must be confirmed by human operator.
"""

import os
import json
import requests
from pathlib import Path
from typing import Dict, Optional
import pdfplumber


# Cyber/IT indicators that should trigger low confidence
CYBER_INDICATORS = [
    "CVE", "NIST", "patching", "endpoint", "segmentation", "firewall",
    "network security", "cybersecurity", "data breach", "encryption",
    "authentication", "access control", "IT security", "information security",
    "cyber attack", "malware", "virus", "ransomware", "phishing"
]


def extract_text_sample(pdf_path: Path, max_pages: int = 5) -> str:
    """
    Extract text sample from PDF (first few pages).
    
    Args:
        pdf_path: Path to PDF file
        max_pages: Maximum pages to extract (default 5)
    
    Returns:
        Extracted text sample
    """
    try:
        text_parts = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages[:max_pages]):
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        
        return "\n\n".join(text_parts)
    except Exception as e:
        return f"[Error extracting text: {e}]"


def check_cyber_indicators(text: str) -> bool:
    """
    Check if text contains cyber/IT indicators.
    
    Args:
        text: Text to check
    
    Returns:
        True if cyber indicators found, False otherwise
    """
    text_lower = text.lower()
    for indicator in CYBER_INDICATORS:
        if indicator.lower() in text_lower:
            return True
    return False


def suggest_metadata(pdf_path: Path) -> Dict:
    """
    Get metadata suggestions from Ollama analysis.
    
    Args:
        pdf_path: Path to PDF file
    
    Returns:
        Dictionary with suggested metadata and confidence:
        {
            "discipline_code": "ACS" | null,
            "source_type": "corpus" | "module",
            "sector_id": str | null,
            "subsector_id": str | null,
            "confidence": float (0.0-1.0),
            "rationale": str
        }
    """
    # Get Ollama configuration
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
    
    # Extract text sample
    text_sample = extract_text_sample(pdf_path)
    
    # Check for cyber indicators
    has_cyber = check_cyber_indicators(text_sample)
    
    if has_cyber:
        return {
            "discipline_code": None,
            "source_type": "corpus",
            "sector_id": None,
            "subsector_id": None,
            "confidence": 0.1,
            "rationale": "Document contains cyber/IT security indicators - outside PSA scope. Manual review required."
        }
    
    # Build prompt (PSA-scope only)
    prompt = f"""Analyze this physical security document and suggest metadata classification.

PSA SCOPE ONLY: Physical security, governance, planning, operations.
EXCLUDE: Cyber security, IT security, data security, network security.

Document text sample:
{text_sample[:2000]}

Provide a JSON response with:
- discipline_code: One of ACS, COM, CPTED, EAP, EMR, FAC, ISC, INT, IDS, KEY, PER, SFO, SMG, VSS (or null if unclear)
- source_type: "corpus" (default) or "module" (only if clearly module-specific)
- sector_id: Sector identifier if strongly indicated (or null)
- subsector_id: Subsector identifier if strongly indicated and sector_id provided (or null)
- confidence: 0.0-1.0 (how confident you are in the classification)
- rationale: Brief explanation (problem-focused, not general)

If the document is about cyber/IT/data security, set confidence low (<0.3) and return null for discipline_code.

Response format (JSON only):
{{
    "discipline_code": "ACS" | null,
    "source_type": "corpus",
    "sector_id": null,
    "subsector_id": null,
    "confidence": 0.8,
    "rationale": "Document focuses on access control systems for physical facilities"
}}"""

    try:
        # Call Ollama API
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=60
        )
        
        if response.status_code != 200:
            return {
                "discipline_code": None,
                "source_type": "corpus",
                "sector_id": None,
                "subsector_id": None,
                "confidence": 0.0,
                "rationale": f"Ollama API error: {response.status_code}"
            }
        
        result = response.json()
        response_text = result.get("response", "")
        
        # Parse JSON from response
        # Ollama may wrap JSON in markdown or add text, so extract JSON object
        try:
            # Try to find JSON object in response
            start_idx = response_text.find("{")
            end_idx = response_text.rfind("}") + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                suggestion = json.loads(json_str)
            else:
                raise ValueError("No JSON object found in response")
        except (json.JSONDecodeError, ValueError) as e:
            return {
                "discipline_code": None,
                "source_type": "corpus",
                "sector_id": None,
                "subsector_id": None,
                "confidence": 0.0,
                "rationale": f"Failed to parse Ollama response: {e}"
            }
        
        # Validate suggestion structure
        if not isinstance(suggestion, dict):
            raise ValueError("Suggestion is not a dictionary")
        
        # Ensure required fields
        result = {
            "discipline_code": suggestion.get("discipline_code"),
            "source_type": suggestion.get("source_type", "corpus"),
            "sector_id": suggestion.get("sector_id"),
            "subsector_id": suggestion.get("subsector_id"),
            "confidence": float(suggestion.get("confidence", 0.0)),
            "rationale": suggestion.get("rationale", "No rationale provided")
        }
        
        # Validate discipline_code if provided
        allowed_disciplines = {
            "ACS", "COM", "CPTED", "EAP", "EMR", "FAC", "ISC", "INT",
            "IDS", "KEY", "PER", "SFO", "SMG", "VSS"
        }
        
        if result["discipline_code"] and result["discipline_code"] not in allowed_disciplines:
            result["discipline_code"] = None
            result["confidence"] = 0.0
            result["rationale"] = f"Invalid discipline_code: {suggestion.get('discipline_code')}"
        
        # Validate source_type
        if result["source_type"] not in ["corpus", "module"]:
            result["source_type"] = "corpus"
        
        # Validate subsector_id requires sector_id
        if result["subsector_id"] and not result["sector_id"]:
            result["subsector_id"] = None
        
        return result
        
    except requests.exceptions.RequestException as e:
        return {
            "discipline_code": None,
            "source_type": "corpus",
            "sector_id": None,
            "subsector_id": None,
            "confidence": 0.0,
            "rationale": f"Ollama connection error: {e}"
        }
    except Exception as e:
        return {
            "discipline_code": None,
            "source_type": "corpus",
            "sector_id": None,
            "subsector_id": None,
            "confidence": 0.0,
            "rationale": f"Error: {e}"
        }
