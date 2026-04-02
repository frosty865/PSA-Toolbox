#!/usr/bin/env python3
"""
Test Harness for PDF Citation Extractor

Tests citation extraction on sample PDFs:
- Known CISA doc with good title
- Numeric filename (e.g., 897986.pdf) to validate rejection
- Generic filename-derived title

Verifies:
- Numeric-only candidates are rejected
- Confidence scoring behaves as specified
- No URL fabrication
"""

import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from model.ingest.pdf_citation_extractor import (
    extract_citation_metadata,
    is_hash_like_title,
    is_junk_title,
    infer_title,
    infer_publisher,
    infer_publication_date
)


def test_hash_like_title_rejection():
    """Test that hash-like stems are never used as title."""
    print("🧪 Test: Hash-like title rejection")
    assert is_hash_like_title("abc123def") == True, "9-char hex should be hash-like"
    assert is_hash_like_title("a1b2c3d4") == True, "8-char hex should be hash-like"
    assert is_hash_like_title("abc123") == True, "6-char hex should be hash-like"
    assert is_hash_like_title("3e0cd3d1049c") == True, "12-char hex should be hash-like"
    assert is_hash_like_title("CISA Security Guide") == False, "Real title should not be hash-like"
    assert is_hash_like_title("") == True, "Empty is treated as invalid"
    assert is_hash_like_title("Guide-2024") == False, "Filename with words not hash-like"
    print("  ✅ Hash-like title rejection tests passed")


def test_numeric_title_rejection():
    """Test that numeric-only titles are rejected."""
    print("🧪 Test: Numeric title rejection")
    
    # Test is_junk_title function
    assert is_junk_title("897986") == True, "Numeric-only title should be rejected"
    assert is_junk_title("888328") == True, "Numeric-only title should be rejected"
    assert is_junk_title("1234567890") == True, "Long numeric-only title should be rejected"
    assert is_junk_title("897986abc") == False, "Mixed alphanumeric should not be rejected"
    assert is_junk_title("CISA Security Guide") == False, "Valid title should not be rejected"
    assert is_junk_title("123") == True, "Short numeric title should be rejected"
    assert is_junk_title("") == True, "Empty title should be rejected"
    
    print("  ✅ Numeric title rejection tests passed")


def test_confidence_scoring():
    """Test confidence scoring logic."""
    print("🧪 Test: Confidence scoring")
    
    # Test title inference with different inputs
    # Simulate PDF metadata title (should get confidence 90)
    pdf_meta_title = "CISA Security Guide for Physical Security"
    first_page_text = None
    file_stem = "897986"
    
    inferred_title, confidence, warnings = infer_title(pdf_meta_title, first_page_text, file_stem)
    assert inferred_title == pdf_meta_title, "Should use PDF metadata title"
    assert confidence == 90, f"PDF metadata title should have confidence 90, got {confidence}"
    assert len(warnings) == 0, "No warnings for valid PDF metadata title"
    
    # Test with junk PDF metadata (numeric/hash-like filename not used as title)
    pdf_meta_title_junk = "897986"
    inferred_title2, confidence2, warnings2 = infer_title(pdf_meta_title_junk, first_page_text, file_stem)
    assert inferred_title2 is None or confidence2 < 90, "Junk PDF metadata should not be used"
    assert "numeric_filename_no_title" in warnings2 or "hash_filename_no_title" in warnings2, "Should warn about numeric/hash filename"
    
    # Test with first-page text (should get confidence 70)
    first_page_text_good = """
    CISA Security Guide for Physical Security
    
    This document provides guidance on physical security measures...
    """
    inferred_title3, confidence3, warnings3 = infer_title(None, first_page_text_good, "guide")
    assert inferred_title3 is not None, "Should infer title from first page"
    assert confidence3 >= 50, f"First-page title should have confidence >= 50, got {confidence3}"
    
    print("  ✅ Confidence scoring tests passed")


