# Performance Test Plan

Describes the methodology and metrics for performance testing the Asset Dependency Assessment Tool.

## Goals

- Validate that the application meets response time SLAs under expected load.
- Ensure stability and resource utilization remain within acceptable limits during sustained usage.

## Scope

- Web assessment UI (Next.js app).
- Assessment import/export workflows.
- Dependency visualization endpoints.

## Non-scope

- Desktop or Tauri builds (deprecated).
- Legacy VOFC scripts not used in production.

## Test Environment

- Node.js 18 LTS runtime.
- Deploy to staging environment mirroring production configuration.
- Use seeded dataset representing medium complexity assessment (approx. 50 services).

## Tools

- `k6` for HTTP and WebSocket load testing.
- Browser automation (Playwright) for end-to-end interaction timing.
- Prometheus/Grafana for monitoring resource metrics where available.

## Test Scenarios

1. **Concurrent assessors**
   - 50 virtual users editing assessments simultaneously.
   - Measure median and 95th percentile response times for autosave API calls.
2. **Report generation burst**
   - Trigger 20 report exports concurrently.
   - Monitor memory usage and completion time.
3. **VOFC ingestion**
   - Upload large VOFC dataset (1000 dependencies).
   - Validate processing completes within target window (<2 minutes).

## Metrics

- Response time (ms) per API endpoint.
- Error rate (% of requests failing).
- CPU and memory utilization on host/container.
- Throughput (requests per second).

## Acceptance Criteria

- p95 response time < 500 ms for core assessment APIs.
- Error rate < 1% under load.
- No memory leaks; RSS stable within 20% of baseline.

## Reporting

- Summaries stored in `docs/performance/` (future location).
- Include raw test data, charts, and interpretation.
- Capture regressions and remediation steps.

## Schedule

- Baseline test: prior to major release.
- Regression test: post release candidate build.
- Ad-hoc runs after significant backend changes.

## Risks & Mitigations

- **Risk:** Staging data stale or incomplete → **Mitigation:** Refresh seed data before tests.
- **Risk:** Environment drift between staging and production → **Mitigation:** Automate infrastructure provisioning.
