# Deployment Checklist: Module Attributes Removal

## Pre-Deployment Verification

### 1. Run All Guards
```bash
cd d:\PSA_System\psa_rebuild
npm run guard:no-module-attributes
npm run guard:module-templates
npm run guard:no-scenario-context
npm run guard:standard-seed
```

### 2. Build Verification
```bash
npm run build
```

This runs all guards and builds the Next.js application. Ensure it completes successfully.

### 3. Type Checking
```bash
npm run typecheck
```

### 4. Test Locally
```bash
npm run dev
```

Verify:
- ✅ Standard tab shows no "Attributes" section
- ✅ Module generation works without attributes
- ✅ Criteria all default to APPLIES
- ✅ No errors in browser console

## Deployment Steps

### Option A: Manual Deployment (If Running on Server)

1. **Backup Current Version**
   ```bash
   # If using git
   git tag pre-attributes-removal-$(date +%Y%m%d)
   git push origin --tags
   ```

2. **Pull Latest Code** (if using version control)
   ```bash
   git pull origin main  # or your branch
   ```

3. **Install Dependencies** (if package.json changed)
   ```bash
   npm ci
   ```

4. **Run Guards**
   ```bash
   npm run guard:no-module-attributes
   ```

5. **Build Production**
   ```bash
   npm run build
   ```

6. **Restart Application**
   ```bash
   # If using PM2
   pm2 restart psa-rebuild
   
   # If using systemd
   sudo systemctl restart psa-rebuild
   
   # If using NSSM (Windows)
   nssm restart psa-rebuild
   
   # Or manually stop/start
   npm start
   ```

### Option B: Vercel/Next.js Hosting

1. **Push to Repository**
   ```bash
   git add .
   git commit -m "Remove module attributes from doctrine system"
   git push origin main
   ```

2. **Vercel Auto-Deploy**
   - If connected to Vercel, it will auto-deploy on push
   - Check Vercel dashboard for build status

3. **Verify Deployment**
   - Check production URL
   - Verify Standard tab behavior

### Option C: Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t psa-rebuild:latest .
   ```

2. **Stop Running Container**
   ```bash
   docker stop psa-rebuild
   ```

3. **Start New Container**
   ```bash
   docker run -d --name psa-rebuild \
     -p 3000:3000 \
     --env-file .env.production \
     psa-rebuild:latest
   ```

## Database Considerations

### ✅ No Database Migrations Required

The changes are **code-only**:
- `module_instances.attributes_json` column still exists (for backward compatibility)
- Column is now always set to `{}` (empty JSON)
- `module_standard_attributes` table still exists in CORPUS (historical data)
- No schema changes needed

### Optional: Clean Up Old Attribute Data

If you want to clean up old attribute data (not required):

```sql
-- In RUNTIME database
UPDATE public.module_instances 
SET attributes_json = '{}'::jsonb 
WHERE attributes_json IS NOT NULL 
  AND attributes_json != '{}'::jsonb;
```

**Note**: This is optional - the code already ignores `attributes_json` values.

## Post-Deployment Verification

### 1. Smoke Tests

1. **Navigate to Module Admin**
   - Go to `/admin/modules/EV_PARKING` (or any module)
   - Click "Standard" tab

2. **Verify No Attributes Section**
   - ✅ Should see Standard dropdown
   - ✅ Should NOT see "Attributes" section
   - ✅ Should see "Generate" button

3. **Test Module Generation**
   - Select a standard (e.g., `EV_PARKING`)
   - Click "Generate (preview)"
   - ✅ Should see criteria list (all APPLIES)
   - ✅ Should see OFCs list
   - ✅ No errors

4. **Test Full Generation**
   - Uncheck "Dry run"
   - Click "Generate (write instance)"
   - ✅ Should create module instance
   - ✅ All criteria should be APPLIES
   - ✅ OFCs should be generated

### 2. Check Logs

```bash
# If using PM2
pm2 logs psa-rebuild

# If using systemd
sudo journalctl -u psa-rebuild -f

# If using Docker
docker logs -f psa-rebuild
```

Look for:
- ✅ No errors about missing attributes
- ✅ No errors about attribute validation
- ✅ Successful module generation

### 3. Verify Guard Still Works

```bash
npm run guard:no-module-attributes
```

Should output:
```
[OK][NO_MODULE_ATTRIBUTES] No module attributes detected in app/ directory.
```

## Rollback Plan

If issues occur:

1. **Revert Code**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Or Restore Previous Version**
   ```bash
   git checkout pre-attributes-removal-<date>
   npm run build
   # Restart application
   ```

3. **Database**: No rollback needed (no schema changes)

## Final cleanup before deployment (deferred)

Do **before** first production deployment:

- **CORPUS: Remove duplicate `documents` surface**  
  Migrate all code from `public.documents` (legacy view over `archive.documents`) to `public.corpus_documents`. Then drop the view and optionally `archive.documents`.  
  - ~30+ references across `tools/`, `app/api/`, and scripts (SELECT/INSERT/JOIN); use `corpus_documents` and `id` instead of `document_id` where appropriate.  
  - Estimate: half day to 1–2 days including testing.  
  - See earlier discussion in this repo (search for "duplicate tables in corpus" / "documents vs corpus_documents").

---

## Monitoring

After deployment, monitor for:
- ✅ No increase in error rates
- ✅ Module generation still works
- ✅ No user reports of missing functionality
- ✅ Standard tab loads correctly

## Files Changed (For Reference)

1. `app/admin/modules/[moduleCode]/page.tsx` - Removed Attributes UI
2. `app/api/admin/modules/[moduleCode]/standard/generate/route.ts` - Removed attribute handling
3. `app/api/admin/module-standards/[standardKey]/route.ts` - Removed attributes from response
4. `scripts/guards/verifyNoModuleAttributes.js` - New guard script
5. `package.json` - Added guard script
6. `docs/MODULE_ATTRIBUTES_REMOVAL.md` - Documentation

## Support

If issues arise:
1. Check application logs
2. Verify guard passes: `npm run guard:no-module-attributes`
3. Verify build succeeds: `npm run build`
4. Check browser console for errors
5. Review `docs/MODULE_ATTRIBUTES_REMOVAL.md` for details
