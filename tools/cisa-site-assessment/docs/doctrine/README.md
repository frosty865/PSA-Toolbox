# Doctrine Directory

## Purpose

This directory contains **read-only references** to doctrine (taxonomy, required elements, rules) that are authoritative in `psa_engine`.

## What Belongs Here

### docs/doctrine/taxonomy/
- **Read-only snapshots** of taxonomy from `psa_engine`
- Taxonomy reference files for UI display
- **NOT allowed**: Modifications to taxonomy, new taxonomy definitions

### docs/doctrine/required_elements/
- **Read-only references** to required element sets from `psa_engine`
- Snapshot files for UI display purposes
- **NOT allowed**: New required elements, modifications to existing elements

### docs/doctrine/rules/
- **Read-only references** to doctrine rules from `psa_engine`
- Rule documentation for UI display context
- **NOT allowed**: New rules, modifications to existing rules

## Authority

**psa-rebuild is NOT authoritative for doctrine content.**

All doctrine is authoritative in `psa_engine`. Files in this directory are:
- Read-only references
- Snapshots for UI display
- Historical context (if moved from elsewhere)

## Classification

- **Type**: Read-only reference
- **Authority**: `psa_engine`
- **Modifiable**: No
- **Purpose**: Reference for UI display only

---

**See `../AUTHORITY.md` for full authority boundaries.**

