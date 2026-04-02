#!/usr/bin/env python3
"""Load VOFC Library spreadsheet and create OFC # -> Reference mapping."""
import pandas as pd
import re
from pathlib import Path
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse

def load_vofc_references() -> Dict[int, Dict[str, str]]:
    """
    Load VOFC Library spreadsheet and return mapping of OFC # -> {citation_text, url, publisher, title}
    """
    xlsx_path = Path("docs/reference/VOFC_Library.xlsx")
    if not xlsx_path.exists():
        return {}
    
    df = pd.read_excel(xlsx_path, header=0)
    df.columns = ['Parent Question', 'Child Question', 'V #', 'Vulnerability', 'OFC #', 'Option for Consideration', 'Reference']
    
    # Skip header row if present
    df = df[df['OFC #'].notna()]
    df = df[df['OFC #'] != 'OFC #']  # Remove header row if it's in data
    
    mapping = {}
    
    for _, row in df.iterrows():
        ofc_num = row['OFC #']
        reference = row['Reference']
        
        if pd.isna(ofc_num) or pd.isna(reference):
            continue
        
        # Convert OFC # to int if possible
        try:
            ofc_num = int(float(ofc_num))
        except (ValueError, TypeError):
            continue
        
        # Extract URL from reference
        url_match = re.search(r'https?://[^\s,]+', str(reference))
        url = url_match.group(0) if url_match else None
        
        # Extract publisher (usually first word before comma)
        publisher_match = re.match(r'^([^,]+),', str(reference))
        publisher = publisher_match.group(1).strip() if publisher_match else None
        
        # Extract title (usually between publisher and year, or in parentheses)
        title_match = re.search(r'–\s*([^,]+?)(?:\s*\([^)]+\))?,', str(reference))
        if not title_match:
            title_match = re.search(r',\s*([^,]+?)(?:\s*\([^)]+\))?,', str(reference))
        title = title_match.group(1).strip() if title_match else None
        
        # Clean up title
        if title:
            title = re.sub(r'\s+', ' ', title).strip()
        
        mapping[ofc_num] = {
            'citation_text': str(reference).strip(),
            'url': url,
            'publisher': publisher,
            'title': title or publisher or "Unknown"
        }
    
    return mapping

if __name__ == "__main__":
    mapping = load_vofc_references()
    print(f"Loaded {len(mapping)} OFC references")
    print("\nSample mappings:")
    for ofc_num in sorted(list(mapping.keys())[:5]):
        ref = mapping[ofc_num]
        print(f"  OFC {ofc_num}:")
        print(f"    Publisher: {ref['publisher']}")
        print(f"    Title: {ref['title']}")
        print(f"    URL: {ref['url']}")
        print(f"    Citation: {ref['citation_text'][:100]}...")
