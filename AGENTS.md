# AGENTS.md

## Project Mission
Build a fast, explainable text scanner that identifies and reports AI-isms.

## Product Intent
Input: a block of text.
Output: a concise report that says how many AI-isms were found and what they are.

## Definition: AI-ism
An AI-ism is language syntax, word choice, or rhetorical structure that is strongly associated with AI-generated text.

## Working Detection Model
Use a hybrid, explainable approach for v1:
1. Weighted phrase lexicon for common AI-ish wording.
2. Pattern detectors for repetitive structures.
3. Style heuristics (hedging, filler transitions, generic abstraction).
4. Aggregate score mapped to density labels.

## Reporting Requirements
Each report should include:
- Total AI-ism count.
- Matched phrases/patterns.
- Definition of each AI-ism category.
- A short confidence estimate.

## Engineering Principles
- Keep detection fast and deterministic in v1.
- Favor explainability over model complexity.
- Avoid over-flagging by requiring weighted evidence.
- Make definitions user-readable, not purely technical.

## Near-Term Roadmap
1. Create a seed lexicon and category definitions.
2. Implement parser + scorer + reporter pipeline.
3. Add test fixtures: obvious AI text, obvious human text, mixed text.
4. Tune thresholds based on false positives/negatives.
