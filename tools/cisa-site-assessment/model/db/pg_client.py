"""
Postgres Client Module
Uses psycopg2 (fallback to psycopg if available)
Provides query() and execute() methods
"""

import sys
from typing import List, Dict, Optional, Any, Union, Tuple

# Try psycopg3 first, fallback to psycopg2
try:
    import psycopg
    PSYCOPG_VERSION = 3
except ImportError:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        PSYCOPG_VERSION = 2
    except ImportError:
        raise ImportError(
            "Neither psycopg nor psycopg2 is installed. "
            "Install with: pip install psycopg2-binary (or psycopg[binary] for v3)"
        )

from .db_config import get_postgres_dsn, get_db_info


class PostgresClient:
    """Postgres database client with fail-fast connection."""
    
    def __init__(self, dsn: Optional[str] = None):
        """
        Initialize Postgres client.
        
        Args:
            dsn: Connection string (optional, uses get_postgres_dsn() if not provided)
        """
        self.dsn = dsn or get_postgres_dsn()
        self._conn = None
        
        # Print connection info (no secrets)
        info = get_db_info()
        print(f"DB CONNECT: postgres")
        print(f"  host: {info.get('host', 'unknown')}")
        print(f"  database: {info.get('database', 'unknown')}")
        
        # Connect immediately (fail-fast)
        self._connect()
    
    def _connect(self):
        """Establish connection (fail-fast on errors with hard timeouts)."""
        from urllib.parse import urlparse, parse_qs
        
        # Parse DSN to extract connection details for error messages
        dsn_parts = {}
        if '://' in self.dsn:
            parsed = urlparse(self.dsn)
            dsn_parts['host'] = parsed.hostname or 'unknown'
            dsn_parts['port'] = parsed.port or 'default'
            dsn_parts['database'] = parsed.path.lstrip('/') or 'unknown'
        else:
            # Key-value format
            for part in self.dsn.split():
                if '=' in part:
                    key, val = part.split('=', 1)
                    if key in ['host', 'port', 'dbname', 'database']:
                        dsn_parts[key] = val
        
        # Determine which env var was used
        env_var_used = "DATABASE_URL"
        if 'yylslokiaovdythzrbgt' in str(self.dsn) or 'corpus' in str(self.dsn).lower():
            env_var_used = "SUPABASE_CORPUS_URL"
        elif 'wivohgbuuwxoyfyzntsd' in str(self.dsn) or 'SUPABASE_RUNTIME_URL' in str(self.dsn) or 'supabase' in str(self.dsn).lower():
            env_var_used = "SUPABASE_RUNTIME_URL"
        
        try:
            if PSYCOPG_VERSION == 3:
                # psycopg3: add connect_timeout and statement_timeout
                connect_params = {}
                if 'connect_timeout' not in self.dsn:
                    connect_params['connect_timeout'] = 5
                self._conn = psycopg.connect(self.dsn, **connect_params)
                # Set statement timeout
                with self._conn.cursor() as cur:
                    cur.execute("SET statement_timeout = '8000ms'")
                self._conn.commit()
            else:
                # psycopg2 - add connect_timeout and try ports with explicit logging
                connect_timeout = 5
                if 'connect_timeout' not in self.dsn:
                    # Add connect_timeout to DSN
                    dsn_with_timeout = self.dsn
                    if '?' in dsn_with_timeout:
                        dsn_with_timeout += f"&connect_timeout={connect_timeout}"
                    else:
                        dsn_with_timeout += f" connect_timeout={connect_timeout}"
                else:
                    dsn_with_timeout = self.dsn
                
                # Try ports if not specified (max 2 attempts total)
                if 'port=' not in self.dsn and ':' not in self.dsn.split('@')[-1]:
                    ports = [6543, 5432]
                    last_error = None
                    for i, port in enumerate(ports):
                        try:
                            print(f"  Attempting connection on port {port}...")
                            dsn_with_port = dsn_with_timeout + f" port={port}"
                            self._conn = psycopg2.connect(dsn_with_port)
                            print(f"  ✓ Connected on port {port}")
                            # Set statement timeout
                            cur = self._conn.cursor()
                            try:
                                cur.execute("SET statement_timeout = '8000ms'")
                                self._conn.commit()
                            finally:
                                cur.close()
                            return
                        except Exception as e:
                            last_error = e
                            if i < len(ports) - 1:
                                print(f"  ✗ Port {port} failed: {type(e).__name__}")
                            continue
                    # Both ports failed
                    if last_error:
                        raise last_error
                else:
                    # Port specified in DSN
                    self._conn = psycopg2.connect(dsn_with_timeout)
                    # Set statement timeout
                    cur = self._conn.cursor()
                    try:
                        cur.execute("SET statement_timeout = '8000ms'")
                        self._conn.commit()
                    finally:
                        cur.close()
        except Exception as e:
            error_class = type(e).__name__
            error_msg = str(e)
            
            # Extract host/port for error message
            host = dsn_parts.get('host', 'unknown')
            port = dsn_parts.get('port', 'unknown')
            
            # Build actionable error message
            if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
                raise ValueError(
                    f"Postgres connection TIMEOUT (exceeded 5s connect timeout).\n"
                    f"  Mode: postgres\n"
                    f"  Host: {host}\n"
                    f"  Port: {port}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Check network/VPN/firewall; verify host reachable; DNS resolution OK?"
                ) from e
            elif 'password' in error_msg.lower() or 'authentication' in error_msg.lower():
                raise ValueError(
                    f"Postgres authentication failed.\n"
                    f"  Mode: postgres\n"
                    f"  Host: {host}\n"
                    f"  Port: {port}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Verify {env_var_used} credentials; check SUPABASE_RUNTIME_DB_PASSWORD if using Supabase"
                ) from e
            elif 'ssl' in error_msg.lower():
                raise ValueError(
                    f"Postgres SSL connection failed.\n"
                    f"  Mode: postgres\n"
                    f"  Host: {host}\n"
                    f"  Port: {port}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Ensure sslmode=require in connection string; verify SSL certificate"
                ) from e
            elif 'refused' in error_msg.lower() or 'connection refused' in error_msg.lower():
                raise ValueError(
                    f"Postgres connection refused.\n"
                    f"  Mode: postgres\n"
                    f"  Host: {host}\n"
                    f"  Port: {port}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Host reachable? Port blocked by firewall? Service running?"
                ) from e
            else:
                raise ValueError(
                    f"Postgres connection failed.\n"
                    f"  Mode: postgres\n"
                    f"  Host: {host}\n"
                    f"  Port: {port}\n"
                    f"  Env var: {env_var_used}\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Verify {env_var_used} format; check network connectivity"
                ) from e
    
    def query(self, sql: str, params: Optional[Union[Tuple, Dict]] = None) -> List[Dict[str, Any]]:
        """
        Execute SELECT query and return results as list of dicts.
        
        Args:
            sql: SQL query string
            params: Query parameters (tuple or dict)
        
        Returns:
            List of dicts, one per row
        """
        if not self._conn:
            self._connect()
        
        # Check if connection is closed (psycopg2)
        if PSYCOPG_VERSION == 2:
            if self._conn.closed:
                self._connect()
        else:
            # psycopg3 - check connection status differently
            try:
                self._conn.execute("SELECT 1")
            except:
                self._connect()
        
        try:
            if PSYCOPG_VERSION == 3:
                with self._conn.cursor() as cur:
                    cur.execute(sql, params)
                    columns = [desc[0] for desc in cur.description] if cur.description else []
                    rows = cur.fetchall()
                    return [dict(zip(columns, row)) for row in rows]
            else:
                cur = self._conn.cursor(cursor_factory=RealDictCursor)
                try:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    return [dict(row) for row in rows]
                finally:
                    cur.close()
        except Exception as e:
            error_class = type(e).__name__
            error_msg = str(e)
            if 'timeout' in error_msg.lower() or 'statement_timeout' in error_msg.lower():
                raise RuntimeError(
                    f"Query TIMEOUT (exceeded 8s statement timeout).\n"
                    f"  Query: {sql[:200]}...\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Query too slow? Check database performance; optimize query"
                ) from e
            else:
                raise RuntimeError(
                    f"Query failed.\n"
                    f"  Query: {sql[:200]}...\n"
                    f"  Exception: {error_class}: {error_msg}"
                ) from e
    
    def execute(self, sql: str, params: Optional[Union[Tuple, Dict]] = None) -> None:
        """
        Execute INSERT/UPDATE/DELETE statement.
        
        Args:
            sql: SQL statement
            params: Query parameters (tuple or dict)
        """
        if not self._conn:
            self._connect()
        
        # Check if connection is closed (psycopg2)
        if PSYCOPG_VERSION == 2:
            if self._conn.closed:
                self._connect()
        else:
            # psycopg3 - check connection status differently
            try:
                self._conn.execute("SELECT 1")
            except:
                self._connect()
        
        try:
            if PSYCOPG_VERSION == 3:
                with self._conn.cursor() as cur:
                    cur.execute(sql, params)
                self._conn.commit()
            else:
                cur = self._conn.cursor()
                try:
                    cur.execute(sql, params)
                    self._conn.commit()
                finally:
                    cur.close()
        except Exception as e:
            if self._conn:
                try:
                    self._conn.rollback()
                except:
                    pass
            error_class = type(e).__name__
            error_msg = str(e)
            if 'timeout' in error_msg.lower() or 'statement_timeout' in error_msg.lower():
                raise RuntimeError(
                    f"Execute TIMEOUT (exceeded 8s statement timeout).\n"
                    f"  Statement: {sql[:200]}...\n"
                    f"  Exception: {error_class}: {error_msg}\n"
                    f"  Next steps: Statement too slow? Check database performance; optimize statement"
                ) from e
            else:
                raise RuntimeError(
                    f"Execute failed.\n"
                    f"  Statement: {sql[:200]}...\n"
                    f"  Exception: {error_class}: {error_msg}"
                ) from e
    
    def close(self):
        """Close connection."""
        if self._conn:
            if PSYCOPG_VERSION == 2:
                if not self._conn.closed:
                    self._conn.close()
            else:
                # psycopg3
                try:
                    self._conn.close()
                except:
                    pass
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
