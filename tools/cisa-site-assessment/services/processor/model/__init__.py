"""
Processor model package: Ollama client and module parser (MODULE generation only).
Keeps module output segregated from baseline/OFC panel logic.
"""

from .ollama_client import get_ollama_url, ollama_chat
from .module_parser_client import (
    build_module_prompt,
    extract_from_chunk_module_parser,
)

__all__ = [
    "get_ollama_url",
    "ollama_chat",
    "build_module_prompt",
    "extract_from_chunk_module_parser",
]
