"""
Vulnerability text sanitization for report output.
Extracted for testability without python-docx dependency.
"""
import re
import unicodedata


def sanitize_text(s: str) -> str:
    """
    Eliminate mojibake and illegal XML chars before docx write.
    One deterministic pass: nbsp, em/en dash + quote artifacts, smart quotes, control chars, NFC.
    Fix trailing unmatched '[' on 'Cell: ' lines (template typo).
    """
    if not s:
        return ""
    s = str(s)
    # Apply \u00a0 first so dash+quote fixes see consistent space
    s = s.replace("\u00a0", " ")
    # Em-dash corruption: normalize to " — " (space-dash-space); no smart quotes after dash
    s = s.replace("\u2014\u201d", " \u2014 ")   # —" -> — 
    s = s.replace("\u2014\u201c", " \u2014 ")   # —" -> — 
    s = s.replace("\u2013\u201d", " \u2013 ")
    s = s.replace("\u2013\u201c", " \u2013 ")
    s = s.replace("â€\"", " \u2014 ")   # mojibake em dash -> space-dash-space
    s = s.replace("\u2014  ", " \u2014 ")   # —  (double space) -> — 
    s = s.replace("\u0393\u00c7\u00f3", "\u2022")  # ΓÇó -> bullet
    s = s.replace("\u0393\u00c7\u00f6", "\u2014")  # ΓÇö -> em-dash
    s = s.replace("\u0393\u00c7\u00f4", "\u2013")  # ΓÇô -> en-dash
    s = s.replace("â€œ", "\u201c").replace("â€\u009d", "\u201d")  # smart quotes
    s = s.replace("\uFFFD", "\u2014")  # replacement char -> em dash
    # Cell: [... without closing ] (template typo) -> strip the stray [
    idx = s.find("Cell: [")
    if idx != -1 and "]" not in s[idx + 7 :]:
        s = s.replace("Cell: [", "Cell: ", 1)
    s = "".join(c for c in s if c in "\n\t" or unicodedata.category(c) != "Cc")
    # Strip stray unmatched quotes (single " or " at start/end without pair)
    s = s.strip()
    if s.startswith('"') and not s.endswith('"'):
        s = s.lstrip('"')
    if s.endswith('"') and not s.startswith('"'):
        s = s.rstrip('"')
    if s.startswith("\u201c") and not s.endswith("\u201d"):
        s = s.lstrip("\u201c")
    if s.endswith("\u201d") and not s.startswith("\u201c"):
        s = s.rstrip("\u201d")
    return unicodedata.normalize("NFC", s)


def sanitize_vulnerability_text(s: str) -> str:
    """
    Sanitize vulnerability narrative/OFC text for report output.
    - Replace ".." with "."
    - Trim whitespace
    - Collapse multiple spaces to one
    - Normalize documentation-review phrasing to assertive assessment language
    """
    if not s:
        return ""
    s = str(s).strip()
    while ".." in s:
        s = s.replace("..", ".")
    for pattern, replacement in (
        (r"\bassessment input records\b", ""),
        (r"\bin assessment input\b", ""),
        (r"\bassessment input\b", ""),
        (r"\bassessment indicates\b", ""),
        (r"\bassessment records\b", ""),
        (r"\binput records\b", ""),
        (r"\bnot documented as tested\b", "not confirmed as tested"),
        (r"\bnot documented or confirmed\b", "not confirmed"),
        (r"\bno documented\b", "no"),
        (r"\bnot documented\b", "not confirmed"),
        (r"\bis documented\b", "is confirmed"),
        (r"\bare documented\b", "are confirmed"),
        (r"\bdocumented\b", "confirmed"),
    ):
        s = re.sub(pattern, replacement, s, flags=re.IGNORECASE)
    s = " ".join(s.split())
    s = re.sub(r"\s+([,.;:])", r"\1", s)
    return sanitize_text(s)


def join_title_narrative(title: str, narrative: str) -> str:
    """Join title and narrative without double periods. Strip trailing period from title."""
    t = (title or "").strip().rstrip(".")
    n = (narrative or "").strip()
    if not t:
        return n
    if not n:
        return t
    return f"{t}. {n}"
