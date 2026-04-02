#!/usr/bin/env python3
"""
PDF Citation Metadata Extractor

Deterministic extraction of citation-ready metadata from PDFs:
- PDF metadata (raw)
- Title inference with confidence scoring
- Publisher inference (conservative)
- Publication date inference
- Citation string generation

Rules:
- Deterministic, repeatable, idempotent
- No fake data - if it doesn't work, return null/warnings
- Reject numeric-only titles
- Conservative publisher inference
"""

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date
import calendar


def extract_pdf_metadata(pdf_path: str) -> Dict[str, Optional[str]]:
    """
    Extract raw PDF metadata using pypdf (preferred) or pdfplumber.
    Returns dict with pdf_meta_* fields.
    """
    meta = {
        'pdf_meta_title': None,
        'pdf_meta_author': None,
        'pdf_meta_subject': None,
        'pdf_meta_creator': None,
        'pdf_meta_producer': None,
        'pdf_meta_creation_date': None,
        'pdf_meta_mod_date': None,
    }
    
    try:
        # Try pdfplumber first (already in use in codebase)
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                if pdf.metadata:
                    metadata = pdf.metadata
                    meta['pdf_meta_title'] = metadata.get('Title')
                    meta['pdf_meta_author'] = metadata.get('Author')
                    meta['pdf_meta_subject'] = metadata.get('Subject')
                    meta['pdf_meta_creator'] = metadata.get('Creator')
                    meta['pdf_meta_producer'] = metadata.get('Producer')
                    
                    # pdfplumber may return dates as strings or datetime objects
                    creation_date = metadata.get('CreationDate')
                    mod_date = metadata.get('ModDate')
                    
                    if creation_date:
                        if isinstance(creation_date, datetime):
                            meta['pdf_meta_creation_date'] = creation_date
                        else:
                            meta['pdf_meta_creation_date'] = parse_pdf_date(str(creation_date))
                    if mod_date:
                        if isinstance(mod_date, datetime):
                            meta['pdf_meta_mod_date'] = mod_date
                        else:
                            meta['pdf_meta_mod_date'] = parse_pdf_date(str(mod_date))
        except ImportError:
            # Fallback to pypdf
            from pypdf import PdfReader
            with open(pdf_path, 'rb') as f:
                reader = PdfReader(f)
                if reader.metadata:
                    metadata = reader.metadata
                    meta['pdf_meta_title'] = metadata.get('/Title')
                    meta['pdf_meta_author'] = metadata.get('/Author')
                    meta['pdf_meta_subject'] = metadata.get('/Subject')
                    meta['pdf_meta_creator'] = metadata.get('/Creator')
                    meta['pdf_meta_producer'] = metadata.get('/Producer')
                    
                    # Parse dates (PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm)
                    creation_date = metadata.get('/CreationDate')
                    mod_date = metadata.get('/ModDate')
                    
                    if creation_date:
                        meta['pdf_meta_creation_date'] = parse_pdf_date(creation_date)
                    if mod_date:
                        meta['pdf_meta_mod_date'] = parse_pdf_date(mod_date)
    except Exception as e:
        # If extraction fails, return empty metadata (don't fail)
        pass
    
    return meta


def parse_pdf_date(date_str: str) -> Optional[datetime]:
    """
    Parse PDF date format: D:YYYYMMDDHHmmSSOHH'mm
    Returns datetime or None if parsing fails.
    """
    if not date_str:
        return None
    
    # Remove D: prefix if present
    date_str = date_str.replace('D:', '')
    
    # Try to extract YYYYMMDD
    if len(date_str) >= 8:
        try:
            year = int(date_str[0:4])
            month = int(date_str[4:6])
            day = int(date_str[6:8])
            return datetime(year, month, day)
        except (ValueError, IndexError):
            pass
    
    return None


def extract_first_page_text(pdf_path: str) -> Optional[str]:
    """
    Extract text from first page only (no OCR).
    Returns first page text or None.
    """
    try:
        # Try pdfplumber first (better text extraction, already in use)
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                if len(pdf.pages) > 0:
                    first_page = pdf.pages[0]
                    text = first_page.extract_text()
                    return text.strip() if text else None
        except ImportError:
            pass
        
        # Fallback to pypdf
        try:
            from pypdf import PdfReader
            with open(pdf_path, 'rb') as f:
                reader = PdfReader(f)
                if len(reader.pages) > 0:
                    first_page = reader.pages[0]
                    text = first_page.extract_text()
                    return text.strip() if text else None
        except ImportError:
            pass
    except Exception:
        pass
    
    return None


