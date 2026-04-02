#!/usr/bin/env python3
"""
Deterministic Router Service

Routes PDFs based on sidecar JSON metadata. Never guesses, never calls Ollama.
Only routes using confirmed metadata from .meta.json files.
"""

import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Tuple
import time

from .meta_schema import load_metadata, validate_metadata
from .hash_utils import sha256_file, short_hash


class RouterService:
    """
    Deterministic router that moves PDFs based on confirmed metadata.
    """
    
    def __init__(
        self,
        base_dir: Path,
        poll_interval: int = 5
    ):
        """
        Initialize router service.
        
        Args:
            base_dir: Base directory containing router subdirectories
            poll_interval: Polling interval in seconds (default 5)
        """
        self.base_dir = Path(base_dir)
        self.poll_interval = poll_interval
        
        # Directory paths
        self.incoming_dir = self.base_dir / "incoming"
        self.staging_unclassified_dir = self.base_dir / "staging" / "unclassified"
        self.staging_classified_dir = self.base_dir / "staging" / "classified"
        self.triage_dir = self.base_dir / "triage"
        self.receipts_dir = self.base_dir / "receipts"
        self.logs_dir = self.base_dir / "logs"
        
        # Source directories (outside router)
        self.corpus_dir = self.base_dir.parent.parent / "sources" / "corpus"
        self.modules_dir = self.base_dir.parent.parent / "sources" / "modules"
        
        # Ensure directories exist
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create all required directories if they don't exist."""
        dirs = [
            self.incoming_dir,
            self.staging_unclassified_dir,
            self.staging_classified_dir,
            self.triage_dir,
            self.receipts_dir,
            self.logs_dir,
            self.corpus_dir,
            self.modules_dir
        ]
        
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def _write_receipt(
        self,
        receipt_type: str,
        pdf_path: Path,
        sha256: str,
        metadata: Optional[Dict] = None,
        destination: Optional[Path] = None,
        errors: Optional[list] = None
    ):
        """
        Write receipt JSON file.
        
        Args:
            receipt_type: "staged", "triaged", or "routed"
            pdf_path: Original PDF path
            sha256: SHA-256 hash of PDF
            metadata: Metadata dictionary (if available)
            destination: Final destination path (if routed)
            errors: List of error messages (if triaged)
        """
        timestamp = datetime.utcnow().isoformat() + "Z"
        receipt_name = f"{int(time.time())}__{pdf_path.stem}__{receipt_type}.json"
        receipt_path = self.receipts_dir / receipt_name
        
        receipt = {
            "timestamp": timestamp,
            "receipt_type": receipt_type,
            "original_path": str(pdf_path),
            "filename": pdf_path.name,
            "sha256": sha256,
        }
        
        if metadata:
            receipt["metadata"] = metadata
        
        if destination:
            receipt["destination"] = str(destination)
        
        if errors:
            receipt["errors"] = errors
        
        with open(receipt_path, "w", encoding="utf-8") as f:
            json.dump(receipt, f, indent=2)
    
    def _write_log(self, level: str, message: str, **kwargs):
        """
        Write log entry to JSON log file.
        
        Args:
            level: Log level (INFO, WARN, ERROR)
            message: Log message
            **kwargs: Additional log fields
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            **kwargs
        }
        
        log_file = self.logs_dir / "router.log"
        
        # Append to log file (one JSON object per line)
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def _handle_incoming_pdf(self, pdf_path: Path) -> bool:
        """
        Handle PDF in incoming/ directory.
        Moves to staging/unclassified/ and writes staged receipt.
        
        Returns:
            True if handled successfully, False otherwise
        """
        try:
            # Calculate hash
            sha256 = sha256_file(pdf_path)
            
            # Move to staging/unclassified
            dest_path = self.staging_unclassified_dir / pdf_path.name
            
            # Handle filename collision
            if dest_path.exists():
                short_sha = short_hash(sha256)
                stem = pdf_path.stem
                dest_path = self.staging_unclassified_dir / f"{stem}__{short_sha}.pdf"
            
            shutil.move(str(pdf_path), str(dest_path))
            
            # Write staged receipt
            self._write_receipt("staged", dest_path, sha256)
            
            self._write_log("INFO", f"Staged PDF: {pdf_path.name}", sha256=sha256)
            return True
            
        except Exception as e:
            self._write_log("ERROR", f"Failed to stage PDF: {pdf_path.name}", error=str(e))
            return False
    
    def _canonical_sector(self, sector: str) -> str:
        """
        Normalize sector name to canonical form.
        Critical: nuclear_reactors,_materials,_and_waste -> nuclear_reactors_materials_and_waste
        """
        if not sector:
            return sector
        
        # Canonical sector mapping
        canonical_map = {
            "nuclear_reactors,_materials,_and_waste": "nuclear_reactors_materials_and_waste",
            "nuclear_reactors_materials_and_waste": "nuclear_reactors_materials_and_waste",
            "Nuclear_Reactors,_Materials,_and_Waste": "nuclear_reactors_materials_and_waste",
            "Nuclear_Reactors_Materials_and_Waste": "nuclear_reactors_materials_and_waste",
        }
        
        key = sector.lower()
        return canonical_map.get(key, sector)
    
    def _build_destination_path(self, metadata: Dict) -> Path:
        """
        Build destination path based on metadata.
        
        Args:
            metadata: Validated metadata dictionary
        
        Returns:
            Destination path
        """
        source_type = metadata["source_type"]
        discipline_code = metadata["discipline_code"]
        
        if source_type == "corpus":
            base = self.corpus_dir / discipline_code
        else:  # module
            module_id = metadata["module_id"]
            base = self.modules_dir / module_id / discipline_code
        
        # Add sector/subsector if present (with canonical normalization)
        if metadata.get("sector_id"):
            canonical_sector = self._canonical_sector(metadata["sector_id"])
            base = base / "sector" / canonical_sector
            if metadata.get("subsector_id"):
                base = base / "subsector" / metadata["subsector_id"]
        
        return base
    
    def _handle_classified_pdf(self, pdf_path: Path, meta_path: Path) -> bool:
        """
        Handle PDF in staging/unclassified/ with valid metadata.
        Moves to staging/classified/ then to final destination.
        
        Returns:
            True if routed successfully, False if triaged
        """
        try:
            # Load and validate metadata
            metadata, error = load_metadata(meta_path)
            if error:
                # Invalid metadata - move to triage
                sha256 = sha256_file(pdf_path)
                triage_path = self.triage_dir / pdf_path.name
                
                # Handle collision
                if triage_path.exists():
                    short_sha = short_hash(sha256)
                    stem = pdf_path.stem
                    triage_path = self.triage_dir / f"{stem}__{short_sha}.pdf"
                
                shutil.move(str(pdf_path), str(triage_path))
                shutil.move(str(meta_path), str(triage_path.with_suffix(".meta.json")))
                
                self._write_receipt("triaged", triage_path, sha256, errors=[error])
                self._write_log("WARN", f"Triaged PDF: {pdf_path.name}", error=error)
                return False
            
            # Build destination path
            dest_base = self._build_destination_path(metadata)
            dest_base.mkdir(parents=True, exist_ok=True)
            
            # Move to staging/classified first
            classified_path = self.staging_classified_dir / pdf_path.name
            if classified_path.exists():
                sha256 = sha256_file(pdf_path)
                short_sha = short_hash(sha256)
                stem = pdf_path.stem
                classified_path = self.staging_classified_dir / f"{stem}__{short_sha}.pdf"
            
            shutil.move(str(pdf_path), str(classified_path))
            
            # Move metadata to classified
            classified_meta_path = classified_path.with_suffix(".meta.json")
            shutil.move(str(meta_path), str(classified_meta_path))
            
            # Move to final destination
            final_dest = dest_base / pdf_path.name
            if final_dest.exists():
                sha256 = sha256_file(classified_path)
                short_sha = short_hash(sha256)
                stem = pdf_path.stem
                final_dest = dest_base / f"{stem}__{short_sha}.pdf"
            
            shutil.move(str(classified_path), str(final_dest))
            shutil.move(str(classified_meta_path), str(final_dest.with_suffix(".meta.json")))
            
            # Write routed receipt
            sha256 = sha256_file(final_dest)
            self._write_receipt("routed", final_dest, sha256, metadata, final_dest)
            
            self._write_log("INFO", f"Routed PDF: {pdf_path.name}", 
                          destination=str(final_dest), discipline=metadata["discipline_code"])
            return True
            
        except Exception as e:
            self._write_log("ERROR", f"Failed to route PDF: {pdf_path.name}", error=str(e))
            # Move to triage on error
            try:
                sha256 = sha256_file(pdf_path)
                triage_path = self.triage_dir / pdf_path.name
                if triage_path.exists():
                    short_sha = short_hash(sha256)
                    stem = pdf_path.stem
                    triage_path = self.triage_dir / f"{stem}__{short_sha}.pdf"
                
                shutil.move(str(pdf_path), str(triage_path))
                if meta_path.exists():
                    shutil.move(str(meta_path), str(triage_path.with_suffix(".meta.json")))
                
                self._write_receipt("triaged", triage_path, sha256, errors=[str(e)])
            except:
                pass
            return False
    
    def process_once(self):
        """
        Process incoming and staging directories once.
        """
        # Process incoming/ PDFs
        for pdf_path in self.incoming_dir.glob("*.pdf"):
            if pdf_path.is_file():
                self._handle_incoming_pdf(pdf_path)
        
        # Process staging/unclassified/ PDFs with metadata
        for pdf_path in self.staging_unclassified_dir.glob("*.pdf"):
            if not pdf_path.is_file():
                continue
            
            meta_path = pdf_path.with_suffix(".meta.json")
            if meta_path.exists():
                self._handle_classified_pdf(pdf_path, meta_path)
    
    def run_continuous(self):
        """
        Run router continuously, polling at specified interval.
        """
        self._write_log("INFO", "Router service started", poll_interval=self.poll_interval)
        
        try:
            while True:
                self.process_once()
                time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            self._write_log("INFO", "Router service stopped")
        except Exception as e:
            self._write_log("ERROR", "Router service crashed", error=str(e))
            raise


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Deterministic Router Service")
    parser.add_argument(
        "--base-dir",
        type=str,
        default=None,
        help="Base directory for router (default: services/router)"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once instead of continuously"
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=5,
        help="Polling interval in seconds (default: 5)"
    )
    
    args = parser.parse_args()
    
    # Determine base directory
    if args.base_dir:
        base_dir = Path(args.base_dir)
    else:
        # Default: assume running from psa_rebuild root
        base_dir = Path(__file__).parent
    
    router = RouterService(base_dir, poll_interval=args.poll_interval)
    
    if args.once:
        router.process_once()
    else:
        router.run_continuous()


if __name__ == "__main__":
    main()
