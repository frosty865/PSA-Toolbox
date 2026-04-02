"""
Processor pipeline: generate module items from chunks via module parser.
"""

from .module_generate_from_chunks import generate_module_items_from_chunks
from .module_generate_from_db_chunks import generate_module_from_chunks
from .module_generate_vulnerability_first import generate_module_vulnerability_first
from .module_generate_two_pass import generate_module_two_pass, load_chunks_from_json

__all__ = [
    "generate_module_items_from_chunks",
    "generate_module_from_chunks",
    "generate_module_vulnerability_first",
    "generate_module_two_pass",
    "load_chunks_from_json",
]
