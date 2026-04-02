"""
Router Service Package

Deterministic router service for PSA document intake.
"""

from .router_service import RouterService
from .meta_schema import validate_metadata, load_metadata, create_metadata, ALLOWED_DISCIPLINES, ALLOWED_SOURCE_TYPES
from .hash_utils import sha256_file, sha256_bytes, short_hash

__all__ = [
    "RouterService",
    "validate_metadata",
    "load_metadata",
    "create_metadata",
    "ALLOWED_DISCIPLINES",
    "ALLOWED_SOURCE_TYPES",
    "sha256_file",
    "sha256_bytes",
    "short_hash"
]