# Number of cover pages used for title/publisher/date extraction (first N pages).
COVER_PAGES_FOR_METADATA = 2


def extract_text_from_pages(pdf_path: str, max_pages: int = 3) -> Optional[str]:
    """
    Extract text from first N pages (chunk-sized). Lets title be pullable from
    chunks when the first page alone doesn't yield a title (e.g. cover image, TOC).
    Returns combined text or None.
    """
    try:
        try:
            import pdfplumber
            with pdfplumber.open(pdf_path) as pdf:
                parts = []
                for i, page in enumerate(pdf.pages):
                    if i >= max_pages:
                        break
                    text = page.extract_text()
                    if text and text.strip():
                        parts.append(text.strip())
                return "\n\n".join(parts) if parts else None
        except ImportError:
            pass

        try:
            from pypdf import PdfReader
            with open(pdf_path, 'rb') as f:
                reader = PdfReader(f)
                parts = []
                for i in range(min(len(reader.pages), max_pages)):
                    text = reader.pages[i].extract_text()
                    if text and text.strip():
                        parts.append(text.strip())
                return "\n\n".join(parts) if parts else None
        except ImportError:
            pass
    except Exception:
        pass
    return None


def is_numeric_only(s: str) -> bool:
    """
    Strict check: is string numeric-only (digits only, no other chars)?
    Returns True if string contains ONLY digits.
    """
    if not s:
        return False
    return bool(re.fullmatch(r'\d+', s.strip()))


def is_hash_like_title(s: str) -> bool:
    """
    Check if string looks like a content hash or hash-derived identifier.
    NO hash (or hash-like stem) may be used as a document title.

    Returns True for:
    - Hex-only strings (e.g. 8+ chars [a-fA-F0-9], like SHA256 prefix or full hash)
    - Long alphanumeric strings with no spaces (e.g. 20+ chars, ID-like)
    - Stem that is only hex with optional single hyphen/underscore (e.g. abc123def_xyz)
    """
    if not s or not isinstance(s, str):
        return True
    t = s.strip()
    if not t:
        return True
    # Hex-only: 8+ chars, only [a-fA-F0-9]
    if len(t) >= 8 and re.fullmatch(r'[a-fA-F0-9]+', t):
        return True
    # Long alphanumeric with no spaces (e.g. UUID without dashes, or hash-like ID)
    if len(t) >= 20 and ' ' not in t and re.fullmatch(r'[a-zA-Z0-9_-]+', t):
        # Allow if it looks like a real title: multiple words when split by _ or -
        parts = re.split(r'[-_]', t)
        if len(parts) < 2 or any(len(p) >= 16 for p in parts):
            return True
    # Short hex-like (e.g. 6–7 hex chars) often used as blob prefixes
    if len(t) >= 6 and len(t) <= 12 and re.fullmatch(r'[a-fA-F0-9]+', t):
        return True
    return False


def is_junk_title(candidate: str) -> bool:
    """
    Check if title candidate should be rejected as junk.
    Rules:
    - Numeric-only (strict check - NEVER allow)
    - Numeric-dominant (80%+ digits)
    - Shorter than 6 chars
    - Generic tokens only
    """
    if not candidate:
        return True
    
    candidate = candidate.strip()
    
    # STRICT: Numeric-only is NEVER allowed
    if is_numeric_only(candidate):
        return True
    
    if len(candidate) < 6:
        return True
    
    # Numeric-dominant (e.g., "897986", "888328")
    digits = sum(1 for c in candidate if c.isdigit())
    if digits >= len(candidate) * 0.8:  # 80%+ digits
        return True
    
    # Generic / non-title tokens (single-word or leading phrase)
    generic_tokens = [
        'untitled', 'document', 'scan', 'file', 'pdf', 'page', 'new document',
        'counting',  # section label, not a document title
    ]
    candidate_lower = candidate.lower().strip()
    # Normalize trailing " -" / "- " / " —" / "— " so "counting -" or "title —" are normalized
    for suffix in (' -', '- ', ' - ', ' —', '— ', ' — '):
        if candidate_lower.endswith(suffix):
            candidate_lower = candidate_lower[: -len(suffix)].strip()
    # Em dash (—) or hyphen alone are not valid titles
    if candidate_lower in ("-", "\u2014") or not candidate_lower:
        return True
    for token in generic_tokens:
        if candidate_lower == token or candidate_lower.startswith(token + ' '):
            return True

    return False


