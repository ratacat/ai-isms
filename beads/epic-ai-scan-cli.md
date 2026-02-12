# Epic: ai-isms Scan CLI and Pipeline Features

## Why

The product needs a scanning path for text, not just taxonomy validation.  
The CLI should be optimized for AI agents and automation where the primary action is:

- ingest text
- return dense AIism signal
- support high-volume/automated workflows
- keep output compact and parseable

## Vision

Default output should be machine-friendly when needed (auto for non-TTY), but still lightweight for humans.

## Scope (Phase 1)

- `scan` as the primary command
- scanning from stdin/file/path
- token-efficient, structured JSON responses
- deterministic `fingerprint` option
- minimal, actionable signal fields for automation and review

## Success criteria

- Agents can run a one-liner scan against text
- Batch/corpus workflows can call CLI repeatedly or via stdin
- Duplicate content can be recognized by fingerprint
- Noisy pipelines get concise `quiet` and `threshold` control
- `delta` comparisons can measure edit impact
- Validation remains available

## Non-goals (phase 1)

- full rewrite suggestions as separate commands
- language-specific detectors
- native model/LLM-specific fingerprinting

