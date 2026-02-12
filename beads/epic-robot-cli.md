# Epic: Robot Mode CLI

## Objectives
- Fast, token-efficient binary interface for AI agents.
- Machine-consumable output by default when non-interactive.
- Predictable error contract and exit codes.

## Requirements mapped
- JSON output: `--json` supported on all commands.
- Quick start: no-arg help is minimal and concise.
- Structured errors: `code`, `message`, `suggestions`.
- TTY detection: auto-JSON when piped.
- Exit codes: 0/1/2/3/4 mapping.
- Token efficiency: compact success strings and short fields.

## Command behavior
- `validate [taxonomyPath]`
- `version`
- `help [command]`

## Files touched
- `bin/cli.ts`
- `package.json` (`bin` and scripts)
- `beads/epic-robot-cli.md`