def infer_title_from_first_page(first_page_text: str) -> Optional[Tuple[str, int]]:
    """
    Infer title from first page text using heading heuristics.
    Returns (title, confidence) or None.
    
    Improved strategy:
    1. Look for multi-line titles (consecutive non-empty lines)
    2. Prefer Title Case or ALL CAPS
    3. Look for prominent text in first ~60 lines (cover page area)
    4. Reject footer/header artifacts
    """
    if not first_page_text:
        return None
    
    lines = first_page_text.split('\n')
    
    # Look at first ~60 lines (cover page area - increased from 40)
    candidate_lines = lines[:60]
    
    # Strategy 1: Look for multi-line titles (consecutive non-empty lines)
    # Titles on cover pages often span 2-4 lines
    multi_line_candidates = []
    current_group = []
    
    for i, line in enumerate(candidate_lines):
        line = line.strip()
        
        if line and len(line) >= 4:  # Lower threshold for multi-line
            # Skip obvious headers/footers (but check if current group should be saved first)
            if any(skip in line.lower() for skip in ['page', 'page 1', 'confidential', 'draft', 'version', 'table of contents']):
                if current_group and len(current_group) >= 1:
                    multi_line_candidates.append(current_group)
                current_group = []
                continue
            
            # Skip lines that are mostly numbers or special chars
            if is_junk_title(line):
                if current_group and len(current_group) >= 1:
                    multi_line_candidates.append(current_group)
                current_group = []
                continue
            
            current_group.append(line)
        else:
            # Empty line - end current group if it exists
            if current_group and len(current_group) >= 1:
                multi_line_candidates.append(current_group)
                current_group = []
    
    # Don't forget the last group if we reached end of candidate lines
    if current_group and len(current_group) >= 1:
        multi_line_candidates.append(current_group)
    
    # Check if we have a good multi-line candidate (prefer first/earliest one)
    for group in multi_line_candidates:
        if len(group) >= 1 and len(group) <= 5:  # 1-5 lines is reasonable for a title
            combined = ' '.join(group)
            # Check if combined title is reasonable
            if len(combined) >= 10 and len(combined) <= 200:  # Reasonable title length
                words = combined.split()
                if len(words) >= 2:  # At least 2 words
                    # Prefer Title Case or ALL CAPS
                    is_title_case = combined.istitle() or (combined.isupper() and len(combined) < 150)
                    confidence = 75 if is_title_case else 60
                    return (combined, confidence)
    
    # Strategy 2: Look for single prominent line (original logic, improved)
    for line in candidate_lines:
        line = line.strip()
        
        if not line or len(line) < 6:
            continue
        
        # Skip obvious headers/footers
        if any(skip in line.lower() for skip in ['page', 'page 1', 'confidential', 'draft', 'version', 'table of contents', 'copyright', 'all rights reserved']):
            continue
        
        # Skip lines that are mostly numbers or special chars
        if is_junk_title(line):
            continue
        
        # Prefer Title Case or ALL CAPS (but not all caps if too long)
        is_title_case = line.istitle() or (line.isupper() and len(line) < 100)
        
        # Check if line has meaningful words (not just numbers/punctuation)
        words = line.split()
        if len(words) >= 2:  # At least 2 words
            confidence = 70 if is_title_case else 50
            return (line, confidence)
    
    # Strategy 3: Fallback - first reasonable line (even if single word, if long enough)
    for line in candidate_lines:
        line = line.strip()
        if len(line) >= 10 and not is_junk_title(line):
            # Skip obvious non-titles
            if any(skip in line.lower() for skip in ['page', 'page 1', 'confidential', 'draft', 'version']):
                continue
            return (line, 40)
    
    return None


