# Epic: Handbook Chapter AIism Audit and Detector Tuning

## Goal
- Audit each handbook chapter with deterministic scan plus manual AI scan.
- Identify misses, false positives, and new AIisms.
- Improve taxonomy and scanner logic chapter-by-chapter.

## Chapters / Beads
- `beads/chapter-01-foundations-audit.md`
- `beads/chapter-02-order-book-audit.md`
- `beads/chapter-03-footprint-audit.md`
- `beads/chapter-04-cvd-audit.md`
- `beads/chapter-05-tape-reading-audit.md`
- `beads/chapter-06-oi-funding-audit.md`
- `beads/chapter-07-liquidations-audit.md`
- `beads/chapter-08-volume-profile-audit.md`
- `beads/chapter-09-risk-management-audit.md`
- `beads/chapter-10-confluence-audit.md`

## Global Workflow Rules
1. Work one chapter bead at a time in order.
2. Run deterministic scan first, then manual AI scan.
3. Post a bead comment report with:
- taxonomy items present but missed by deterministic scan
- deterministic hits not confirmed by manual scan
- new AIisms to add
4. Investigate code/taxonomy root causes for misses.
5. Implement fixes in code and/or taxonomy.
6. Re-run scan and include before/after delta in bead comment.
7. Commit chapter-specific changes, then move to the next bead.

## Shared Files To Inspect During Root Cause Analysis
- `taxonomy/taxonomy.yml`
- `src/scan/scanner.ts`
- `src/scan/types.ts`
- `bin/cli.ts`

