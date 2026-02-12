# Feature: Batch Scan

## Purpose

Scan many texts/files in automation contexts.

## Proposed command options

- `aism batch <path|glob|file-list>` 
- `--format json` (default compact JSON lines)
- `--quiet`
- `--parallel <n>` (future)

## Input

- Directory or file list
- Optional glob patterns
- Input can be plain text files; extension filtering optional

## Output

- One JSON object per line:
  - `ok`, `path`, `result`, `error` (if failed)
- Aggregate footer summary:
  - processed, succeeded, failed, flagged_count

## Failure policy

- per-item failure does not abort full batch by default
- optional `--fail-fast` in future iteration