def clean_filename_stem(file_stem: str) -> str:
    """
    Clean filename stem for title inference:
    - Replace underscores/hyphens with spaces
    - Strip "508" and date suffixes if present
    - Title-case intelligently
    """
    # Replace separators
    cleaned = file_stem.replace('_', ' ').replace('-', ' ')
    
    # Remove "508" suffix (accessibility version indicator)
    cleaned = re.sub(r'\s*508\s*$', '', cleaned, flags=re.IGNORECASE)
    
    # Remove date suffixes (YYYYMMDD or YYYY-MM-DD)
    cleaned = re.sub(r'\s*\d{4}[-/]?\d{2}[-/]?\d{2}\s*$', '', cleaned)
    cleaned = re.sub(r'\s*\d{8}\s*$', '', cleaned)
    
    # Title case (but preserve acronyms)
    words = cleaned.split()
    title_words = []
    for word in words:
        if word.isupper() and len(word) <= 5:  # Preserve short acronyms
            title_words.append(word)
        else:
            title_words.append(word.title())
    
    return ' '.join(title_words).strip()


def infer_title(
    pdf_meta_title: Optional[str],
    first_page_text: Optional[str],
    file_stem: str,
    chunk_text: Optional[str] = None,
) -> Tuple[Optional[str], int, List[str]]:
    """
    Infer title with confidence scoring.
    Returns (inferred_title, confidence, warnings).

    Precedence:
    1. pdf_meta_title if present and not junk (confidence 90)
    2. first-page heading heuristic (confidence 70)
    3. chunk text (first N pages) heading heuristic if first page didn't yield (confidence 65)
    4. filename stem cleaned (confidence 50)
    5. fallback (confidence 10)

    HARD RULE: Numeric-only titles are NEVER allowed.
    Title is pullable from chunks when metadata and first page fail.
    """
    warnings = []

    # 1. Try PDF metadata title (strip .pdf if present)
    if pdf_meta_title:
        pdf_meta_title = _strip_pdf_extension_from_title(pdf_meta_title) or pdf_meta_title.strip()
        if is_numeric_only(pdf_meta_title):
            warnings.append('rejected_numeric_title_candidate')
        elif not is_junk_title(pdf_meta_title):
            return (pdf_meta_title, 90, warnings)

    # 2. Try first-page heading
    if first_page_text:
        result = infer_title_from_first_page(first_page_text)
        if result:
            title, confidence = result
            if is_numeric_only(title):
                warnings.append('rejected_numeric_title_candidate')
            elif not is_junk_title(title):
                return (title, confidence, warnings)

    # 3. Try chunk text (first N pages) so title is pullable from chunks
    if chunk_text and chunk_text.strip() and chunk_text != (first_page_text or ''):
        result = infer_title_from_first_page(chunk_text.strip())
        if result:
            title, confidence = result
            if is_numeric_only(title):
                warnings.append('rejected_numeric_title_candidate')
            elif not is_junk_title(title):
                return (title, min(confidence, 65), warnings)

    # 4. Try filename stem — NEVER use hash or hash-like stem as title
    if file_stem:
        if is_hash_like_title(file_stem):
            warnings.append('hash_filename_no_title')
            return (None, 10, warnings)
        # STRICT: Check if stem is numeric-only BEFORE cleaning
        if is_numeric_only(file_stem):
            warnings.append('numeric_filename_no_title')
            return (None, 10, warnings)
        
        cleaned_stem = clean_filename_stem(file_stem)
        if cleaned_stem:
            if is_hash_like_title(cleaned_stem):
                warnings.append('hash_filename_no_title')
                return (None, 10, warnings)
            # STRICT: Reject numeric-only after cleaning too
            if is_numeric_only(cleaned_stem):
                warnings.append('numeric_filename_no_title')
                return (None, 10, warnings)
            elif not is_junk_title(cleaned_stem):
                return (cleaned_stem, 50, warnings)
    
    # 5. Ultimate fallback: use cleaned file_stem even if weak — but NEVER hash-like
    if file_stem and not is_numeric_only(file_stem) and not is_hash_like_title(file_stem):
        cleaned_stem = clean_filename_stem(file_stem)
        if cleaned_stem and not is_hash_like_title(cleaned_stem):
            return (cleaned_stem, 40, warnings)
    if file_stem and (is_numeric_only(file_stem) or is_hash_like_title(file_stem)):
        if is_hash_like_title(file_stem):
            warnings.append('hash_filename_no_title')
        else:
            warnings.append('numeric_filename_no_title')
    return (None, 10, warnings)


