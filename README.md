# aiisms

A lightweight tool that scans text for likely "AIisms" and reports what it found.

## Goal

Given a block of text, the tool should:
1. Detect patterns that feel overtly AI-generated.
2. Count how many AIisms appear.
3. Return a readable report with matched phrases and definitions.

Example summary:
- "Detected 6 AIisms"

## What we mean by AIisms

AIisms are language patterns that are unusually common in model-generated writing, including:
- overused transition phrases
- verbose boilerplate framing
- hedging or certainty disclaimers used unnaturally
- repetitive sentence structures
- generic, non-committal wording

## Initial detection model (v1)

Start with a hybrid scoring approach:
1. Phrase lexicon: weighted list of common AI-ish phrases.
2. Structural patterns: regex checks for repeated templates.
3. Stylistic signals: counts of hedge words, stacked qualifiers, and repetitive transitions.
4. Score + threshold: classify text as low/moderate/high AIism density.

This keeps v1 fast and explainable. Later versions can add an ML classifier.

## Proposed output format

- `total_ai_isms`: integer
- `matches`: list of matched phrases/patterns
- `definitions`: brief explanation for each match
- `density`: low | moderate | high
- `aiism_score`: non-negative number (length-normalized weighted AIism intensity)
- `aiism_ratio`: detected AIisms per 100 words

## Next steps

1. Build a small baseline lexicon and weighted rules.
2. Implement a simple CLI (`stdin` or file input).
3. Add fixture texts and expected reports.
4. Tune thresholds against real examples.

## Validate taxonomy

Run:

```bash
npm run validate:taxonomy
```

Or validate a custom file:

```bash
npm run validate:taxonomy -- path/to/taxonomy.yml
```
