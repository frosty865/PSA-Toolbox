#!/usr/bin/env python3
"""
Metadata Schema Validation for Router

Validates sidecar JSON metadata files that accompany PDFs in staging.
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime
import json

# Allowed discipline codes (PSA scope only)
ALLOWED_DISCIPLINES = {
    "ACS", "COM", "CPTED", "EAP", "EMR", "FAC", "ISC", "INT", 
    "IDS", "KEY", "PER", "SFO", "SMG", "VSS"
}

# Allowed source types
ALLOWED_SOURCE_TYPES = {"corpus", "module"}


def validate_metadata(meta: Dict) -> Tuple[bool, List[str]]:
    """
    Validate metadata dictionary.
    
    Returns:
        (is_valid, list_of_errors)
    """
    errors = []
    
    # Required fields
    if "source_type" not in meta:
        errors.append("source_type is required")
    elif meta["source_type"] not in ALLOWED_SOURCE_TYPES:
        errors.append(f"source_type must be one of {ALLOWED_SOURCE_TYPES}, got: {meta['source_type']}")
    
    if "discipline_code" not in meta:
        errors.append("discipline_code is required")
    elif meta["discipline_code"] not in ALLOWED_DISCIPLINES:
        errors.append(f"discipline_code must be one of {ALLOWED_DISCIPLINES}, got: {meta['discipline_code']}")
    
    if "confirmed_by" not in meta or not meta["confirmed_by"]:
        errors.append("confirmed_by is required (username/operator id)")
    
    if "confirmed_at" not in meta:
        errors.append("confirmed_at is required (ISO8601 timestamp)")
    else:
        # Validate ISO8601 format
        try:
            datetime.fromisoformat(meta["confirmed_at"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            errors.append(f"confirmed_at must be valid ISO8601 format, got: {meta['confirmed_at']}")
    
    # Module-specific validation
    if meta.get("source_type") == "module":
        if "module_id" not in meta or not meta["module_id"]:
            errors.append("module_id is required when source_type is 'module'")
    
    # Subsector validation (subsector_id implies sector_id)
    if "subsector_id" in meta and meta["subsector_id"]:
        if "sector_id" not in meta or not meta["sector_id"]:
            errors.append("subsector_id requires sector_id to be set")
    
    # Optional fields validation (type checking)
    if "module_id" in meta and meta["module_id"] and not isinstance(meta["module_id"], str):
        errors.append("module_id must be a string")
    
    if "sector_id" in meta and meta["sector_id"] and not isinstance(meta["sector_id"], str):
        errors.append("sector_id must be a string")
    
    if "subsector_id" in meta and meta["subsector_id"] and not isinstance(meta["subsector_id"], str):
        errors.append("subsector_id must be a string")
    
    if "source_key" in meta and meta["source_key"] and not isinstance(meta["source_key"], str):
        errors.append("source_key must be a string")
    
    if "notes" in meta and meta["notes"] and not isinstance(meta["notes"], str):
        errors.append("notes must be a string")
    
    return len(errors) == 0, errors


def load_metadata(meta_path: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Load and parse metadata JSON file.
    
    Returns:
        (metadata_dict, error_message)
        If error, metadata_dict is None and error_message is set.
    """
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        
        is_valid, errors = validate_metadata(meta)
        if not is_valid:
            return None, "; ".join(errors)
        
        return meta, None
    except json.JSONDecodeError as e:
        return None, f"Invalid JSON: {e}"
    except FileNotFoundError:
        return None, f"Metadata file not found: {meta_path}"
    except Exception as e:
        return None, f"Error loading metadata: {e}"


def create_metadata(
    source_type: str,
    discipline_code: str,
    confirmed_by: str,
    module_id: Optional[str] = None,
    sector_id: Optional[str] = None,
    subsector_id: Optional[str] = None,
    source_key: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict:
    """
    Create a valid metadata dictionary with current timestamp.
    
    Args:
        source_type: "corpus" or "module"
        discipline_code: One of ALLOWED_DISCIPLINES
        confirmed_by: Username/operator id
        module_id: Required if source_type is "module"
        sector_id: Optional sector identifier
        subsector_id: Optional subsector identifier (requires sector_id)
        source_key: Optional source key
        notes: Optional notes
    
    Returns:
        Validated metadata dictionary
    """
    meta = {
        "source_type": source_type,
        "discipline_code": discipline_code,
        "confirmed_by": confirmed_by,
        "confirmed_at": datetime.utcnow().isoformat() + "Z"
    }
    
    if module_id:
        meta["module_id"] = module_id
    
    if sector_id:
        meta["sector_id"] = sector_id
    
    if subsector_id:
        if not sector_id:
            raise ValueError("subsector_id requires sector_id")
        meta["subsector_id"] = subsector_id
    
    if source_key:
        meta["source_key"] = source_key
    
    if notes:
        meta["notes"] = notes
    
    # Validate before returning
    is_valid, errors = validate_metadata(meta)
    if not is_valid:
        raise ValueError(f"Invalid metadata: {'; '.join(errors)}")
    
    return meta