# Creator/Producer values that are software tools, not publishers. Reject these.
_CREATOR_PRODUCER_SOFTWARE = frozenset([
    'adobe acrobat', 'acrobat', 'acrobat distiller', 'distiller', 'pdf',
    'microsoft word', 'microsoft® word', 'word', 'microsoft: print to pdf', 'print to pdf',
    'libreoffice', 'openoffice', 'ghostscript', 'nitro', 'foxit', 'pdfsharp',
    'adobe pdf library', 'pdf library', 'adobe indesign', 'indesign',
    'quarkxpress', 'quarkxpress(tm)', 'aspose', 'aspose ltd',
])


def _is_software_creator_producer(s: str) -> bool:
    """True if s looks like a software product (Creator/Producer), not an org/publisher."""
    lower = s.lower().strip()
    # Remove parenthetical suffixes like "(Windows)", "(Mac)", "8.1.0 (Windows)"
    lower = re.sub(r'\s*\([^)]*\)\s*$', '', lower).strip()
    lower = re.sub(r'\s+\d+\.?\d*\s*$', '', lower).strip()
    if lower in _CREATOR_PRODUCER_SOFTWARE:
        return True
    for token in _CREATOR_PRODUCER_SOFTWARE:
        if token in lower or lower in token:
            return True
    # Substring patterns that indicate software
    if any(x in lower for x in ('adobe ', 'acrobat', 'microsoft', 'distiller', 'indesign', 'quarkxpress', 'aspose', 'pdf library', 'print to pdf')):
        return True
    return False


def _clean_creator_producer(raw: Optional[str]) -> Optional[str]:
    """Extract a usable publisher from PDF Creator/Producer (e.g. 'Adobe Acrobat 11.0' -> None; 'CISA' -> 'CISA')."""
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    # Drop version suffixes and take first meaningful segment
    for sep in (';', ',', '\n', '\r'):
        s = s.split(sep)[0].strip()
    # Strip trailing version-like pattern (e.g. "11.0", "2024")
    s = re.sub(r'\s+\d+\.?\d*\s*$', '', s).strip()
    # Strip parentheticals for comparison
    s_clean = re.sub(r'\s*\([^)]*\)\s*$', '', s).strip()
    if _is_software_creator_producer(s_clean or s):
        return None
    if len(s) < 2:
        return None
    # Reject values that look like document titles (often wrongly stored in Creator/Producer)
    if _looks_like_document_title(s, None):
        return None
    return s


def _strip_pdf_extension_from_title(title: Optional[str]) -> Optional[str]:
    """Remove trailing .pdf/.PDF from a title (metadata often includes it)."""
    if not title or not title.strip():
        return title
    s = title.strip()
    if s.lower().endswith('.pdf'):
        return s[:-4].strip()
    return s


def _looks_like_document_title(candidate: str, inferred_title: Optional[str]) -> bool:
    """
    True if candidate is likely a document title rather than a publisher/org name.
    Avoids storing title in the publisher field.
    """
    s = (candidate or '').strip()
    if len(s) < 3:
        return False
    # Long strings are usually titles (e.g. "Active Shooter Emergency Action Plan Guide")
    if len(s) > 40:
        return True
    # Many words (e.g. 5+) is usually a title; org names are short (CISA, DHS, Sandia National Laboratory)
    words = s.split()
    if len(words) > 4:
        return True
    # Same or very similar to inferred title -> it's a title, not publisher
    if inferred_title and inferred_title.strip():
        it = inferred_title.strip().lower()
        cs = s.lower()
        if it == cs:
            return True
        if len(it) > 10 and (it in cs or cs in it):
            return True
    return False


def infer_publisher(inferred_title: Optional[str], cover_text: Optional[str]) -> Optional[str]:
    """
    Conservative publisher inference from document text (first two pages).
    Returns publisher name or None.
    """
    text_to_check = []
    if inferred_title:
        text_to_check.append(inferred_title)
    if cover_text:
        # Use first ~2500 chars (covers first two pages)
        text_to_check.append(cover_text[:2500])
    
    combined_text = ' '.join(text_to_check).upper()
    
    # Order matters: prefer more specific agencies (CISA, USSS) before parent (DHS)
    # CISA
    if 'CISA' in combined_text or 'CYBERSECURITY AND INFRASTRUCTURE SECURITY AGENCY' in combined_text:
        return 'CISA'
    # USSS (U.S. Secret Service)
    if 'USSS' in combined_text or 'U.S. SECRET SERVICE' in combined_text or 'UNITED STATES SECRET SERVICE' in combined_text:
        return 'U.S. Secret Service'
    # FEMA
    if 'FEMA' in combined_text or 'FEDERAL EMERGENCY MANAGEMENT AGENCY' in combined_text:
        return 'FEMA'
    # ISC
    if 'ISC' in combined_text or 'INTERAGENCY SECURITY COMMITTEE' in combined_text:
        return 'ISC'
    # DoD (before DHS for DoD UFC docs)
    if 'DOD' in combined_text or 'DEPARTMENT OF DEFENSE' in combined_text or 'UFC ' in combined_text:
        return 'DoD'
    # DHS
    if 'DHS' in combined_text or 'DEPARTMENT OF HOMELAND SECURITY' in combined_text or 'HOMELAND SECURITY' in combined_text:
        return 'DHS'
    
    return None


