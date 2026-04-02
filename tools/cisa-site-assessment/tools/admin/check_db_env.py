"""Helper script to check and construct database URLs from environment variables."""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Load .env.local if it exists
_env_path = Path(__file__).parent.parent.parent / '.env.local'
if _env_path.exists():
    with open(_env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip().strip('\\').strip().strip('"').strip("'")
                os.environ[key.strip()] = value

def construct_runtime_url():
    """Construct RUNTIME database URL from environment variables."""
    # Check if PSA_RUNTIME_DB_URL is already set
    if os.getenv('PSA_RUNTIME_DB_URL'):
        return os.getenv('PSA_RUNTIME_DB_URL')
    
    # Check DATABASE_URL (might point to RUNTIME)
    database_url = os.getenv('DATABASE_URL')
    if database_url and ('wivohgbuuwxoyfyzntsd' in database_url or 'runtime' in database_url.lower()):
        return database_url
    
    # Try to construct from SUPABASE_RUNTIME_URL + password
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and password:
        # Extract project ref from URL
        if 'supabase.co' in runtime_url:
            if '://' in runtime_url:
                hostname = runtime_url.split('://')[1].split('/')[0].split(':')[0]
            else:
                hostname = runtime_url.split('/')[0].split(':')[0]
            # Extract project ref
            if '.' in hostname:
                project_ref = hostname.split('.')[0]
            else:
                project_ref = hostname.replace('.supabase.co', '')
            
            dbname = 'postgres'  # Default
            runtime_db_url = os.getenv('RUNTIME_DATABASE_URL')
            if runtime_db_url:
                try:
                    parsed = urlparse(runtime_db_url)
                    dbname = parsed.path.replace('/', '') or 'postgres'
                except:
                    pass
            
            return f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:6543/{dbname}?sslmode=require"
    
    return None

def construct_corpus_url():
    """Construct CORPUS database URL from environment variables."""
    # Check if PSA_CORPUS_DB_URL is already set
    if os.getenv('PSA_CORPUS_DB_URL'):
        return os.getenv('PSA_CORPUS_DB_URL')
    
    # Check CORPUS_DATABASE_URL
    corpus_db_url = os.getenv('CORPUS_DATABASE_URL')
    if corpus_db_url:
        return corpus_db_url
    
    # Check DATABASE_URL (might point to CORPUS)
    database_url = os.getenv('DATABASE_URL')
    if database_url and ('yylslokiaovdythzrbgt' in database_url or 'corpus' in database_url.lower()):
        return database_url
    
    # Try to construct from SUPABASE_CORPUS_URL + password
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and password:
        # Extract project ref from URL
        if 'supabase.co' in corpus_url:
            if '://' in corpus_url:
                hostname = corpus_url.split('://')[1].split('/')[0].split(':')[0]
            else:
                hostname = corpus_url.split('/')[0].split(':')[0]
            # Extract project ref
            if '.' in hostname:
                project_ref = hostname.split('.')[0]
            else:
                project_ref = hostname.replace('.supabase.co', '')
            
            dbname = 'postgres'  # Default
            corpus_db_url = os.getenv('CORPUS_DATABASE_URL')
            if corpus_db_url:
                try:
                    parsed = urlparse(corpus_db_url)
                    dbname = parsed.path.replace('/', '') or 'postgres'
                except:
                    pass
            
            return f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:6543/{dbname}?sslmode=require"
    
    return None

if __name__ == '__main__':
    runtime_url = construct_runtime_url()
    corpus_url = construct_corpus_url()
    
    print("Database URL Status:")
    print(f"  PSA_RUNTIME_DB_URL: {'✓ Set' if runtime_url else '✗ Missing'}")
    print(f"  PSA_CORPUS_DB_URL: {'✓ Set' if corpus_url else '✗ Missing'}")
    
    if runtime_url:
        # Mask password in output
        masked = runtime_url.split('@')[0].split(':')[0] + ':***@' + '@'.join(runtime_url.split('@')[1:]) if '@' in runtime_url else runtime_url
        print(f"\n  Runtime URL: {masked}")
    
    if corpus_url:
        # Mask password in output
        masked = corpus_url.split('@')[0].split(':')[0] + ':***@' + '@'.join(corpus_url.split('@')[1:]) if '@' in corpus_url else corpus_url
        print(f"  Corpus URL: {masked}")
    
    if not runtime_url or not corpus_url:
        print("\nMissing environment variables. Please set:")
        if not runtime_url:
            print("  - PSA_RUNTIME_DB_URL (or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD)")
        if not corpus_url:
            print("  - PSA_CORPUS_DB_URL (or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD)")
        sys.exit(1)
    
    # Export for use in shell
    print(f"\nTo use these URLs, run:")
    print(f'  $env:PSA_RUNTIME_DB_URL="{runtime_url}"')
    print(f'  $env:PSA_CORPUS_DB_URL="{corpus_url}"')
