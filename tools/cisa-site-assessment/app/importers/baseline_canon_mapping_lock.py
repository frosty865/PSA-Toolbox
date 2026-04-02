"""
Baseline Canon Mapping Lock

Freezes resolved baseline canon → RUNTIME schema mapping to prevent drift.
"""

import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Optional, Any

LOCK_PATH = Path(__file__).resolve().parent / "baseline_canon_mapping.lock.json"


def load_lock() -> Optional[Dict]:
    """
    Load mapping lock file if it exists.
    
    Returns:
        Lock document dict if file exists, None otherwise
        
    Raises:
        RuntimeError: If lock file exists but JSON is invalid
    """
    if not LOCK_PATH.exists():
        return None
    
    try:
        with open(LOCK_PATH, 'r', encoding='utf-8') as f:
            lock_doc = json.load(f)
        return lock_doc
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Lock file exists but contains invalid JSON: {LOCK_PATH}\n"
            f"Error: {e}\n"
            f"To fix: Delete the lock file and regenerate with --lock"
        )
    except Exception as e:
        raise RuntimeError(
            f"Failed to load lock file: {LOCK_PATH}\n"
            f"Error: {e}"
        )


def save_lock(mapping: Dict, target: str = "runtime", supabase_project_ref: str = "wivohgbuuwxoyfyzntsd") -> None:
    """
    Save mapping lock file atomically.
    
    Args:
        mapping: Resolved mapping dictionary (must be JSON-serializable)
        target: Target database (default: "runtime")
        supabase_project_ref: Supabase project reference (default: "wivohgbuuwxoyfyzntsd")
        
    Raises:
        RuntimeError: If mapping is not JSON-serializable or write fails
    """
    lock_doc = {
        "lock_version": "v1",
        "locked_at_utc": datetime.now(timezone.utc).isoformat(),
        "target": target,
        "supabase_project_ref": supabase_project_ref,
        "mapping": mapping
    }
    
    # Atomic write: write to temp file then replace
    try:
        # Create parent directory if needed
        LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(
            mode='w',
            encoding='utf-8',
            dir=LOCK_PATH.parent,
            delete=False,
            suffix='.tmp'
        ) as tmp_file:
            json.dump(lock_doc, tmp_file, indent=2, sort_keys=True)
            tmp_path = Path(tmp_file.name)
        
        # Atomic replace
        tmp_path.replace(LOCK_PATH)
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'tmp_path' in locals() and tmp_path.exists():
            try:
                tmp_path.unlink()
            except:
                pass
        
        raise RuntimeError(
            f"Failed to write lock file: {LOCK_PATH}\n"
            f"Error: {e}"
        )


def normalize_mapping_for_compare(mapping: Dict) -> Dict:
    """
    Normalize mapping for equality comparison.
    
    Includes only:
    - table name
    - column mappings
    - fixed values
    
    Excludes:
    - timestamps
    - environment-specific noise
    - probe artifacts
    
    Args:
        mapping: Mapping dictionary to normalize
        
    Returns:
        Normalized mapping dict for comparison
    """
    normalized = {
        'pattern': mapping.get('pattern'),
        'table': mapping.get('table'),
        'columns': mapping.get('columns', {}).copy(),
        'fixed_values': mapping.get('fixed_values', {}).copy()
    }
    
    # Remove None values from columns and fixed_values
    normalized['columns'] = {k: v for k, v in normalized['columns'].items() if v is not None}
    normalized['fixed_values'] = {k: v for k, v in normalized['fixed_values'].items() if v is not None}
    
    return normalized


def assert_lock_matches(auto_mapping: Dict, lock_doc: Dict) -> None:
    """
    Assert that auto-detected mapping matches the lock.
    
    Args:
        auto_mapping: Auto-detected mapping from resolve_mapping()
        lock_doc: Lock document from load_lock()
        
    Raises:
        RuntimeError: If mappings don't match (with details)
    """
    lock_mapping = lock_doc.get('mapping', {})
    
    # Normalize both for comparison
    auto_norm = normalize_mapping_for_compare(auto_mapping)
    lock_norm = normalize_mapping_for_compare(lock_mapping)
    
    # Compare
    if auto_norm != lock_norm:
        # Build detailed error message
        import json
        auto_str = json.dumps(auto_norm, indent=2, sort_keys=True)
        lock_str = json.dumps(lock_norm, indent=2, sort_keys=True)
        
        raise RuntimeError(
            f"Schema drift detected: Auto-detected mapping differs from lock file.\n"
            f"\n"
            f"Lock file: {LOCK_PATH}\n"
            f"Locked at: {lock_doc.get('locked_at_utc', 'unknown')}\n"
            f"\n"
            f"Auto-detected mapping:\n{auto_str}\n"
            f"\n"
            f"Locked mapping:\n{lock_str}\n"
            f"\n"
            f"This indicates the database schema has changed since the lock was created.\n"
            f"To fix:\n"
            f"  1. If schema change was intentional: Regenerate lock with --lock\n"
            f"  2. If schema change was unexpected: Investigate schema changes\n"
            f"  3. To ignore lock temporarily: Use --no-lock-prefer (not recommended)"
        )
