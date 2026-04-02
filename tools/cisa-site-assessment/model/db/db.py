"""
Unified Database Adapter
Single interface for all DB operations
Automatically uses Postgres (preferred) or Supabase REST (fallback)
"""

from typing import List, Dict, Optional, Any, Union, Tuple
from .db_config import get_db_mode
from .pg_client import PostgresClient
from .supabase_client import SupabaseRestClient

# Global client instances (lazy initialization)
_pg_client: Optional[PostgresClient] = None
_supabase_client: Optional[SupabaseRestClient] = None
_db_mode: Optional[str] = None


def _get_client(force_mode: Optional[str] = None):
    """Get appropriate client based on configuration, with automatic fallback."""
    global _pg_client, _supabase_client, _db_mode
    
    # Allow forcing a mode (useful after fallback)
    if force_mode:
        _db_mode = force_mode
    
    if _db_mode is None:
        _db_mode = get_db_mode()
    
    if _db_mode == "postgres":
        if _pg_client is None:
            try:
                _pg_client = PostgresClient()
            except (ValueError, Exception) as e:
                # Postgres connection failed - try REST API fallback
                error_msg = str(e).lower()
                if any(keyword in error_msg for keyword in ['timeout', 'timed out', 'connection refused', 'unreachable']):
                    # Check if REST API credentials are available
                    import os
                    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
                    corpus_key = os.getenv('SUPABASE_CORPUS_SERVICE_ROLE_KEY')
                    
                    if corpus_url and corpus_key:
                        print("  ⚠️  Postgres connection failed, falling back to REST API...")
                        _db_mode = "supabase_rest"
                        # Clear postgres client so we don't try it again
                        _pg_client = None
                        if _supabase_client is None:
                            _supabase_client = SupabaseRestClient()
                        return _supabase_client
                    else:
                        # No REST fallback available, re-raise original error
                        raise
                else:
                    # Non-connection error, re-raise
                    raise
        return _pg_client
    else:
        if _supabase_client is None:
            _supabase_client = SupabaseRestClient()
        return _supabase_client


def db_select(
    sql_or_table: str,
    params: Optional[Union[Tuple, Dict]] = None,
    select: Optional[str] = None,
    filters: Optional[Dict[str, Any]] = None,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Execute SELECT query.
    
    In postgres mode:
        - sql_or_table: SQL query string
        - params: Query parameters
    
    In supabase_rest mode:
        - sql_or_table: Table/view name
        - select: Column selection (default: '*')
        - filters: Dict of PostgREST filters
        - limit: Max rows
    
    Returns:
        List of dicts
    """
    global _db_mode
    
    # Get client (may trigger fallback to REST)
    client = _get_client()
    
    # Check actual mode after potential fallback
    mode = _db_mode if _db_mode else get_db_mode()
    
    if mode == "postgres":
        if not sql_or_table.strip().upper().startswith('SELECT'):
            raise ValueError("db_select in postgres mode requires SELECT SQL")
        return client.query(sql_or_table, params)
    else:
        # Supabase REST mode
        return client.query(
            sql_or_table,
            select=select or '*',
            filters=filters,
            limit=limit
        )


def db_upsert_question_meaning(
    canon_id: str,
    discipline: str,
    meaning_text: str,
    citations: List[Dict],
    model_name: str,
    warnings: List[str]
) -> Dict[str, Any]:
    """
    Upsert question meaning into public.question_meaning table.
    
    Args:
        canon_id: Question canon_id
        discipline: Discipline code
        meaning_text: Generated meaning text
        citations: List of citation dicts
        model_name: Model name used
        warnings: List of warning strings
    
    Returns:
        Inserted/updated row as dict
    """
    import json
    from datetime import datetime
    
    client = _get_client()
    mode = get_db_mode()
    
    payload = {
        'canon_id': canon_id,
        'discipline': discipline,
        'meaning_text': meaning_text,
        'citations': citations,  # Will be converted to JSONB
        'model_name': model_name,
        'warnings': warnings,  # Will be converted to JSONB
        'locked': True,
        'derived_at': datetime.utcnow().isoformat() + 'Z'
    }
    
    if mode == "postgres":
        # Use SQL UPSERT
        citations_jsonb = json.dumps(citations)
        warnings_jsonb = json.dumps(warnings)
        
        sql = """
        INSERT INTO public.question_meaning (
            canon_id, discipline, meaning_text, citations, model_name, warnings, locked
        ) VALUES (%s, %s, %s, %s::jsonb, %s, %s::jsonb, true)
        ON CONFLICT (canon_id) DO UPDATE SET
            meaning_text = EXCLUDED.meaning_text,
            citations = EXCLUDED.citations,
            model_name = EXCLUDED.model_name,
            warnings = EXCLUDED.warnings,
            derived_at = now()
        RETURNING *
        """
        
        result = client.query(
            sql,
            (canon_id, discipline, meaning_text, citations_jsonb, model_name, warnings_jsonb)
        )
        return result[0] if result else {}
    else:
        # Supabase REST mode
        # Convert JSONB fields to JSON strings for REST API
        payload['citations'] = json.dumps(citations)
        payload['warnings'] = json.dumps(warnings)
        
        return client.upsert('question_meaning', payload, on_conflict='canon_id')
