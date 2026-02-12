# Bead: Chapter 07 Liquidations AIism Audit

## Parent Epic
- `beads/epic-handbook-chapter-audit.md`

## Chapter
- `/Users/jaredsmith/Projects/x-woodchipdaddy/handbook/chapters/07-liquidations.md`

## Required Workflow
1. Deterministic scan first.
- Run: `aism scan --json --file /Users/jaredsmith/Projects/x-woodchipdaddy/handbook/chapters/07-liquidations.md --top-matches 300`
2. Manual AI scan second.
- Read the chapter carefully end-to-end.
- Identify taxonomy-defined AIisms present in text.
- Identify suspicious AIisms not in taxonomy.
3. Post bead comment report with both:
- taxonomy items present in chapter but missed by deterministic scan
- new AIisms that should be added
4. Also include in the same bead comment:
- deterministic hits not confirmed by manual scan (false positives)
- line references and snippets for evidence
5. Root-cause analysis in code and taxonomy.
- Inspect `taxonomy/taxonomy.yml`, `src/scan/scanner.ts`, `src/scan/types.ts`, `bin/cli.ts`.
- Explain why targets were missed or overfired.
6. Implement fixes.
- Update taxonomy rules and/or scanner logic for better capture.
- Keep behavior deterministic and explainable.
7. Re-run scan and report before/after delta in bead comment.
8. Commit changes, then move to the next chapter bead.

