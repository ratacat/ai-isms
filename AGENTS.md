# AGENTS.md

## Project Mission
Build a fast, explainable text scanner that identifies and reports AIisms.

## Product Intent
Input: a block of text.
Output: a concise report that says how many AIisms were found and what they are.

## Definition: AIism
An AIism is language syntax, word choice, or rhetorical structure that is strongly associated with AI-generated text.

## Working Detection Model
Use a hybrid, explainable approach for v1:
1. Weighted phrase lexicon for common AI-ish wording.
2. Pattern detectors for repetitive structures.
3. Style heuristics (hedging, filler transitions, generic abstraction).
4. Aggregate score mapped to density labels.

## Reporting Requirements
Each report should include:
- Total AIism count.
- Matched phrases/patterns.
- Definition of each AIism category.
- A short confidence estimate.

## Engineering Principles
- Keep detection fast and deterministic in v1.
- Favor explainability over model complexity.
- Avoid over-flagging by requiring weighted evidence.
- Make definitions user-readable, not purely technical.
- Use no AI API calls in this detector. It must be all code.
- Use TypeScript as the primary implementation language.

## Taxonomy Source Of Truth
- Canonical taxonomy data: `taxonomy/taxonomy.yml`
- Taxonomy schema directory: `taxonomy/schemas/`
- Rule-type schemas: `taxonomy/schemas/rules/`

## Near-Term Roadmap
1. Create a seed lexicon and category definitions.
2. Implement parser + scorer + reporter pipeline.
3. Add test fixtures: obvious AI text, obvious human text, mixed text.
4. Tune thresholds based on false positives/negatives.

## Terminology Aliases
Other terms people use instead of "AIisms":
- `AI tells` / `tell words`
- `giveaways`, `markers`, `indicators`, `hallmarks`
- `ChatGPT speak`
- `GPT prose style`
- `AI writing style`
- `AI-ese`
- `LLMish`
- `ChatGPT clichés`
- `slop words` / `crutch phrases` (in LLM communities)
- `AI slop` (broader term, often quality/political, not only syntax)

## Reference Threads
Reddit threads with concrete examples and discussion:
- https://www.reddit.com/r/OpenAI/comments/1cdo36l/whats_your_personal_tell_word_to_identify/
- https://www.reddit.com/r/writingcirclejerk/comments/1ml3lts/what_are_the_aiisms_that_always_give_away_bad/
- https://www.reddit.com/r/NoStupidQuestions/comments/1qm903k/how_do_you_tell_when_something_was_written_by_ai/
- https://www.reddit.com/r/youtube/comments/1qogvdb/chatgpt_speak_is_ruining_youtube_scripts/
- https://www.reddit.com/r/grammar/comments/1pyejvz/is_anyone_avoiding_the_em_dash_because_it_has/
- https://www.reddit.com/r/ChatGPT/comments/1hgg26t
- https://www.reddit.com/r/ChatGPT/comments/1nkuiah
- https://www.reddit.com/r/aiwars/comments/1kn35w2/what_does_ai_slop_mean_exactly/
- https://www.reddit.com/r/SillyTavernAI/comments/1nz0a4p

Canonical reference list: `references/reddit-ai-ism-threads.md`
