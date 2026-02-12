# Feature: Scan Fingerprint

## Purpose

Provide a stable, short signature for scan outputs so pipelines can deduplicate and cache by content/result signature.

## Proposed behavior

- Flag: `--fingerprint` on `scan`
- Computed deterministically from stable fields:
  - input length bucket
  - matched rule IDs sorted
  - match counts by rule/category
  - density band
  - optional text hash salt version
- Output:
  - `fingerprint` string in scan result
  - short fixed-width token (for logs)

## Why it helps

- avoids reprocessing same text
- enables “same text seen before” optimization
- supports batch pipelines and moderation queues
- easy joins across different sources

## Constraints

- must be deterministic
- must not leak raw text
- avoid unstable metadata (timestamps, file paths, absolute positions if using truncation)

