# Quick Start: Deprecate BASE-0xx Elements

## For PSA Rebuild Repository ✅

**Status**: Complete - All changes implemented and ready to deploy.

See `docs/doctrine/DEPRECATION_IMPLEMENTATION_SUMMARY.md` for details.

## For PSA Engine Repository 🔧

**Status**: Implementation required

### Quick Steps:

1. **Copy Files**:
   ```bash
   # Copy helper module
   cp ../psa_rebuild/tools/deprecated_elements.py tools/
   
   # Copy migrations
   cp ../psa_rebuild/migrations/20250127_*.sql migrations/
   ```

2. **Apply Migrations**:
   ```bash
   psql -d your_database -f migrations/20250127_add_required_elements_deprecation.sql
   psql -d your_database -f migrations/20250127_deprecate_base_0xx_video_surveillance.sql
   ```

3. **Update OFC Generation**:
   - Locate your OFC generation code (typically in `tools/` or `api/`)
   - Add import: `from tools.deprecated_elements import should_skip_ofc_generation, log_skipped_ofc`
   - Add guard before OFC generation:
     ```python
     should_skip, reason = should_skip_ofc_generation(required_element)
     if should_skip:
         log_skipped_ofc(required_element.get('element_code'), 'deprecated_required_element', reason)
         continue
     ```

4. **Update Database Queries**:
   - Add `WHERE status = 'active'` to all queries fetching required elements for OFC generation

5. **Update Baseline Views**:
   - Add `AND status = 'active'` to baseline reporting views

### Full Guide:

See `docs/doctrine/PSA_ENGINE_IMPLEMENTATION.md` for detailed instructions with code examples.

---

**Last Updated**: 2025-01-27

