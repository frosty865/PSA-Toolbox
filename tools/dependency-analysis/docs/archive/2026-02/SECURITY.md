# Security Guidelines

Security practices for the Asset Dependency Assessment Tool. This version is archived; see updated guidance in docs/security/README.md (or current location).

## Principles

- Least privilege for data access.
- Defense in depth across application layers.
- Secure defaults for configuration and deployments.

## Application Security

- Keep dependencies updated via scheduled `pnpm audit` and Renovate PRs.
- Enforce TypeScript strict mode to catch unsafe patterns.
- Validate all user inputs using Zod schemas.
- Sanitize content rendered in the browser (no direct HTML injection).

## Secrets Management

- Do not commit secrets to the repository.
- Use environment variables or secret management service (Azure Key Vault, AWS Secrets Manager, etc.).
- Rotate keys per organizational policy.

## Authentication & Authorization

- Rely on SSO (Azure AD, Okta, etc.) when deployed in enterprise environments.
- Restrict administrative features to authorized roles.

## Data Protection

- Encrypt data at rest where possible (database, storage accounts).
- Ensure transport security (HTTPS).
- Anonymize or pseudonymize sensitive data in logs.

## Logging & Monitoring

- Collect audit events for critical operations (assessment export, data import).
- Monitor for unusual activity (multiple failed logins, large exports).
- Retain logs per retention policy, with secure storage.

## Incident Response

- Maintain escalation playbook.
- Document contact info for security response team.
- Run tabletop exercises annually.

## Dependencies

- Maintain SBOM for releases.
- Evaluate third-party packages for known vulnerabilities.

## QA Checklist

- [ ] Security review completed for new features.
- [ ] Dependency scanning reports reviewed.
- [ ] Penetration test findings addressed before release.

## References

- OWASP ASVS (Application Security Verification Standard)
- NIST SP 800-53
- CIS Controls
