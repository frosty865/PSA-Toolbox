# Backend Reference Provider Module Specification

**Date:** 2025-12-21  
**Purpose:** Centralized module for reading authoritative artifacts in psa-backend  
**Location:** `psa-backend/src/reference_provider/` (or equivalent)

---

## Module Structure

```
psa-backend/
└── src/
    └── reference_provider/
        ├── __init__.py
        ├── taxonomy.py          # Taxonomy files from psa_engine
        ├── candidates.py        # Candidate packages from analytics/candidates
        ├── analytics.py         # Analytics reports from psaback/psa_engine
        ├── library.py           # Library ingestion status
        ├── coverage.py          # Coverage data
        └── config.py            # Path allowlist and configuration
```

---

## Core Principles

1. **Path Allowlist:** Only allowlisted paths can be read
2. **JSON Schema Validation:** Validate JSON structure when schemas available
3. **Clear Error Messages:** Return descriptive errors when artifacts missing
4. **No Raw Filesystem:** Never expose raw filesystem listings
5. **Summary-Level Responses:** Return structured summaries, not raw file content

---

## Configuration Module (`config.py`)

```python
"""Path allowlist and configuration for reference provider."""

from pathlib import Path
from typing import Dict, List

# Base paths (adjust based on psa-backend workspace structure)
PSA_ENGINE_BASE = Path("../psa_engine")  # Adjust to actual path
PSABACK_BASE = Path("../psaback")  # Adjust to actual path
ANALYTICS_BASE = Path("../psa_engine/analytics")  # Adjust to actual path

# Allowed paths (whitelist)
ALLOWED_PATHS = {
    "taxonomy_disciplines": PSA_ENGINE_BASE / "docs" / "doctrine" / "taxonomy" / "disciplines.json",
    "taxonomy_subtypes": PSA_ENGINE_BASE / "docs" / "doctrine" / "taxonomy" / "discipline_subtypes.json",
    "candidates_base": ANALYTICS_BASE / "candidates",
    "coverage_dashboard": PSABACK_BASE / "tools" / "reports" / "CANONICAL_COVERAGE_DASHBOARD.json",
    "gap_reports": ANALYTICS_BASE / "gap_reports",
    "gap_candidates": ANALYTICS_BASE / "gap_candidates",
    "library_base": ANALYTICS_BASE / "library",
    "coverage_library": Path("../coverage_library"),  # Adjust to actual path
}

def validate_path(path: Path) -> bool:
    """Validate that path is in allowlist."""
    resolved = path.resolve()
    for allowed in ALLOWED_PATHS.values():
        try:
            if resolved.is_relative_to(allowed.resolve()):
                return True
        except (ValueError, AttributeError):
            # Python < 3.9 compatibility
            try:
                if str(resolved).startswith(str(allowed.resolve())):
                    return True
            except:
                pass
    return False

def get_allowed_path(key: str) -> Path:
    """Get allowed path by key."""
    if key not in ALLOWED_PATHS:
        raise ValueError(f"Path key '{key}' not in allowlist")
    return ALLOWED_PATHS[key]
```

---

## Taxonomy Module (`taxonomy.py`)

```python
"""Load taxonomy data from psa_engine."""

import json
from pathlib import Path
from typing import Dict, Optional
from .config import get_allowed_path, validate_path

def get_taxonomy_disciplines() -> Dict:
    """
    Load disciplines from psa_engine/docs/doctrine/taxonomy/disciplines.json.
    
    Returns:
        Dict containing disciplines data
        
    Raises:
        FileNotFoundError: If taxonomy file doesn't exist
        ValueError: If JSON is invalid
    """
    path = get_allowed_path("taxonomy_disciplines")
    
    if not path.exists():
        raise FileNotFoundError(f"Taxonomy disciplines file not found: {path}")
    
    if not validate_path(path):
        raise ValueError(f"Path not in allowlist: {path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data

def get_taxonomy_subtypes() -> Dict:
    """
    Load subtypes from psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json.
    
    Returns:
        Dict containing subtypes data
        
    Raises:
        FileNotFoundError: If taxonomy file doesn't exist
        ValueError: If JSON is invalid
    """
    path = get_allowed_path("taxonomy_subtypes")
    
    if not path.exists():
        raise FileNotFoundError(f"Taxonomy subtypes file not found: {path}")
    
    if not validate_path(path):
        raise ValueError(f"Path not in allowlist: {path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data
```

---

## Candidates Module (`candidates.py`)

