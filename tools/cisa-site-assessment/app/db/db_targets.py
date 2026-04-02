"""
Authoritative database target definitions and normalization.

This module defines the canonical project references for RUNTIME and CORPUS databases
and provides target normalization functions.
"""

TARGETS = {
    "runtime": "wivohgbuuwxoyfyzntsd",
    "corpus": "yylslokiaovdythzrbgt"
}

VALID_TARGETS = set(TARGETS.keys())


def normalize_target(target: str) -> str:
    """
    Normalize a target string to "runtime" or "corpus".
    
    Args:
        target: Target string (case-insensitive, accepts "runtime" or "corpus")
        
    Returns:
        Normalized target: "runtime" or "corpus"
        
    Raises:
        ValueError: If target is not "runtime" or "corpus"
    """
    if not target:
        raise ValueError("Target cannot be empty")
    
    normalized = target.lower().strip()
    
    if normalized not in VALID_TARGETS:
        raise ValueError(
            f"Invalid target '{target}'. Must be one of: {', '.join(sorted(VALID_TARGETS))}"
        )
    
    return normalized


def get_expected_ref(target: str) -> str:
    """
    Get the expected Supabase project reference for a target.
    
    Args:
        target: Normalized target ("runtime" or "corpus")
        
    Returns:
        Expected project reference string
        
    Raises:
        ValueError: If target is invalid
    """
    normalized = normalize_target(target)
    return TARGETS[normalized]


def is_valid_target(target: str) -> bool:
    """
    Check if a target string is valid.
    
    Args:
        target: Target string to validate
        
    Returns:
        True if target is valid, False otherwise
    """
    try:
        normalize_target(target)
        return True
    except ValueError:
        return False
