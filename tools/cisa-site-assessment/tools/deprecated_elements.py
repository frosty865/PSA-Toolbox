#!/usr/bin/env python3
"""
Helper module for handling deprecated required elements in backend OFC generation.

This module provides functions to check if a required element is deprecated
and should be excluded from OFC generation and baseline views.

Legacy BASE-0xx required elements (component existence) are deprecated
and superseded by Baseline Questions v1 and Component Capability Layer.
"""

import logging
from typing import Dict, Any, Optional, List, Tuple

logger = logging.getLogger(__name__)

# Legacy deprecated element codes for Video Surveillance Systems
LEGACY_DEPRECATED_CODES = [
    'BASE-061', 'BASE-062', 'BASE-063', 'BASE-064',
    'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071'
]

DEPRECATION_REASON = (
    'Superseded by Baseline Questions v1 and Component Capability Layer. '
    'Legacy component existence elements replaced by evidence-backed assessment model.'
)


def is_deprecated_element(element: Dict[str, Any]) -> bool:
    """
    Check if a required element is deprecated.
    
    Args:
        element: Required element dictionary with fields like:
                - status (str): 'active' or 'deprecated'
                - element_code (str): Element code (e.g., 'BASE-061')
                - discipline_name (str): Discipline name
    
    Returns:
        bool: True if element is deprecated, False otherwise
    """
    if not element:
        return False
    
    # Check status field (primary method)
    status = element.get('status', 'active')
    if status == 'deprecated':
        return True
    
    # Legacy check: BASE-061 through BASE-071 for Video Surveillance Systems
    # This is a fallback if status field is not yet populated in database
    element_code = element.get('element_code')
    discipline_name = element.get('discipline_name')
    
    if element_code and element_code in LEGACY_DEPRECATED_CODES:
        if discipline_name == 'Video Surveillance Systems':
            return True
    
    return False


def filter_active_elements(elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filter out deprecated elements from a list of required elements.
    
    Args:
        elements: List of required element dictionaries
    
    Returns:
        List of active (non-deprecated) elements
    """
    if not isinstance(elements, list):
        return []
    
    return [el for el in elements if not is_deprecated_element(el)]


def should_skip_ofc_generation(required_element: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Determine if OFC generation should be skipped for a required element.
    
    Args:
        required_element: Required element dictionary
    
    Returns:
        tuple: (should_skip: bool, reason: str or None)
    """
    if not required_element:
        return False, None
    
    # Check if deprecated
    if is_deprecated_element(required_element):
        reason = required_element.get(
            'deprecated_reason',
            DEPRECATION_REASON
        )
        return True, reason
    
    return False, None


def log_skipped_ofc(
    required_element_code: str,
    reason: str,
    deprecated_reason: Optional[str] = None
) -> None:
    """
    Log when OFC generation is skipped for a deprecated element.
    
    Args:
        required_element_code: Code of the deprecated element
        reason: Reason for skipping (e.g., 'deprecated_required_element')
        deprecated_reason: Detailed deprecation reason if available
    """
    logger.info(
        f"Skipping OFC generation for deprecated element: {required_element_code}",
        extra={
            'required_element_code': required_element_code,
            'reason': reason,
            'deprecated_reason': deprecated_reason,
            'event_type': 'ofc_generation_skipped'
        }
    )


def get_deprecation_info(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Get deprecation information for an element if it is deprecated.
    
    Args:
        element: Required element dictionary
    
    Returns:
        Dictionary with deprecation info or None if not deprecated
    """
    if not is_deprecated_element(element):
        return None
    
    return {
        'is_deprecated': True,
        'deprecated_at': element.get('deprecated_at'),
        'deprecated_reason': element.get('deprecated_reason', DEPRECATION_REASON),
        'status': element.get('status', 'deprecated')
    }


def is_legacy_base0xx_code(element_code: str) -> bool:
    """
    Check if an element code matches the legacy BASE-0xx pattern.
    
    Args:
        element_code: Element code to check
    
    Returns:
        bool: True if code matches BASE-0xx pattern
    """
    if not element_code:
        return False
    
    import re
    return bool(re.match(r'^BASE-0\d{2}$', element_code))


# Example usage in OFC generation:
"""
from tools.deprecated_elements import should_skip_ofc_generation, log_skipped_ofc

def generate_ofcs_for_assessment(assessment_id):
    # ... get required elements and responses ...
    
    for required_element in required_elements:
        should_skip, reason = should_skip_ofc_generation(required_element)
        
        if should_skip:
            log_skipped_ofc(
                required_element_code=required_element.get('element_code'),
                reason='deprecated_required_element',
                deprecated_reason=reason
            )
            continue
        
        # ... continue with normal OFC generation ...
"""

