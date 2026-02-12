# Feature: Top Matches

## Purpose

Limit match noise by returning the highest-signal rules first.

## Behavior

- Flag: `--top-matches <n>` (default: 5 or 10)
- Sort by:
  1) rule weight
  2) match count
  3) match span order
- Return at most `n` matches in JSON `matched_rules`
- Human output prints top matches by label only

## Why

- Supports triage at scale
- Reduces token usage and cognitive load for large texts