```python
"""Load candidate packages from analytics/candidates."""

import json
from pathlib import Path
from typing import Dict, List, Optional
from .config import get_allowed_path, validate_path

def get_candidate_packages() -> List[Dict]:
    """
    List candidate packages from analytics/candidates/.
    
    Returns:
        List of candidate package summaries with discipline/subtype info
        
    Raises:
        FileNotFoundError: If candidates directory doesn't exist
    """
    base_path = get_allowed_path("candidates_base")
    
    if not base_path.exists():
        raise FileNotFoundError(f"Candidates directory not found: {base_path}")
    
    if not validate_path(base_path):
        raise ValueError(f"Path not in allowlist: {base_path}")
    
    packages = []
    
    # Scan for discipline/subtype directories
    for discipline_dir in base_path.iterdir():
        if not discipline_dir.is_dir():
            continue
        
        discipline = discipline_dir.name
        
        for subtype_file in discipline_dir.glob("*.json"):
            subtype = subtype_file.stem
            
            packages.append({
                "discipline": discipline,
                "subtype": subtype,
                "path": f"{discipline}/{subtype}"
            })
    
    return sorted(packages, key=lambda x: (x["discipline"], x["subtype"]))

def get_candidate_package(discipline: str, subtype: str) -> Dict:
    """
    Load specific candidate package from analytics/candidates/[discipline]/[subtype].json.
    
    Args:
        discipline: Discipline name
        subtype: Subtype name
        
    Returns:
        Dict containing candidate package data
        
    Raises:
        FileNotFoundError: If candidate package file doesn't exist
        ValueError: If JSON is invalid
    """
    base_path = get_allowed_path("candidates_base")
    package_path = base_path / discipline / f"{subtype}.json"
    
    if not validate_path(package_path):
        raise ValueError(f"Path not in allowlist: {package_path}")
    
    if not package_path.exists():
        raise FileNotFoundError(f"Candidate package not found: {package_path}")
    
    with open(package_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data
```

---

## Analytics Module (`analytics.py`)

```python
"""Load analytics reports from psaback/psa_engine."""

import json
from pathlib import Path
from typing import Dict, List, Optional
from .config import get_allowed_path, validate_path

def get_coverage_dashboard() -> Dict:
    """
    Load coverage dashboard from psaback/tools/reports/CANONICAL_COVERAGE_DASHBOARD.json.
    
    Returns:
        Dict containing coverage dashboard data
        
    Raises:
        FileNotFoundError: If dashboard file doesn't exist
        ValueError: If JSON is invalid
    """
    path = get_allowed_path("coverage_dashboard")
    
    if not validate_path(path):
        raise ValueError(f"Path not in allowlist: {path}")
    
    if not path.exists():
        raise FileNotFoundError(f"Coverage dashboard file not found: {path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data

def get_gap_analysis() -> Dict:
    """
    Load gap analysis from psaback/tools/reports/.
    
    Returns:
        Dict containing gap analysis summary
        
    Raises:
        FileNotFoundError: If gap analysis files don't exist
    """
    reports_base = get_allowed_path("coverage_dashboard").parent
    
    # Find gap analysis files (adjust pattern as needed)
    gap_files = list(reports_base.glob("*gap*analysis*.json"))
    
    if not gap_files:
        raise FileNotFoundError(f"Gap analysis files not found in {reports_base}")
    
    # Load and combine gap analysis data
    gap_data = {}
    for gap_file in gap_files:
        if validate_path(gap_file):
            with open(gap_file, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
                gap_data[gap_file.stem] = file_data
    
    return gap_data

def get_gap_reports() -> Dict:
    """
    Load gap reports from psa_engine/analytics/gap_reports/.
    
    Returns:
        Dict containing gap reports summary
        
    Raises:
        FileNotFoundError: If gap reports directory doesn't exist
    """
    base_path = get_allowed_path("gap_reports")
    
    if not validate_path(base_path):
        raise ValueError(f"Path not in allowlist: {base_path}")
    
    if not base_path.exists():
        raise FileNotFoundError(f"Gap reports directory not found: {base_path}")
    
    # Load all gap report files
    reports = {}
    for report_file in base_path.glob("*.json"):
        if validate_path(report_file):
            with open(report_file, 'r', encoding='utf-8') as f:
                reports[report_file.stem] = json.load(f)
    
    return reports

def get_gap_candidates() -> Dict:
    """
    Load gap candidates from psa_engine/analytics/gap_candidates/.
    
    Returns:
        Dict containing gap candidates summary
        
    Raises:
        FileNotFoundError: If gap candidates directory doesn't exist
    """
    base_path = get_allowed_path("gap_candidates")
    
    if not validate_path(base_path):
        raise ValueError(f"Path not in allowlist: {base_path}")
    
    if not base_path.exists():
        raise FileNotFoundError(f"Gap candidates directory not found: {base_path}")
    
    # Load all gap candidate files
    candidates = {}
    for candidate_file in base_path.glob("*.json"):
        if validate_path(candidate_file):
            with open(candidate_file, 'r', encoding='utf-8') as f:
                candidates[candidate_file.stem] = json.load(f)
    
    return candidates

def get_canonical_content() -> Dict:
    """
    Load canonical content from psaback/tools/reports/.
    
    Returns:
        Dict containing canonical content summary
        
    Raises:
        FileNotFoundError: If canonical content files don't exist
    """
    reports_base = get_allowed_path("coverage_dashboard").parent
    
    # Find canonical content files (adjust pattern as needed)
    canonical_files = list(reports_base.glob("*canonical*.json"))
    
    if not canonical_files:
        raise FileNotFoundError(f"Canonical content files not found in {reports_base}")
    
    # Load and combine canonical content data
    content_data = {}
    for content_file in canonical_files:
        if validate_path(content_file):
            with open(content_file, 'r', encoding='utf-8') as f:
                file_data = json.load(f)
                content_data[content_file.stem] = file_data
    
    return content_data
```

