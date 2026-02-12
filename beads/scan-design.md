# Bead: Scan Command Design

## Command

- `scan`

## Core behavior

- Input modes:
  - `aism scan --text "<raw text>"`
  - `aism scan --file <path>`
  - `aism scan --path <file|dir>`
  - `aism scan` (reads stdin)
- One command can serve interactive and pipeline usage.

## Output contract (JSON focus)

Top-level response:
- `ok`: boolean
- `command`: `"scan"`
- `json`: boolean
- `exit_code`: number
- `scan_id` optional
- `result`:
  - `total_aiisms`
  - `density`
  - `confidence`
  - `matched_rules` array
  - `category_breakdown` map or array

`matched_rules` item:
- `rule_id`
- `category_id`
- `label`
- `weight`
- `start_char`
- `end_char`
- `matched_text` (short snippet)

### Error contract (reuse)

- `error`: `{ code, message, suggestions[] }`
- exit codes:
  - `0` success
  - `1` not found / missing resource
  - `2` invalid args
  - `3` validation failed
  - `4` runtime

## Flags

- `--json` enforce JSON response
- `--quiet` minimize human output
- `--threshold <low|moderate|high|number>` set cutoff band/number
- `--top-matches <n>` return strongest n rule matches per scan
- `--before` and `--after` for delta mode inputs
- `--fingerprint` compute deterministic result fingerprint
- `--quiet` for short one-line human result

## Auto behavior

- If stdout is piped/non-TTY, auto JSON response.
- default human output must remain short.