def test_publisher_inference():
    """Test publisher inference (conservative)."""
    print("🧪 Test: Publisher inference")
    
    # Test CISA detection
    publisher1 = infer_publisher("CISA Security Guide", "Cybersecurity and Infrastructure Security Agency guidance")
    assert publisher1 == "CISA", f"Should detect CISA, got {publisher1}"
    
    # Test FEMA detection
    publisher2 = infer_publisher("FEMA Guide", "Federal Emergency Management Agency")
    assert publisher2 == "FEMA", f"Should detect FEMA, got {publisher2}"
    
    # Test ISC detection
    publisher3 = infer_publisher("ISC Standards", "Interagency Security Committee")
    assert publisher3 == "ISC", f"Should detect ISC, got {publisher3}"
    
    # Test no publisher (should return None)
    publisher4 = infer_publisher("Generic Document", "Some generic content")
    assert publisher4 is None, f"Should not infer publisher for generic content, got {publisher4}"
    
    print("  ✅ Publisher inference tests passed")


def test_no_url_fabrication():
    """Test that URLs are not fabricated."""
    print("🧪 Test: No URL fabrication")
    
    # Extract metadata (should not fabricate URL)
    # We'll test with a mock file path
    test_pdf_path = Path(__file__).parent / "test_data" / "sample.pdf"
    
    # If test PDF doesn't exist, skip this test
    if not test_pdf_path.exists():
        print("  ⚠️  Skipping (test PDF not found)")
        return
    
    try:
        citation_meta = extract_citation_metadata(str(test_pdf_path))
        # source_url should be None (not fabricated)
        assert citation_meta.get('source_url') is None, "source_url should not be fabricated"
        print("  ✅ No URL fabrication confirmed")
    except FileNotFoundError:
        print("  ⚠️  Skipping (test PDF not found)")


def test_full_extraction_on_pdf(pdf_path: str):
    """Test full extraction on a real PDF file."""
    print(f"🧪 Test: Full extraction on {Path(pdf_path).name}")
    
    if not Path(pdf_path).exists():
        print(f"  ⚠️  PDF not found: {pdf_path}")
        return None
    
    try:
        citation_meta = extract_citation_metadata(pdf_path)
        
        print(f"  📄 Results:")
        print(f"    - Inferred Title: {citation_meta.get('inferred_title', 'None')}")
        print(f"    - Confidence: {citation_meta.get('title_confidence', 0)}")
        print(f"    - Publisher: {citation_meta.get('publisher', 'None')}")
        print(f"    - Publication Date: {citation_meta.get('publication_date', 'None')}")
        print(f"    - Warnings: {citation_meta.get('ingestion_warnings', [])}")
        
        # Verify no numeric-only title
        inferred_title = citation_meta.get('inferred_title')
        if inferred_title:
            assert not is_junk_title(inferred_title), f"Inferred title should not be junk: {inferred_title}"
        
        # Verify confidence is in valid range
        confidence = citation_meta.get('title_confidence', 0)
        assert 0 <= confidence <= 100, f"Confidence should be 0-100, got {confidence}"
        
        # Verify no URL fabrication
        assert citation_meta.get('source_url') is None, "source_url should not be fabricated"
        
        print(f"  ✅ Extraction test passed")
        return citation_meta
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main test function."""
    import argparse
    parser = argparse.ArgumentParser(description='Test PDF citation extractor')
    parser.add_argument('--pdf', help='Path to PDF file for full extraction test')
    parser.add_argument('--skip-unit', action='store_true', help='Skip unit tests')
    args = parser.parse_args()
    
    print("=" * 60)
    print("PDF Citation Extractor Test Harness")
    print("=" * 60)
    print()
    
    if not args.skip_unit:
        # Run unit tests
        test_hash_like_title_rejection()
        test_numeric_title_rejection()
        test_confidence_scoring()
        test_publisher_inference()
        test_no_url_fabrication()
        print()
    
    # Test on provided PDF
    if args.pdf:
        result = test_full_extraction_on_pdf(args.pdf)
        if result:
            print()
            print("📊 Full extraction result:")
            print(json.dumps(result, indent=2, default=str))
    else:
        print("💡 Tip: Use --pdf <path> to test on a real PDF file")
        print("   Example: python tools/test_pdf_citation_extractor.py --pdf path/to/document.pdf")
    
    print()
    print("=" * 60)
    print("✅ All tests completed")
    print("=" * 60)


if __name__ == '__main__':
    main()
