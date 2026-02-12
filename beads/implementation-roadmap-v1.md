# Roadmap: Scan-First CLI (v1)

## Phase 1 (immediate)

1. Implement `scan` core modes:
   - stdin
   - `--file`
   - `--path` (single)
2. Add `--json`, auto JSON on pipes, structured errors
3. Add `--threshold`, `--quiet`, `--top-matches`
4. Add evidence fields for each match (start/end/text)
5. Add `--fingerprint`
6. Add `--before/--after` delta output
7. Add `batch` for multi-input automation

## Phase 2

1. JSONL stream mode for batch feeds
2. `gate` subcommand with policy presets
3. cache-aware fingerprint index integration
4. confidence calibration improvements

## Phase 3

1. score explanations + compact "top-matching profile"
2. confidence interval style metadata
3. optional language-aware enhancements (deferred)

