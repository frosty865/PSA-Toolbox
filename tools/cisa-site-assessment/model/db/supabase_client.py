"""
Supabase REST Client Module
Fallback client using PostgREST API when direct Postgres is unavailable
"""

import requests
from typing import List, Dict, Optional, Any
from .db_config import get_supabase_creds


class SupabaseRestClient:
    """Supabase REST API client using PostgREST."""
    
    def __init__(self):
        """Initialize Supabase REST client."""
        creds = get_supabase_creds()
        self.base_url = creds['url'].rstrip('/')
        self.service_role_key = creds['service_role_key']
        
        # Ensure base_url has /rest/v1
        if '/rest/v1' not in self.base_url:
            self.base_url = f"{self.base_url}/rest/v1"
        
        print(f"DB CONNECT: supabase_rest")
        print(f"  url: {self.base_url}")
        
        # Test connection
        self._test_connection()
    
    def _test_connection(self):
        """Test connection with a simple query (hard 8s timeout)."""
        from urllib.parse import urlparse
        import os
        
        # Extract host for error messages
        parsed = urlparse(self.base_url)
        host = parsed.hostname or 'unknown'
        
        # Determine which database we're connecting to and use appropriate test table
        # Check if this is CORPUS database
        corpus_url = os.getenv('SUPABASE_CORPUS_URL', '')
        is_corpus = 'yylslokiaovdythzrbgt' in self.base_url or (corpus_url and corpus_url in self.base_url)
        
        # Use appropriate test table based on database
        test_table = 'corpus_documents' if is_corpus else 'baseline_spines_runtime'
        test_select = 'id' if is_corpus else 'canon_id'
        
        try:
            # Try to query a simple table to test connection
            response = requests.get(
                f"{self.base_url}/{test_table}",
                headers={
                    'apikey': self.service_role_key,
                    'Authorization': f'Bearer {self.service_role_key}',
                    'Content-Type': 'application/json',
                    'Prefer': 'count=exact'
                },
                params={'select': test_select, 'limit': '1'},
                timeout=8  # Hard 8s timeout
            )
            
            if response.status_code == 401 or response.status_code == 403:
                # Determine which env var was used
                env_var_used = "SUPABASE_CORPUS_SERVICE_ROLE_KEY" if is_corpus else "SUPABASE_SERVICE_ROLE_KEY"
                raise ValueError(
                    f"SERVICE_ROLE_KEY invalid or missing.\n"
                    f"  Mode: rest\n"
                    f"  Host: {host}\n"
                    f"  Endpoint: /{test_table}\n"
                    f"  HTTP Status: {response.status_code}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Next steps: Verify {env_var_used} is set correctly"
                )
            # 404 is OK - table might not exist, but connection works
        except requests.exceptions.Timeout as e:
            env_var_used = "SUPABASE_CORPUS_URL" if is_corpus else "SUPABASE_URL"
            raise ValueError(
                f"Supabase REST connection TIMEOUT (exceeded 8s timeout).\n"
                f"  Mode: rest\n"
                f"  Host: {host}\n"
                f"  Endpoint: /{test_table}\n"
                f"  Env var: {env_var_used}\n"
                f"  Exception: {type(e).__name__}: {str(e)}\n"
                f"  Next steps: Check network/VPN/firewall; verify {env_var_used} reachable"
            ) from e
        except requests.exceptions.RequestException as e:
            error_class = type(e).__name__
            error_msg = str(e)
            env_var_used = "SUPABASE_CORPUS_URL" if is_corpus else "SUPABASE_URL"
            raise ValueError(
                f"Supabase REST connection failed.\n"
                f"  Mode: rest\n"
                f"  Host: {host}\n"
                f"  Endpoint: /{test_table}\n"
                f"  Env var: {env_var_used}\n"
                f"  Exception: {error_class}: {error_msg}\n"
                f"  Next steps: Check network/VPN/firewall; verify {env_var_used} reachable"
            ) from e
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers."""
        return {
            'apikey': self.service_role_key,
            'Authorization': f'Bearer {self.service_role_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    
    def query(self, table_or_view: str, select: str = "*", filters: Optional[Dict[str, Any]] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Query table/view using PostgREST.
        
        Args:
            table_or_view: Table or view name (e.g., 'citation_ready_statements')
            select: Column selection (default: '*')
            filters: Dict of filters (e.g., {'chunk_text.ilike': '%keyword%'})
            limit: Max rows to return
        
        Returns:
            List of dicts
        """
        url = f"{self.base_url}/{table_or_view}"
        params = {'select': select}
        
        if filters:
            for key, value in filters.items():
                params[key] = value
        
        if limit:
            params['limit'] = str(limit)
        
        from urllib.parse import urlparse
        parsed = urlparse(self.base_url)
        host = parsed.hostname or 'unknown'
        
        try:
            response = requests.get(
                url,
                headers=self._get_headers(),
                params=params,
                timeout=8  # Hard 8s timeout
            )
            
            if response.status_code == 401 or response.status_code == 403:
                raise ValueError(
                    f"SERVICE_ROLE_KEY invalid or missing.\n"
                    f"  Mode: rest\n"
                    f"  Host: {host}\n"
                    f"  Endpoint: /{table_or_view}\n"
                    f"  HTTP Status: {response.status_code}\n"
                    f"  Env var: SUPABASE_SERVICE_ROLE_KEY"
                )
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            raise RuntimeError(
                f"Query TIMEOUT (exceeded 8s timeout).\n"
                f"  Table/view: {table_or_view}\n"
                f"  Host: {host}\n"
                f"  Exception: {type(e).__name__}: {str(e)}\n"
                f"  Next steps: Query too slow? Check network/VPN/firewall"
            ) from e
        except requests.exceptions.RequestException as e:
            error_class = type(e).__name__
            error_msg = str(e)
            raise RuntimeError(
                f"Query failed.\n"
                f"  Table/view: {table_or_view}\n"
                f"  Host: {host}\n"
                f"  Exception: {error_class}: {error_msg}"
            ) from e
    
    def upsert(self, table: str, data: Dict[str, Any], on_conflict: Optional[str] = None) -> Dict[str, Any]:
        """
        Upsert (INSERT ... ON CONFLICT) using PostgREST.
        
        Args:
            table: Table name
            data: Row data as dict
            on_conflict: Conflict resolution (e.g., 'canon_id' for ON CONFLICT (canon_id))
        
        Returns:
            Inserted/updated row as dict
        """
        url = f"{self.base_url}/{table}"
        headers = self._get_headers()
        
        if on_conflict:
            headers['Prefer'] = f'return=representation,resolution=merge-duplicates'
            # PostgREST uses ?on_conflict=column_name
            url += f"?on_conflict={on_conflict}"
        else:
            headers['Prefer'] = 'return=representation'
        
        from urllib.parse import urlparse
        parsed = urlparse(self.base_url)
        host = parsed.hostname or 'unknown'
        
        try:
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=8  # Hard 8s timeout
            )
            
            if response.status_code == 401 or response.status_code == 403:
                raise ValueError(
                    f"SERVICE_ROLE_KEY invalid or missing.\n"
                    f"  Mode: rest\n"
                    f"  Host: {host}\n"
                    f"  Endpoint: /{table}\n"
                    f"  HTTP Status: {response.status_code}\n"
                    f"  Env var: SUPABASE_SERVICE_ROLE_KEY"
                )
            
            response.raise_for_status()
            result = response.json()
            # PostgREST returns array, return first item
            return result[0] if isinstance(result, list) and result else result
        except requests.exceptions.Timeout as e:
            raise RuntimeError(
                f"Upsert TIMEOUT (exceeded 8s timeout).\n"
                f"  Table: {table}\n"
                f"  Host: {host}\n"
                f"  Exception: {type(e).__name__}: {str(e)}\n"
                f"  Next steps: Operation too slow? Check network/VPN/firewall"
            ) from e
        except requests.exceptions.RequestException as e:
            error_class = type(e).__name__
            error_msg = str(e)
            raise RuntimeError(
                f"Upsert failed.\n"
                f"  Table: {table}\n"
                f"  Host: {host}\n"
                f"  Exception: {error_class}: {error_msg}"
            ) from e
