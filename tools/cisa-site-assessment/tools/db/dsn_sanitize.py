"""
psycopg2/libpq rejects Node-specific params like 'uselibpqcompat'.
Sanitize DSN to keep only params psycopg2 expects (allowlist minimal).
"""

from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse


def sanitize_psycopg2_dsn(url: str) -> str:
    """
    Strip Node-only / unsupported query params from a Postgres DSN.
    Ensures sslmode=require for encryption.
    """
    parsed = urlparse(url)
    q = dict(parse_qsl(parsed.query, keep_blank_values=True))

    # Drop Node-only / unsupported params
    q.pop("uselibpqcompat", None)

    # Ensure sslmode exists (encryption)
    q.setdefault("sslmode", "require")

    new_query = urlencode(q, doseq=True)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
    )
