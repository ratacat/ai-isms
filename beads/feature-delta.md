# Feature: Delta Scan (`--before/--after`)

## Purpose

Compare two versions of text and report AIism drift to measure rewriting impact.

## Behavior

- `aism scan --before <path_or_text> --after <path_or_text>`
- Computes independent scans for both inputs, then:
  - before_total_aiisms
  - after_total_aiisms
  - delta = after - before
  - density_before / density_after / density_delta
- Optional `--before-label` and `--after-label` for report readability

## Output fields

- `delta`: numeric and signed
- `changed_rules`: list of added/removed rule hits
- `net_direction`: `"down" | "up" | "flat"`

## Use

- human-assisted rewrite loops
- review gates (“did rewriting reduce AIism risk?”)

