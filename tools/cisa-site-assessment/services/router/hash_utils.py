#!/usr/bin/env python3
"""
Hash Utilities for Router

SHA-256 hashing for file deduplication and receipt generation.
"""

import hashlib
from pathlib import Path
from typing import Optional


def sha256_file(file_path: Path) -> str:
    """
    Calculate SHA-256 hash of a file.
    
    Args:
        file_path: Path to file
    
    Returns:
        Hexadecimal SHA-256 hash string
    """
    sha256 = hashlib.sha256()
    
    with open(file_path, "rb") as f:
        # Read in chunks to handle large files
        while True:
            chunk = f.read(8192)  # 8KB chunks
            if not chunk:
                break
            sha256.update(chunk)
    
    return sha256.hexdigest()


def sha256_bytes(data: bytes) -> str:
    """
    Calculate SHA-256 hash of bytes.
    
    Args:
        data: Bytes to hash
    
    Returns:
        Hexadecimal SHA-256 hash string
    """
    return hashlib.sha256(data).hexdigest()


def short_hash(full_hash: str, length: int = 8) -> str:
    """
    Get short version of hash for filenames.
    
    Args:
        full_hash: Full hexadecimal hash
        length: Length of short hash (default 8)
    
    Returns:
        Short hash string
    """
    return full_hash[:length]
