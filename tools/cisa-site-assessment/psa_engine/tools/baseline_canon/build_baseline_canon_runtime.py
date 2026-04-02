import json
from pathlib import Path
from collections import Counter, defaultdict

ENGINE_DIR = Path(__file__).parent.parent.parent
CANON_DIR = ENGINE_DIR / "doctrine" / "baseline_canon"
SPINES_DIR = CANON_DIR / "spines"
COMP_DIR = CANON_DIR / "components"
CONSTRAINTS_DIR = CANON_DIR / "constraints"

OUT = CANON_DIR / "baseline_canon_runtime.v1.json"
MANIFEST = CANON_DIR / "baseline_canon_runtime.v1.manifest.json"

REQUIRED_DISCIPLINES_ORDER = [
    "PER","ACS","IDS","VSS","INT","FAC","KEY","COM","EAP","EMR","ISC","SFO","SMG","CPTED"
]
RESPONSE_ENUM = ["YES","NO","N_A"]

def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))

def norm_spine(rec):
    q = rec.get("question_text") or rec.get("question") or ""
    return {
        "canon_id": rec.get("canon_id"),
        "discipline_code": rec.get("discipline_code"),
        "subtype_code": rec.get("subtype_code", None),
        "question_text": str(q).strip(),
        "response_enum": rec.get("response_enum"),
    }

def validate_spines(spines):
    errs = []
    canon_ids = []
    questions = []
    disciplines = []

    for i, r in enumerate(spines, start=1):
        if not r.get("canon_id"):
            errs.append(f"Missing canon_id (record #{i})")
        if not r.get("discipline_code"):
            errs.append(f"Missing discipline_code (canon_id={r.get('canon_id')})")
        if not r.get("question_text"):
            errs.append(f"Missing question_text (canon_id={r.get('canon_id')})")
        if r.get("response_enum") != RESPONSE_ENUM:
            errs.append(f"Bad response_enum (canon_id={r.get('canon_id')}): {r.get('response_enum')}")
        canon_ids.append(r.get("canon_id"))
        questions.append(r.get("question_text"))
        disciplines.append(r.get("discipline_code"))

    dupe_ids = [k for k,v in Counter(canon_ids).items() if k and v > 1]
    dupe_q = [k for k,v in Counter(questions).items() if k and v > 1]

    if dupe_ids:
        errs.append(f"Duplicate canon_id: {dupe_ids}")
    if dupe_q:
        errs.append(f"Duplicate question_text: {dupe_q[:10]}" + (" ..." if len(dupe_q) > 10 else ""))

    present = set([d for d in disciplines if d])
    missing = [d for d in REQUIRED_DISCIPLINES_ORDER if d not in present]
    if missing:
        errs.append(f"Missing required disciplines in spines: {missing}")

    if errs:
        raise SystemExit("[FAIL]\n" + "\n".join(errs))

    return Counter(disciplines)

def main():
    spine_files = sorted(SPINES_DIR.glob("*_spines.v1.json"))
    if not spine_files:
        raise SystemExit("[FAIL] No spine files found in doctrine/baseline_canon/spines")

    spines = []
    for p in spine_files:
        data = load_json(p)
        if not isinstance(data, list):
            raise SystemExit(f"[FAIL] {p.name} must be a JSON list")
        for rec in data:
            if not isinstance(rec, dict):
                raise SystemExit(f"[FAIL] {p.name} contains non-object record")
            spines.append(norm_spine(rec))

    by_disc = validate_spines(spines)

    components_files = sorted(COMP_DIR.glob("*_components.v1.json"))
    constraints_files = sorted(CONSTRAINTS_DIR.glob("*_constraints.v1.json"))

    runtime = {
        "version": "v1",
        "authoring_source": "baseline_spines.v1.json (and *_spines.v1.json files)",
        "spines": spines,
        "components_manifests": [p.name for p in components_files],
        "constraints_manifests": [p.name for p in constraints_files],
        "required_disciplines_order": REQUIRED_DISCIPLINES_ORDER,
    }

    OUT.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    manifest = {
        "version": "v1",
        "total_spines": len(spines),
        "by_discipline": {d: int(by_disc.get(d, 0)) for d in REQUIRED_DISCIPLINES_ORDER},
        "spine_files_included": [p.name for p in spine_files],
        "components_files_present": [p.name for p in components_files],
        "constraints_files_present": [p.name for p in constraints_files],
        "output_file": OUT.name,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("[OK] Wrote:", OUT)
    print("[OK] Wrote:", MANIFEST)
    print("[OK] Total spines:", len(spines))
    for d in REQUIRED_DISCIPLINES_ORDER:
        print(f"  - {d}: {manifest['by_discipline'][d]}")

if __name__ == "__main__":
    main()