def infer_publication_date(
    inferred_title: Optional[str],
    cover_text: Optional[str],
) -> Tuple[Optional[date], List[str]]:
    """
    Infer publication date from title or first-two-pages text.
    Returns (date, warnings).
    """
    warnings = []
    text_to_check = []
    
    if inferred_title:
        text_to_check.append(inferred_title)
    if cover_text:
        # Check first ~80 lines (covers first two pages)
        lines = cover_text.split('\n')[:80]
        text_to_check.append('\n'.join(lines))
    
    combined_text = ' '.join(text_to_check)
    
    # Look for YYYY-MM-DD pattern
    date_patterns = [
        r'\b(\d{4})-(\d{2})-(\d{2})\b',  # YYYY-MM-DD
        r'\b(\d{4})/(\d{2})/(\d{2})\b',   # YYYY/MM/DD
        r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',  # MM/DD/YYYY
    ]
    
    dates_found = []
    for pattern in date_patterns:
        matches = re.findall(pattern, combined_text)
        for match in matches:
            try:
                if len(match[0]) == 4:  # YYYY-MM-DD or YYYY/MM/DD
                    year, month, day = int(match[0]), int(match[1]), int(match[2])
                else:  # MM/DD/YYYY
                    month, day, year = int(match[0]), int(match[1]), int(match[2])
                
                parsed_date = date(year, month, day)
                # Only accept reasonable dates (not future, not too old)
                if 1900 <= year <= datetime.now().year + 1:
                    dates_found.append(parsed_date)
            except (ValueError, IndexError):
                continue
    
    # Look for "Month YYYY" pattern
    month_names = list(calendar.month_name[1:]) + list(calendar.month_abbr[1:])
    for month_name in month_names:
        pattern = rf'\b{re.escape(month_name)}\s+(\d{{4}})\b'
        matches = re.findall(pattern, combined_text, re.IGNORECASE)
        for match in matches:
            try:
                year = int(match)
                if 1900 <= year <= datetime.now().year + 1:
                    # Use first day of month
                    month_num = month_names.index(month_name) % 12 + 1
                    dates_found.append(date(year, month_num, 1))
            except (ValueError, IndexError):
                continue
    
    if len(dates_found) > 1:
        warnings.append('multiple_dates_detected')
    
    if dates_found:
        # Return earliest date found (likely publication date)
        return (min(dates_found), warnings)
    
    return (None, warnings)


def format_citation_short(publisher: Optional[str], inferred_title: Optional[str], publication_date: Optional[date]) -> Optional[str]:
    """
    AMA style short citation: "Publisher. Title. Year."
    Only if publisher + title exists.
    """
    if not publisher or not inferred_title:
        return None
    
    parts = [publisher.rstrip(".") + ".", inferred_title.rstrip(".") + "."]
    if publication_date:
        parts.append(f"{publication_date.year}.")
    return " ".join(parts)


def format_citation_full(
    publisher: Optional[str],
    inferred_title: Optional[str],
    publication_date: Optional[date],
    source_url: Optional[str]
) -> Optional[str]:
    """
    AMA style full citation: "Publisher. Title. Publisher; Year."
    With URL: " ... Accessed Month Day, Year. URL."
    Only if publisher + title exists.
    """
    if not publisher or not inferred_title:
        return None
    
    pub = publisher.rstrip(".;")
    title = inferred_title.rstrip(".")
    parts = [pub + ".", title + "."]
    if publication_date:
        parts.append(f"{pub}; {publication_date.year}.")
    if source_url:
        retrieved_date = datetime.now().strftime("%B %d, %Y")
        parts.append(f"Accessed {retrieved_date}. {source_url}")
    return " ".join(parts)


