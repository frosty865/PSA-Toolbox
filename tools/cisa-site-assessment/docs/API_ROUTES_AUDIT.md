# API Routes Audit Report

**Date**: 2025-01-22  
**Total Routes Audited**: 103 route files  
**Audit Scope**: Security, error handling, input validation, database practices

## Executive Summary

This audit covers all API routes in the `app/api` directory. The audit focuses on:
- SQL injection vulnerabilities
- Error handling patterns
- Input validation
- Database connection management
- Response formatting consistency
- Type safety

## Critical Findings

### 1. SQL Injection Risk Assessment

**Status**: ✅ **GOOD** - Most routes use parameterized queries correctly

**Findings**:
- 51 routes contain string interpolation patterns (`${}`, `+`, template literals)
- **However**, upon inspection, these are primarily used for:
  - Dynamic query construction with parameterized placeholders (`$1`, `$2`, etc.)
  - Conditional WHERE clause building (still using parameters)
  - Column/table name construction (safe when values are controlled)

**Example of Safe Pattern** (from `app/api/runtime/assessments/[assessmentId]/questions/route.ts`):
```typescript
let expansionQuery = `
  SELECT question_code, question_text
  FROM public.expansion_questions
  WHERE is_active = true AND (
    scope_type IS NULL
`;
if (sectorCode) {
  expansionQuery += ` OR (scope_type = 'SECTOR' AND scope_code = $${paramIndex})`;
  expansionParams.push(sectorCode); // ✅ Parameterized
  paramIndex++;
}
```

**Recommendation**: Continue using parameterized queries. Consider using a query builder library for complex dynamic queries to reduce risk.

### 2. Error Handling Patterns

**Status**: ⚠️ **INCONSISTENT** - Multiple patterns exist

**Patterns Found**:
1. **Try-catch with NextResponse.json** (Most common - ✅ Good)
   ```typescript
   try {
     // ... logic
   } catch (error: any) {
     console.error(`[API ...] Error:`, error);
     return NextResponse.json(
       { error: "Failed to...", message: error?.message },
       { status: 500 }
     );
   }
   ```

2. **Error details exposure** (⚠️ Some routes expose stack traces)
   - `app/api/runtime/assessments/[assessmentId]/questions/route.ts` exposes `stack`, `code`, `detail`, `constraint`, `table`, `column`
   - **Risk**: Information leakage in production

3. **Silent failures** (⚠️ Some routes catch and continue)
   - Some routes catch errors but continue execution with empty results
   - Example: `app/api/runtime/assessments/[assessmentId]/questions/route.ts` lines 199-202, 224-228

**Recommendations**:
- Standardize error handling middleware
- Never expose stack traces in production responses
- Log detailed errors server-side only
- Return consistent error response format:
  ```typescript
  {
    error: "User-friendly message",
    code?: "ERROR_CODE", // Optional error code for client handling
    // NO stack, detail, constraint, etc. in production
  }
  ```

### 3. Input Validation

**Status**: ⚠️ **INCONSISTENT** - Some routes validate, others don't

**Good Examples**:
- `app/api/admin/modules/create/route.ts`:
  - ✅ Validates `module_code` format (`MODULE_[A-Z0-9_]+`)
  - ✅ Validates `title` is non-empty string
  - ✅ Checks for duplicate `module_code`

- `app/api/admin/modules/import/route.ts`:
  - ✅ Uses `lintModuleImport()` for comprehensive validation

**Missing Validation**:
- Many routes accept URL parameters without validation
- Example: `app/api/admin/modules/[moduleCode]/sources/route.ts`:
  - Only does `decodeURIComponent(moduleCode).trim()` - no format validation
  - Could accept malicious input that passes through to database

**Recommendations**:
- Add input validation middleware for common patterns (UUIDs, module codes, etc.)
- Validate all user inputs before database queries
- Use Zod or similar for request validation
- Sanitize URL parameters (module codes, IDs, etc.)

### 4. Database Connection Management

**Status**: ✅ **GOOD** - Using connection pools correctly

**Findings**:
- Routes use `getRuntimePool()` and `getCorpusPool()` - ✅ Good
- Most routes use pool.query() directly - ✅ Correct
- Some routes use `pool.connect()` for transactions - ✅ Correct pattern

**Example** (`app/api/admin/modules/create/route.ts`):
```typescript
const client = await runtimePool.connect();
try {
  await client.query("BEGIN");
  // ... operations
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release(); // ✅ Always released
}
```

**Recommendation**: Continue this pattern. Consider adding connection timeout handling.

### 5. Response Formatting

**Status**: ⚠️ **INCONSISTENT** - Multiple response formats

**Formats Found**:
1. `{ error: string, message?: string }` - Error responses
2. `{ ok: boolean, result?: T, error?: string }` - Some routes (import, etc.)
3. Direct data objects - Most GET routes
4. `{ questions: [], total: number, metadata: {} }` - Questions endpoint

**Recommendation**: Standardize response format:
```typescript
// Success
{ data: T, meta?: { total?: number, ... } }

// Error
{ error: { message: string, code?: string } }
```

### 6. Type Safety

**Status**: ⚠️ **MIXED** - Some routes use `any` extensively

**Issues**:
- Many routes use `any` for database row types: `sources.rows.map((r: any) => ...)`
- Request body types often inferred: `const body = await req.json()`
- Response types not always defined

**Recommendations**:
- Define TypeScript interfaces for database rows
- Use type guards for request validation
- Define response types explicitly
- Consider using `zod` for runtime type validation

### 7. Authentication & Authorization

**Status**: ⚠️ **PARTIAL** - Some security checks exist, but incomplete

**Findings**:
- **Security Mode Checks**: Some routes use `getSecurityMode()` and `canPerformDecision()` 
  - Example: `app/api/ofc/nominations/[nomination_id]/decide/route.ts`
  - ✅ Good: Role-based permission checks
  - ⚠️ Limited: Only applies to specific operations, not all routes

- **No Global Authentication**: No authentication middleware found across routes
- **No Authorization Checks**: Most routes don't verify user permissions

**Risk**: 
- Admin routes are publicly accessible
- Data modification endpoints unprotected
- No user identity verification

**⚠️ DECISION**: **DEFERRED** - Authentication/authorization middleware implementation is acknowledged as CRITICAL but will be addressed **after proof of concept design is finished**.

**Recommendations** (for post-POC implementation):
- Implement global authentication middleware
- Add role-based access control (RBAC) for all admin routes
- Protect sensitive endpoints (module creation, data modification, file uploads)
- Verify user identity before allowing operations
- Add rate limiting for public endpoints

**Note**: This is acceptable for proof of concept phase, but **MUST be implemented before production deployment**.

### 8. Rate Limiting

**Status**: ❌ **MISSING**

**Recommendation**: Implement rate limiting, especially for:
- POST/PUT/DELETE endpoints
- Admin endpoints
- Data-intensive GET endpoints

### 9. CORS Configuration

**Status**: ⚠️ **UNKNOWN** - Not visible in route files

**Recommendation**: Verify CORS is configured at Next.js level. Ensure admin routes are not exposed to cross-origin requests.

### 10. Request Size Limits

**Status**: ⚠️ **UNKNOWN** - No explicit limits found

**Risk**: Large file uploads or JSON payloads could cause DoS.

**Recommendation**: Add request size limits, especially for:
- File upload endpoints (`/api/admin/source-registry/upload`)
- Module import endpoint (`/api/admin/modules/import`)
- Bulk operations

### 11. File System Operations

**Status**: ⚠️ **MODERATE RISK** - Some routes access file system

**Findings**:
- **File Upload**: `app/api/admin/source-registry/upload/route.ts`
  - ✅ Uses `tmpdir()` and `randomUUID()` for temp files - Good
  - ✅ Validates file type
  - ⚠️ No explicit file size limit check
  - ⚠️ No path traversal protection (though mitigated by using `tmpdir()`)

- **File Reading**: Several routes read JSON files
  - `app/api/runtime/assessments/[assessmentId]/questions/route.ts` reads `baseline_depth2_questions.json`
  - ✅ Uses hardcoded paths - Safe
  - ⚠️ No validation that file exists before reading
  - ⚠️ No error handling for file read failures

**Recommendations**:
- Add explicit file size limits for uploads
- Validate file paths (prevent path traversal)
- Add error handling for file operations
- Consider using a dedicated file storage service (S3, etc.) instead of local filesystem

## Route-Specific Issues

### High Priority

1. **`app/api/runtime/assessments/[assessmentId]/questions/route.ts`**
   - ⚠️ Exposes detailed error information (stack traces, constraint names)
   - ⚠️ Silent error handling (continues with empty results)
   - ⚠️ Complex query building could be refactored
   - ⚠️ Reads JSON files from filesystem without validation
   - ⚠️ No authentication/authorization checks

2. **`app/api/admin/modules/[moduleCode]/sources/route.ts`**
   - ⚠️ No input validation on `moduleCode` parameter
   - ⚠️ No authentication/authorization checks
   - ✅ Good: Uses parameterized queries
   - ✅ Good: Proper error handling

3. **`app/api/admin/modules/create/route.ts`**
   - ⚠️ No authentication/authorization checks
   - ✅ Good: Input validation
   - ✅ Good: Transaction handling
   - ✅ Good: Duplicate checking

4. **`app/api/admin/source-registry/upload/route.ts`**
   - ⚠️ No authentication/authorization checks
   - ⚠️ No explicit file size limit
   - ✅ Good: Uses temp directory with UUID
   - ✅ Good: Validates file type
   - ✅ Good: Cleans up temp files in finally block

5. **`app/api/ofc/nominations/[nomination_id]/decide/route.ts`**
   - ✅ Good: Has security mode checks (`canPerformDecision`)
   - ✅ Good: Validates input (decision type, role)
   - ⚠️ No user authentication (relies on `decided_by` in body)
   - ⚠️ No verification that `decided_by` matches authenticated user

### Medium Priority

6. **`app/api/admin/modules/import/route.ts`**
   - ⚠️ No authentication/authorization checks
   - ✅ Good: Uses linter for validation
   - ⚠️ Error message parsing could be improved
   - ⚠️ No request size limit

7. **Routes with file system access**:
   - `app/api/runtime/assessments/[assessmentId]/questions/route.ts` reads JSON files
   - ⚠️ No validation that file exists or is readable
   - ⚠️ Path traversal risk (though mitigated by hardcoded paths)
   - ⚠️ No error handling for file read failures

8. **`app/api/admin/modules/[moduleCode]/route.ts`**
   - ⚠️ No authentication/authorization checks
   - ⚠️ Dynamic column selection (could be optimized)
   - ✅ Good: Uses parameterized queries
   - ✅ Good: Handles missing columns gracefully

## Recommendations Summary

### Immediate Actions (Critical)

1. **Add Authentication/Authorization** ⚠️ **DEFERRED UNTIL POST-POC**
   - Status: Acknowledged as CRITICAL, deferred until after proof of concept design is finished
   - Implement auth middleware
   - Protect admin routes
   - Add role checks
   - **MUST be completed before production deployment**

2. **Fix Error Information Leakage**
   - Remove stack traces from production responses
   - Standardize error format
   - Log detailed errors server-side only

3. **Add Input Validation**
   - Validate all URL parameters
   - Validate request bodies
   - Use validation library (Zod)

### Short-term (High Priority)

4. **Standardize Response Formats**
   - Create response utility functions
   - Use consistent error/success formats

5. **Improve Type Safety**
   - Define interfaces for database rows
   - Type request/response bodies
   - Reduce `any` usage

6. **Add Rate Limiting**
   - Implement for all endpoints
   - Stricter limits for admin routes

### Long-term (Medium Priority)

7. **Add Request Size Limits**
   - Configure Next.js body size limits
   - Add validation for large payloads

8. **Refactor Complex Routes**
   - Extract query building logic
   - Use query builder library
   - Improve error handling patterns

9. **Add API Documentation**
   - Document all endpoints
   - Include request/response examples
   - Document error codes

10. **Add Monitoring & Logging**
    - Structured logging
    - Error tracking (Sentry, etc.)
    - Performance monitoring

## Testing Recommendations

1. **Security Testing**
   - SQL injection tests
   - Input validation tests
   - Authentication bypass tests

2. **Error Handling Tests**
   - Test error paths
   - Verify error messages don't leak info
   - Test database connection failures

3. **Integration Tests**
   - Test full request/response cycles
   - Test with invalid inputs
   - Test edge cases

## Conclusion

The API routes show **good security practices** in database query handling (parameterized queries) but have **inconsistencies** in error handling, input validation, and **critical gaps** in authentication/authorization.

**Overall Security Rating**: ⚠️ **MODERATE-HIGH RISK**

**Key Strengths**:
- ✅ Parameterized SQL queries (prevents SQL injection)
- ✅ Good database connection pool management
- ✅ Some routes have input validation
- ✅ Some routes have security mode checks

**Key Weaknesses**:
- ❌ No global authentication/authorization
- ⚠️ Error information leakage
- ⚠️ Inconsistent input validation
- ⚠️ File upload security gaps

**Priority Actions**:
1. **CRITICAL** ⚠️ **DEFERRED**: Implement authentication/authorization middleware (deferred until post-POC)
2. **HIGH**: Fix error information leakage (remove stack traces from production)
3. **HIGH**: Add comprehensive input validation
4. **MEDIUM**: Standardize error handling patterns
5. **MEDIUM**: Add file upload size limits and validation
6. **MEDIUM**: Add rate limiting

**Note**: Authentication/authorization is acknowledged as CRITICAL but deferred until after proof of concept design phase. This is acceptable for POC but must be implemented before production deployment.
