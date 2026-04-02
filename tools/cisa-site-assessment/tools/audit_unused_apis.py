#!/usr/bin/env python3
"""
Audit script to find unused and deprecated API routes.
Scans all API route files and checks if they're referenced in the codebase.
"""
import os
import re
from pathlib import Path
from collections import defaultdict

# Base directories
PSA_REBUILD = Path(__file__).parent.parent
API_DIR = PSA_REBUILD / "app" / "api"
APP_DIR = PSA_REBUILD / "app"

def find_api_routes():
    """Find all API route files."""
    routes = []
    for route_file in API_DIR.rglob("route.ts"):
        # Get relative path from app/api
        rel_path = route_file.relative_to(API_DIR.parent)
        # Convert to API path: app/api/foo/bar/route.ts -> /api/foo/bar
        api_path = "/" + str(rel_path.parent).replace("\\", "/")
        routes.append({
            "file": route_file,
            "api_path": api_path,
            "methods": extract_methods(route_file)
        })
    return routes

def extract_methods(route_file):
    """Extract HTTP methods from route file."""
    methods = []
    try:
        content = route_file.read_text()
        if "export async function GET" in content or "export const GET" in content:
            methods.append("GET")
        if "export async function POST" in content or "export const POST" in content:
            methods.append("POST")
        if "export async function PATCH" in content or "export const PATCH" in content:
            methods.append("PATCH")
        if "export async function PUT" in content or "export const PUT" in content:
            methods.append("PUT")
        if "export async function DELETE" in content or "export const DELETE" in content:
            methods.append("DELETE")
    except Exception as e:
        print(f"Error reading {route_file}: {e}")
    return methods if methods else ["GET"]  # Default to GET

def find_references(api_path, methods):
    """Find references to an API path in the codebase."""
    references = []
    api_patterns = [
        f"/api{api_path}",
        f"`/api{api_path}",
        f"'/api{api_path}",
        f'"/api{api_path}',
    ]
    
    # Also check for dynamic segments
    if "[" in api_path:
        # Convert [id] to regex pattern
        pattern = api_path.replace("[", "\\[").replace("]", "\\]")
        api_patterns.append(f"/api{pattern}")
    
    for file_path in APP_DIR.rglob("*.{ts,tsx,js,jsx}"):
        if "node_modules" in str(file_path) or ".next" in str(file_path):
            continue
        
        try:
            content = file_path.read_text()
            for pattern in api_patterns:
                if pattern in content:
                    # Find line numbers
                    for i, line in enumerate(content.split("\n"), 1):
                        if pattern in line:
                            references.append({
                                "file": str(file_path.relative_to(PSA_REBUILD)),
                                "line": i,
                                "context": line.strip()[:100]
                            })
        except Exception as e:
            pass  # Skip binary or unreadable files
    
    return references

def check_deprecated_markers(route_file):
    """Check if route file has deprecation markers."""
    try:
        content = route_file.read_text()
        deprecated = "DEPRECATED" in content or "deprecated" in content.lower()
        return deprecated
    except:
        return False

def main():
    print("=" * 80)
    print("API Route Audit")
    print("=" * 80)
    print()
    
    routes = find_api_routes()
    print(f"Found {len(routes)} API routes\n")
    
    unused = []
    deprecated = []
    used = []
    
    for route in routes:
        api_path = route["api_path"]
        methods = route["methods"]
        route_file = route["file"]
        
        # Check for deprecation markers
        is_deprecated = check_deprecated_markers(route_file)
        
        # Find references
        refs = find_references(api_path, methods)
        
        # Exclude self-references (route file referencing itself)
        refs = [r for r in refs if "api" not in r["file"] or route_file.name not in r["file"]]
        
        if is_deprecated:
            deprecated.append({
                "route": route,
                "references": refs
            })
        elif len(refs) == 0:
            unused.append({
                "route": route,
                "references": refs
            })
        else:
            used.append({
                "route": route,
                "references": refs
            })
    
    print("=" * 80)
    print("DEPRECATED APIs")
    print("=" * 80)
    for item in deprecated:
        route = item["route"]
        refs = item["references"]
        print(f"\n{route['api_path']} ({', '.join(route['methods'])})")
        print(f"  File: {route['file'].relative_to(PSA_REBUILD)}")
        print(f"  References: {len(refs)}")
        if refs:
            for ref in refs[:3]:  # Show first 3
                print(f"    - {ref['file']}:{ref['line']}")
    
    print("\n" + "=" * 80)
    print("UNUSED APIs")
    print("=" * 80)
    for item in unused:
        route = item["route"]
        print(f"\n{route['api_path']} ({', '.join(route['methods'])})")
        print(f"  File: {route['file'].relative_to(PSA_REBUILD)}")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total routes: {len(routes)}")
    print(f"  Used: {len(used)}")
    print(f"  Deprecated: {len(deprecated)}")
    print(f"  Unused: {len(unused)}")
    
    # Write report
    report_file = PSA_REBUILD / "docs" / "API_AUDIT_REPORT.md"
    with open(report_file, "w") as f:
        f.write("# API Audit Report\n\n")
        f.write(f"**Generated:** {Path(__file__).stat().st_mtime}\n\n")
        f.write(f"**Total Routes:** {len(routes)}\n")
        f.write(f"- Used: {len(used)}\n")
        f.write(f"- Deprecated: {len(deprecated)}\n")
        f.write(f"- Unused: {len(unused)}\n\n")
        
        f.write("## Deprecated APIs\n\n")
        for item in deprecated:
            route = item["route"]
            refs = item["references"]
            f.write(f"### {route['api_path']}\n")
            f.write(f"- **Methods:** {', '.join(route['methods'])}\n")
            f.write(f"- **File:** `{route['file'].relative_to(PSA_REBUILD)}`\n")
            f.write(f"- **References:** {len(refs)}\n")
            if refs:
                f.write("- **Still Used In:**\n")
                for ref in refs:
                    f.write(f"  - `{ref['file']}:{ref['line']}`\n")
            f.write("\n")
        
        f.write("## Unused APIs\n\n")
        for item in unused:
            route = item["route"]
            f.write(f"### {route['api_path']}\n")
            f.write(f"- **Methods:** {', '.join(route['methods'])}\n")
            f.write(f"- **File:** `{route['file'].relative_to(PSA_REBUILD)}`\n\n")
    
    print(f"\nReport written to: {report_file}")

if __name__ == "__main__":
    main()