---

## Library Module (`library.py`)

```python
"""Load library ingestion status and coverage data."""

import json
from pathlib import Path
from typing import Dict, List, Optional
from .config import get_allowed_path, validate_path

def get_library_ingestion_status() -> Dict:
    """
    Load library ingestion status from psa_engine/analytics/library/.
    
    Returns:
        Dict containing library ingestion status summary
        
    Raises:
        FileNotFoundError: If library directory doesn't exist
    """
    base_path = get_allowed_path("library_base")
    
    if not validate_path(base_path):
        raise ValueError(f"Path not in allowlist: {base_path}")
    
    if not base_path.exists():
        raise FileNotFoundError(f"Library directory not found: {base_path}")
    
    # Scan library structure and return summary
    status = {
        "total_documents": 0,
        "by_discipline": {},
        "by_component": {}
    }
    
    # Count documents in library structure
    for discipline_dir in base_path.iterdir():
        if not discipline_dir.is_dir():
            continue
        
        discipline = discipline_dir.name
        discipline_count = 0
        
        for component_dir in discipline_dir.iterdir():
            if not component_dir.is_dir():
                continue
            
            component = component_dir.name
            component_count = len(list(component_dir.iterdir()))
            
            discipline_count += component_count
            
            if component not in status["by_component"]:
                status["by_component"][component] = 0
            status["by_component"][component] += component_count
        
        status["by_discipline"][discipline] = discipline_count
        status["total_documents"] += discipline_count
    
    return status

def get_coverage_data() -> Dict:
    """
    Load coverage data from psa_engine filesystem.
    
    Returns:
        Dict containing coverage summary (not raw filesystem listings)
        
    Raises:
        FileNotFoundError: If coverage data doesn't exist
    """
    # Implementation depends on actual coverage data structure
    # Return summary-level data only
    return {
        "message": "Coverage data summary - implement based on actual structure"
    }

def get_ofc_evidence() -> Dict:
    """
    Load OFC evidence from coverage_library/.
    
    IMPORTANT: NO required_element_code references allowed.
    
    Returns:
        Dict containing OFC evidence summary
        
    Raises:
        FileNotFoundError: If coverage_library doesn't exist
    """
    base_path = get_allowed_path("coverage_library")
    
    if not validate_path(base_path):
        raise ValueError(f"Path not in allowlist: {base_path}")
    
    if not base_path.exists():
        raise FileNotFoundError(f"Coverage library not found: {base_path}")
    
    # Load OFC evidence (filter out required_element_code if present)
    evidence = {
        "total_ofcs": 0,
        "by_discipline": {},
        "evidence_summary": []
    }
    
    # Scan coverage_library and return summary
    # DO NOT include required_element_code in response
    
    return evidence
```

---

## Usage Example

```python
from reference_provider.taxonomy import get_taxonomy_disciplines
from reference_provider.candidates import get_candidate_packages

# In route handler:
try:
    disciplines = get_taxonomy_disciplines()
    return jsonify(disciplines), 200
except FileNotFoundError:
    return jsonify({'error': 'Taxonomy file not found'}), 404
except Exception as e:
    return jsonify({'error': str(e)}), 500
```

---

## Error Handling

All functions should:
1. Validate paths against allowlist
2. Return clear error messages
3. Raise `FileNotFoundError` when files don't exist
4. Raise `ValueError` for invalid paths or JSON
5. Never expose raw filesystem paths in error messages

---

**END OF SPECIFICATION**