def extract_citation_metadata(
    file_path: str,
    original_filename: Optional[str] = None,
    use_filename: bool = True,
) -> Dict:
    """
    Main extraction function.

    Input:
    - file_path: local PDF path
    - original_filename: optional original filename (if different from file_path)
    - use_filename: if False, title and publisher are NEVER derived from filename (content-only scraper)

    Output: dict with:
    - pdf_meta_* fields (raw)
    - inferred_title + title_confidence
    - publisher (optional inference)
    - publication_date (optional inference)
    - citation_short / citation_full (only if enough fields)
    - ingestion_warnings (array of strings)
    """
    pdf_path = Path(file_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f'PDF not found: {file_path}')

    # When use_filename=False, never use filename for title or publisher
    if use_filename and original_filename:
        file_stem = Path(original_filename).stem
    elif use_filename:
        file_stem = pdf_path.stem
    else:
        file_stem = ''

    # Extract PDF metadata
    pdf_meta = extract_pdf_metadata(str(pdf_path))

    # Extract first page only (for title "first-page" heuristic) and first two pages (for title/publisher/date)
    first_page_text = extract_first_page_text(str(pdf_path))
    cover_text = extract_text_from_pages(str(pdf_path), max_pages=COVER_PAGES_FOR_METADATA)

    # Infer title (metadata -> first page -> first two pages; filename only if use_filename)
    inferred_title, title_confidence, title_warnings = infer_title(
        pdf_meta.get('pdf_meta_title'),
        first_page_text,
        file_stem,
        chunk_text=cover_text,
    )
    if inferred_title:
        inferred_title = _strip_pdf_extension_from_title(inferred_title) or inferred_title

    # Infer publisher from first two pages, then PDF metadata Creator/Producer (never filename when use_filename=False)
    publisher = infer_publisher(inferred_title, cover_text)
    if not publisher:
        cand = _clean_creator_producer(pdf_meta.get('pdf_meta_creator')) or _clean_creator_producer(pdf_meta.get('pdf_meta_producer'))
        if cand and not _looks_like_document_title(cand, inferred_title):
            publisher = cand
    if use_filename and not publisher and file_stem and not is_numeric_only(file_stem):
        cleaned = clean_filename_stem(file_stem)
        if cleaned and len(cleaned) >= 2:
            candidate = cleaned.split()[0] if cleaned.split() else cleaned
            if not _looks_like_document_title(candidate, inferred_title):
                publisher = candidate

    # Infer publication date from first two pages
    publication_date, date_warnings = infer_publication_date(inferred_title, cover_text)

    all_warnings = title_warnings + date_warnings
    citation_short = format_citation_short(publisher, inferred_title, publication_date)
    citation_full = format_citation_full(publisher, inferred_title, publication_date, None)

    result = {
        **pdf_meta,
        'inferred_title': inferred_title,
        'title_confidence': title_confidence,
        'publisher': publisher,
        'publication_date': publication_date.isoformat() if publication_date else None,
        'source_url': None,
        'citation_short': citation_short,
        'citation_full': citation_full,
        'ingestion_warnings': all_warnings,
    }
    return result


def scrape_source_metadata_from_content(pdf_path: str) -> Dict:
    """
    Title / publisher / citation scraper for sources. Uses ONLY document content:
    - PDF metadata (Title, Creator, Producer)
    - First two pages of text (headings, cover text) for title, publisher, and date

    File name is NEVER used. Use this for source registry and module source metadata.
    Returns: title, publisher, citation_short, citation_full, publication_date, year.
    """
    raw = extract_citation_metadata(pdf_path, use_filename=False)
    year = None
    if raw.get('publication_date'):
        try:
            from datetime import datetime
            pub = raw['publication_date']
            if isinstance(pub, str):
                year = int(pub[:4]) if len(pub) >= 4 else None
            elif hasattr(pub, 'year'):
                year = getattr(pub, 'year')
        except (ValueError, TypeError):
            pass
    return {
        'title': raw.get('inferred_title') or raw.get('pdf_meta_title'),
        'publisher': raw.get('publisher'),
        'citation_short': raw.get('citation_short'),
        'citation_full': raw.get('citation_full'),
        'publication_date': raw.get('publication_date'),
        'year': year,
        'pdf_meta_title': raw.get('pdf_meta_title'),
        'title_confidence': raw.get('title_confidence'),
        'ingestion_warnings': raw.get('ingestion_warnings', []),
    }
