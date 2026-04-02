import json
from pathlib import Path
from collections import Counter

SPINES_DIR = Path(__file__).parent / "spines"
OUT = Path(__file__).parent / "baseline_spines.v1.json"
MANIFEST = Path(__file__).parent / "baseline_spines.v1.manifest.json"

required_enum = ["YES","NO","N_A"]

def norm(rec):
    # Accept either question_text or question key, but output only question_text.
    q = rec.get("question_text") or rec.get("question") or ""
    out = {
        "canon_id": rec.get("canon_id"),
        "discipline_code": rec.get("discipline_code"),
        "subtype_code": rec.get("subtype_code", None),
        "question_text": q,
        "response_enum": rec.get("response_enum"),
    }
    return out

all_spines = []
for p in sorted(SPINES_DIR.glob("*_spines.v1.json")):
    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"[FAIL] {p.name} is not a JSON list")
    for rec in data:
        if not isinstance(rec, dict):
            raise SystemExit(f"[FAIL] {p.name} contains non-object records")
        all_spines.append(norm(rec))

# Validation
errs = []
canon_ids = []
questions = []
disciplines = []

for i, r in enumerate(all_spines, start=1):
    if not r.get("canon_id"):
        errs.append(f"Missing canon_id (record #{i})")
    if not r.get("discipline_code"):
        errs.append(f"Missing discipline_code (canon_id={r.get('canon_id')})")
    if not r.get("question_text") or not str(r["question_text"]).strip():
        errs.append(f"Missing question_text (canon_id={r.get('canon_id')})")
    if r.get("response_enum") != required_enum:
        errs.append(f"Bad response_enum (canon_id={r.get('canon_id')}): {r.get('response_enum')}")
    canon_ids.append(r.get("canon_id"))
    questions.append((r.get("question_text") or "").strip())
    disciplines.append(r.get("discipline_code"))

dupe_ids = [k for k,v in Counter(canon_ids).items() if k and v > 1]
dupe_q  = [k for k,v in Counter(questions).items() if k and v > 1]

if dupe_ids:
    errs.append(f"Duplicate canon_id: {dupe_ids}")
if dupe_q:
    errs.append(f"Duplicate question_text: {dupe_q[:10]}" + (" ..." if len(dupe_q) > 10 else ""))

if errs:
    print("\n".join(["[FAIL] baseline_spines.v1.json validation failed:"] + errs))
    raise SystemExit(1)

# Write outputs
OUT.write_text(json.dumps(all_spines, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

by_disc = Counter(disciplines)
manifest = {
    "version": "v1",
    "source_dir": str(SPINES_DIR),
    "total_spines": len(all_spines),
    "by_discipline": dict(sorted(by_disc.items(), key=lambda x: x[0])),
    "files_included": [p.name for p in sorted(SPINES_DIR.glob("*_spines.v1.json"))],
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("[OK] Wrote:", OUT)
print("[OK] Wrote:", MANIFEST)
print("[OK] Total spines:", len(all_spines))
print("[OK] By discipline:")
for d, c in sorted(by_disc.items()):
    print(f"  - {d}: {c}")
