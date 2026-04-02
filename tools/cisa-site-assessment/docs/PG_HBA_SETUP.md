# PostgreSQL pg_hba.conf Configuration Guide

## Overview

`pg_hba.conf` is PostgreSQL's host-based authentication configuration file. It controls which hosts can connect to the database, how they authenticate, and what databases/users they can access.

## Important: Supabase vs Local PostgreSQL

### Supabase (Cloud-Hosted)
- **You cannot modify `pg_hba.conf`** - Supabase manages this file
- Connection issues are typically resolved by:
  - Using SSL in connection strings: `?sslmode=require`
  - Ensuring correct database password (not service role key)
  - Using the correct port (5432 for direct, 6543 for pooler)

### Local PostgreSQL
- You have full control over `pg_hba.conf`
- File location depends on installation:
  - Windows: Usually in PostgreSQL data directory (e.g., `C:\Program Files\PostgreSQL\15\data\pg_hba.conf`)
  - Linux: Usually `/etc/postgresql/[version]/main/pg_hba.conf` or in data directory
  - macOS: Usually in data directory

## Finding Your pg_hba.conf Location

### Windows
```powershell
# Find PostgreSQL data directory
psql -U postgres -c "SHOW data_directory;"
# pg_hba.conf will be in that directory
```

### Linux/macOS
```bash
# Find PostgreSQL data directory
psql -U postgres -c "SHOW data_directory;"
# Or check common locations
ls -la /etc/postgresql/*/main/pg_hba.conf
```

## Standard Configuration for Local Development

A template `pg_hba.conf` is provided at `config/pg_hba.conf.template` with these settings:

1. **Local socket connections**: `scram-sha-256` authentication
2. **IPv4 localhost (127.0.0.1)**: `scram-sha-256` authentication
3. **IPv6 localhost (::1)**: `scram-sha-256` authentication
4. **Replication connections**: Enabled for localhost

## Applying the Configuration

1. **Backup your current pg_hba.conf**:
   ```powershell
   # Windows
   Copy-Item "C:\Program Files\PostgreSQL\15\data\pg_hba.conf" "C:\Program Files\PostgreSQL\15\data\pg_hba.conf.backup"
   ```

2. **Copy the template**:
   ```powershell
   Copy-Item "d:\PSA_System\psa_rebuild\config\pg_hba.conf.template" "C:\Program Files\PostgreSQL\15\data\pg_hba.conf"
   ```

3. **Reload PostgreSQL configuration** (no restart needed):
   ```sql
   -- Connect as superuser
   psql -U postgres
   SELECT pg_reload_conf();
   ```

   Or restart the PostgreSQL service:
   ```powershell
   Restart-Service postgresql-x64-15
   ```

## Common Authentication Methods

- **`scram-sha-256`**: Modern, secure password authentication (recommended)
- **`md5`**: Older password authentication (less secure, but more compatible)
- **`trust`**: No password required (⚠️ **NEVER use in production**)
- **`peer`**: Uses OS username (Unix only)
- **`ident`**: Maps OS user to PostgreSQL user (Unix only)

## Troubleshooting Connection Issues

### Error: "no pg_hba.conf entry for host"

**For Supabase:**
- Ensure connection string includes `?sslmode=require`
- Verify you're using the database password, not service role key
- Check that your IP is allowed (Supabase may have IP restrictions)

**For Local PostgreSQL:**
- Verify `pg_hba.conf` has an entry for your connection type (host/local)
- Check that the address matches (127.0.0.1 vs localhost vs ::1)
- Ensure PostgreSQL has reloaded the configuration: `SELECT pg_reload_conf();`

### Error: "password authentication failed"

- Verify the password is correct
- Check that the user exists: `SELECT * FROM pg_user WHERE usename = 'your_username';`
- Reset password if needed: `ALTER USER postgres WITH PASSWORD 'new_password';`

## Security Best Practices

1. **Never use `trust` authentication** except for local development
2. **Use `scram-sha-256`** for password authentication
3. **Restrict IP ranges** - only allow necessary hosts
4. **Use SSL/TLS** for remote connections
5. **Regular backups** of `pg_hba.conf` before changes

## For This Project

Since this project primarily uses **Supabase**, you typically don't need to modify `pg_hba.conf`. If you're setting up local PostgreSQL for development:

1. Install PostgreSQL locally
2. Create databases: `psa_corpus` and `psa_runtime`
3. Use the template `pg_hba.conf` provided
4. Update `.env.local` to point to localhost:
   ```bash
   CORPUS_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_corpus
   RUNTIME_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_runtime
   ```
