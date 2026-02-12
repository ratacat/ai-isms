# Handbook Manual vs Automated AIism Audit

Date: 2026-02-12
Scope: `/Users/jaredsmith/Projects/x-woodchipdaddy/handbook/chapters/01-10`
Method:
- Run deterministic scan with `aism scan --json --file <chapter>`.
- Manually review chapter prose and compare with scanner hits.
- Annotate likely true positives (TP), likely false positives (FP), and likely misses.

Note: This is a pragmatic manual annotation pass for tuning priorities, not a fully adjudicated gold dataset yet.

## Aggregate observations

- Scanner consistently catches the strongest rhetorical templates (`template.not_x_its_y`, `template.when_when_didactic`) where phrasing is explicit.
- Strong overfire risk appears in domain-heavy terms:
  - `phrase.action_verb_inflation` is dominated by `leverage` in trading context.
  - `scaffold.key_takeaways` maps almost entirely to editorial `Key Insight` headings.
  - `tone.certainty_softener` is mostly single-token `often`.
- Structural uniformity rules added recently never fired in these chapters:
  - `format.paragraph_uniformity`
  - `format.sentence_uniformity`
- One duplicate same-span hit was observed in chapter 08:
  - `template.not_x_its_y@27240-27288` appears twice.

## Per-chapter annotations

### 01 Foundations
- Automated: `density=high`, `aiism_score=13.84`, `aiism_ratio=1.4`, `total=44`.
- Likely TP:
  - Repeated didactic contrast framing (`not X, it is Y`).
  - Mirrored `when ... when ...` teaching structure.
- Likely FP:
  - `phrase.action_verb_inflation` over-indexes on domain word `leverage`.
  - Single `tone.certainty_softener` (`typically`) is weak evidence by itself.
- Likely misses:
  - Additional `when ... when ...` structures not captured, e.g. `01-foundations.md:73`, `01-foundations.md:89`.
  - Additional `not ... but ...` contrast forms not captured, e.g. `01-foundations.md:125`.

### 02 Order Book
- Automated: `density=moderate`, `aiism_score=5.33`, `aiism_ratio=0.55`, `total=22`.
- Likely TP:
  - Good capture of explicit mirrored didactic sentences, e.g. `02-order-book.md:43`, `02-order-book.md:160`.
  - Repeated scaffolding heading `Key Insight`.
- Likely FP:
  - `phrase.action_verb_inflation` likely inflated by domain usage rather than AI style signal.
- Likely misses:
  - Contrast structure in prose not caught by `template.not_x_but_y`, e.g. `02-order-book.md:5`.

### 03 Footprint
- Automated: `density=moderate`, `aiism_score=4.25`, `aiism_ratio=0.39`, `total=12`.
- Likely TP:
  - Strong scaffolding pattern repetition (`Key Insight`).
- Likely FP:
  - `format.heading_density` and `format.bold_italic_noise` are likely handbook-format effects.
- Likely misses:
  - Contrast framing form not captured, e.g. `03-footprint.md:7`.

### 04 CVD
- Automated: `density=moderate`, `aiism_score=7.98`, `aiism_ratio=0.9`, `total=40`.
- Likely TP:
  - Consistent didactic scaffolding and structured rhetorical mirrors.
- Likely FP:
  - Heavy `phrase.action_verb_inflation`/`tone.certainty_softener` contribution may overstate AI-ishness.
- Likely misses:
  - `not ... but ...` conceptual contrast forms not captured, e.g. `04-cvd.md:314`.

### 05 Tape Reading
- Automated: `density=moderate`, `aiism_score=4.97`, `aiism_ratio=0.47`, `total=18`.
- Likely TP:
  - `Key Insight` and didactic pair framing where explicit.
- Likely FP:
  - Formatting-tell hits may reflect style guide rather than AI generation.
- Likely misses:
  - `Not because ... but because ...` framing not captured, e.g. `05-tape-reading.md:155`.

### 06 OI Funding
- Automated: `density=high`, `aiism_score=8.6`, `aiism_ratio=0.94`, `total=45`.
- Likely TP:
  - Solid detection of repeated didactic and contrast templates.
- Likely FP:
  - `action_verb_inflation` inflated by domain-specific `leverage` frequency.
- Likely misses:
  - Additional contrast phrasing not captured, e.g. `06-oi-funding.md:149`.
  - Multiple `when ... when ...` forms not all captured, e.g. `06-oi-funding.md:45`.

### 07 Liquidations
- Automated: `density=high`, `aiism_score=9.28`, `aiism_ratio=0.74`, `total=34`.
- Likely TP:
  - High concentration of explicit contrast-template language appears valid.
- Likely FP:
  - `Key Insight` heading reuse contributes scaffold weight with low discriminative value in handbook context.
- Likely misses:
  - `when ... when ...` mirror appears in prose but did not trigger, e.g. `07-liquidations.md:296`.

### 08 Volume Profile
- Automated: `density=moderate`, `aiism_score=6.64`, `aiism_ratio=0.59`, `total=28`.
- Likely TP:
  - Valid detection of repeated didactic `when ... when ...` sections.
- Likely FP:
  - Duplicate same-span regex hit inflates count (`template.not_x_its_y`).
- Likely misses:
  - `not ... but ...` contrast form not captured, e.g. `08-volume-profile.md:241`.

### 09 Risk Management
- Automated: `density=high`, `aiism_score=10.18`, `aiism_ratio=0.94`, `total=32`.
- Likely TP:
  - `not X, it is Y` framing appears often and is correctly detected.
- Likely FP:
  - `action_verb_inflation` + `certainty_softener` likely over-contribute in instructional prose.
- Likely misses:
  - Additional contrast and mirror structures not captured, e.g. `09-risk-management.md:33`, `09-risk-management.md:232`.

### 10 Confluence
- Automated: `density=moderate`, `aiism_score=6.91`, `aiism_ratio=0.57`, `total=29`.
- Likely TP:
  - Repeated contrast-template language and scaffold structure are correctly detected.
- Likely FP:
  - Residual action-verb hits likely mixed signal in domain context.
- Likely misses:
  - Missed long-span `when ... when ...` framing, e.g. `10-confluence.md:494`.
  - Missed `not ... but ...` contrast forms, e.g. `10-confluence.md:157`.

## Tuning priorities derived from manual pass

1. De-bias domain term overfire in `phrase.action_verb_inflation`.
2. Reduce discriminative weight of editorial `Key Insight` scaffolding in handbook docs.
3. Upgrade `tone.certainty_softener` from single-token triggers to stacked/clustered evidence.
4. Expand regex coverage for `not ... but ...` and long-span `when ... when ...`.
5. Add dedupe guard for identical `(rule_id, start_char, end_char)` matches.
6. Add fixture-backed regression set using this audit as seed labels.
