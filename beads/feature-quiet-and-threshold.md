# Feature: Quiet Mode + Threshold Controls

## Purpose

Optimize scan output for automation and scripts.

## Quiet

- Flag: `--quiet`
- Human output: compact one-line summary or suppressed details
- JSON output: same object shape as normal scan (no extra verbose fields)

## Threshold

- Flag: `--threshold <low|moderate|high|0-100>` (initially map to density bands + optional numeric override)
- Used for:
  - quick gating
  - CI decisions
  - triage confidence tiers

## Behavior

- Density remains computed from taxonomy rules.
- If threshold is numeric, score must meet/exceed threshold to be flagged as positive.
- Return `pass` boolean in response for easier gating.

