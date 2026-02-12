# Feature: Evidence Offsets (Default in JSON)

## Purpose

Give precise matches for explainability and annotation tooling.

## Behavior

- Every match includes:
  - `start_char`
  - `end_char`
  - short `matched_text`
  - `rule_id`
  - `weight`
- Offsets should be UTF-16 index or byte/char? (Decide explicitly; default to char index)

## Notes

- Keep output token-efficient by trimming matched text to short span.
- Include snippet only when JSON or `--evidence` mode.
- Avoid including in default quiet mode.

