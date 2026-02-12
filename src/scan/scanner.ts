import crypto from "node:crypto";
import { TaxonomyRule, TaxonomyCategory, ScanOptions, ScanResult, ScanRuleMatch, CategoryBreakdown, DensityBand, Taxonomy, TaxonomyAggregation, TaxonomyThresholds } from "./types.js";

function toStringSafe(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, "\n");
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, score);
}

const CERTAINTY_SOFTENER_RULE_ID = "tone.certainty_softener";
const CERTAINTY_SOFTENER_WINDOW_CHARS = 220;
const CERTAINTY_SOFTENER_MIN_MATCHES = 2;
const STRUCTURAL_RATIO_WEIGHT_MULTIPLIER = 0.75;
const UNIFORMITY_WEIGHT_MULTIPLIER = 0.6;

function scoringMultiplierForRule(rule: TaxonomyRule): number {
  if (rule.match_type !== "structural_ratio") {
    return 1;
  }

  if (rule.metric === "paragraph_length_inv_cv" || rule.metric === "sentence_length_inv_cv") {
    return UNIFORMITY_WEIGHT_MULTIPLIER;
  }

  return STRUCTURAL_RATIO_WEIGHT_MULTIPLIER;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function lines(text: string): string[] {
  return text.length === 0 ? [""] : text.split("\n");
}

function sentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  return normalized.split(/(?<=[.!?])\s+/);
}

function markdownHeadings(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

function bulletLine(line: string): boolean {
  return /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line);
}

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) {
    return 0;
  }

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function countStructuralIndicators(text: string, metric: TaxonomyRule["metric"]): number {
  if (!metric) {
    return 0;
  }

  const ls = lines(text);

  if (metric === "paragraph_length_inv_cv") {
    const ps = paragraphs(text);
    if (ps.length < 3) {
      return 0;
    }

    const wordCounts = ps.map(countWords).filter(c => c > 0);
    if (wordCounts.length < 3) {
      return 0;
    }

    const cv = coefficientOfVariation(wordCounts);
    return cv > 0 ? 1 / cv : 0;
  }

  if (metric === "sentence_length_inv_cv") {
    const ss = sentences(text);
    if (ss.length < 5) {
      return 0;
    }

    const wordCounts = ss.map(countWords).filter(c => c > 0);
    if (wordCounts.length < 5) {
      return 0;
    }

    const cv = coefficientOfVariation(wordCounts);
    return cv > 0 ? 1 / cv : 0;
  }

  if (metric === "bullet_lines_per_100_lines") {
    const bullet = ls.filter(bulletLine).length;
    return (bullet / Math.max(ls.length, 1)) * 100;
  }

  if (metric === "numbered_lines_per_100_lines") {
    const numbered = ls.filter(line => /^\s*\d+\.\s+/.test(line)).length;
    return (numbered / Math.max(ls.length, 1)) * 100;
  }

  if (metric === "markdown_heading_lines_per_100_lines") {
    const heading = ls.filter(markdownHeadings).length;
    return (heading / Math.max(ls.length, 1)) * 100;
  }

  if (metric === "emphasis_markup_lines_per_100_lines") {
    const emphasis = ls.filter((line) => /\*\*[^*]+\*\*|\*[^*]+\*/.test(line)).length;
    return (emphasis / Math.max(ls.length, 1)) * 100;
  }

  if (metric === "this_is_sentences_per_100_sentences") {
    const ss = sentences(text);
    const thisIsCount = ss.filter((sentence) => /^(?:this|it)\s+is\b/i.test(sentence)).length;
    return (thisIsCount / Math.max(ss.length, 1)) * 100;
  }

  // em_dash_per_1000_chars
  // Count both unicode em dash and standalone "--" to handle plain-ascii manuscripts.
  const emDashCount = (text.match(/—|(?<!-)--(?!-)/g) || []).length;
  return (emDashCount / Math.max(text.length, 1)) * 1000;
}

function dedupeMatchesByRuleSpan(matches: ScanRuleMatch[]): ScanRuleMatch[] {
  const seen = new Set<string>();
  const deduped: ScanRuleMatch[] = [];

  for (const match of matches) {
    const key = `${match.rule_id}:${match.start_char}:${match.end_char}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(match);
  }

  return deduped;
}

function collapseOverlappingRuleMatches(matches: ScanRuleMatch[]): ScanRuleMatch[] {
  if (matches.length <= 1) {
    return matches;
  }

  const sorted = [...matches].sort((a, b) => {
    if (a.start_char !== b.start_char) {
      return a.start_char - b.start_char;
    }

    if (a.end_char !== b.end_char) {
      return b.end_char - a.end_char;
    }

    return b.confidence - a.confidence;
  });

  const collapsed: ScanRuleMatch[] = [];
  let clusterEnd = sorted[0]!.end_char;
  let best = sorted[0]!;

  for (let i = 1; i < sorted.length; i += 1) {
    const candidate = sorted[i]!;

    if (candidate.start_char < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, candidate.end_char);

      const bestLength = best.end_char - best.start_char;
      const candidateLength = candidate.end_char - candidate.start_char;
      if (
        candidateLength > bestLength ||
        (candidateLength === bestLength && candidate.confidence > best.confidence)
      ) {
        best = candidate;
      }
      continue;
    }

    collapsed.push(best);
    best = candidate;
    clusterEnd = candidate.end_char;
  }

  collapsed.push(best);
  return collapsed;
}

function filterLocalStackedEvidence(
  matches: ScanRuleMatch[],
  windowChars: number,
  minMatches: number
): ScanRuleMatch[] {
  if (matches.length < minMatches) {
    return [];
  }

  const sorted = [...matches].sort((a, b) => {
    if (a.start_char !== b.start_char) {
      return a.start_char - b.start_char;
    }
    return a.end_char - b.end_char;
  });

  const kept = new Set<number>();
  let left = 0;
  for (let right = 0; right < sorted.length; right += 1) {
    while (
      left < right &&
      sorted[right]!.start_char - sorted[left]!.start_char > windowChars
    ) {
      left += 1;
    }

    const windowSize = right - left + 1;
    if (windowSize < minMatches) {
      continue;
    }

    for (let i = left; i <= right; i += 1) {
      kept.add(i);
    }
  }

  return sorted.filter((_, index) => kept.has(index));
}

function matchesInText(rule: TaxonomyRule, text: string): ScanRuleMatch[] {
  if (rule.match_type === "phrase" || rule.match_type === "regex") {
    const patterns = Array.isArray(rule.patterns) ? rule.patterns : [];
    const results: ScanRuleMatch[] = [];

    for (const pattern of patterns) {
      if (typeof pattern !== "string" || pattern.length === 0) {
        continue;
      }

      const flags = rule.case_sensitive === false ? "gi" : "g";

      if (rule.match_type === "phrase") {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, flags);

        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          results.push({
            rule_id: rule.id,
            category_id: "",
            label: rule.label,
            definition: rule.definition,
            match_type: rule.match_type,
            weight: rule.weight,
            start_char: start,
            end_char: end,
            matched_text: text.slice(start, end),
            confidence: 0.75
          });

          if (match.index === regex.lastIndex) {
            regex.lastIndex += 1;
          }
        }

        continue;
      }

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch {
        // Invalid regex patterns should not crash scanning.
        continue;
      }

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        results.push({
          rule_id: rule.id,
          category_id: "",
          label: rule.label,
          definition: rule.definition,
          match_type: rule.match_type,
          weight: rule.weight,
          start_char: start,
          end_char: end,
          matched_text: text.slice(start, end),
          confidence: 0.66
        });

        if (match.index === regex.lastIndex) {
          regex.lastIndex += 1;
        }
      }
    }

    const deduped = dedupeMatchesByRuleSpan(results);
    const overlapCollapsed = collapseOverlappingRuleMatches(deduped);
    if (rule.id === CERTAINTY_SOFTENER_RULE_ID) {
      return filterLocalStackedEvidence(
        overlapCollapsed,
        CERTAINTY_SOFTENER_WINDOW_CHARS,
        CERTAINTY_SOFTENER_MIN_MATCHES
      );
    }

    return overlapCollapsed;
  }

  const value = countStructuralIndicators(text, rule.metric);
  if (rule.threshold === undefined || value < rule.threshold) {
    return [];
  }

  return [{
    rule_id: rule.id,
    category_id: "",
    label: rule.label,
    definition: rule.definition,
    match_type: rule.match_type,
    weight: rule.weight,
    start_char: 0,
    end_char: Math.min(text.length, 1),
    matched_text: String(rule.metric ?? ""),
    confidence: 0.68
  }];
}

function classifyDensity(score: number, thresholds: TaxonomyThresholds): DensityBand {
  if (score <= thresholds.low.max_score) {
    return "low";
  }

  if (score >= thresholds.high.min_score) {
    return "high";
  }

  return "moderate";
}

function capRuleMatches(ruleMatches: number, capPer500Words: number, wordCount: number): number {
  const blocks = Math.max(1, Math.ceil(wordCount / 500));
  const cap = Math.max(1, capPer500Words * blocks);
  return Math.min(ruleMatches, cap);
}

function makeFingerprint(text: string, matches: ScanRuleMatch[], score: number, density: DensityBand): string {
  const ruleIds = matches
    .map((match) => match.rule_id)
    .sort()
    .join(",");
  const ruleCount = matches.length;
  const textBucket = Math.min(Math.floor(text.length / 128), 512);
  const payload = `${textBucket}:${density}:${ruleCount}:${ruleIds}:${score.toFixed(2)}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function scanText(
  input: string,
  taxonomy: Taxonomy,
  options: ScanOptions
): ScanResult {
  const text = normalizeText(toStringSafe(input));
  const wordCount = Math.max(countWords(text), 1);
  const categories = Array.isArray((taxonomy as { categories?: unknown[] }).categories)
    ? (taxonomy as { categories: TaxonomyCategory[] }).categories
    : [];

  const aggregation = (taxonomy as { aggregation?: TaxonomyAggregation }).aggregation ?? {
    base_score_formula: "sum(rule_weight * rule_match_count_capped)",
    rule_match_cap_per_500_words: 3,
    category_diversity_bonus: {
      enabled: true,
      bonus_if_categories_hit_at_least: 3,
      bonus_weight: 1.2
    },
    minimum_evidence_rules_triggered: 2
  };

  const thresholds = (taxonomy as { classification_thresholds?: TaxonomyThresholds }).classification_thresholds;

  const defaultThresholds: TaxonomyThresholds = {
    low: { min_score: 0, max_score: 3.49 },
    moderate: { min_score: 3.5, max_score: 7.99 },
    high: { min_score: 8, max_score: 999 }
  };

  const effectiveThresholds = thresholds ?? defaultThresholds;

  const matches: ScanRuleMatch[] = [];
  const categoryScores = new Map<string, number>();
  const definitions: Record<string, { label: string; definition: string }> = {};

  for (const category of categories) {
    const categoryMatchCount = category.rules.length;
    let categoryScore = 0;

    for (const rule of category.rules) {
      const matched = matchesInText(rule, text);
      if (matched.length === 0) {
        continue;
      }

      const matchCount = matched.length;
      const ruleScore = matchCount * rule.weight * scoringMultiplierForRule(rule);
      categoryScore += ruleScore;
      definitions[rule.id] = {
        label: rule.label,
        definition: rule.definition
      };

      for (const match of matched) {
        match.category_id = category.id;
        matches.push(match);
      }
    }

    if (categoryMatchCount > 0 && categoryScore > 0) {
      categoryScores.set(category.id, categoryScore);
    }
  }

  matches.sort((a, b) => {
    if (a.weight !== b.weight) {
      return b.weight - a.weight;
    }

    return a.start_char - b.start_char;
  });

  const totalDetected = matches.length;
  const topMatches = matches.slice(0, options.topMatches);
  const evidenceScore = Array.from(categoryScores.values()).reduce((sum, value) => sum + value, 0);

  const categoriesTriggered = Array.from(categoryScores.keys()).length;
  const diversityBonus =
    aggregation.category_diversity_bonus.enabled && categoriesTriggered >= aggregation.category_diversity_bonus.bonus_if_categories_hit_at_least
      ? aggregation.category_diversity_bonus.bonus_weight
      : 0;

  // Stabilize very short inputs: below 500 words we normalize as if text had 500 words.
  const normalizationWords = Math.max(wordCount, 500);
  const normalizedEvidence = evidenceScore * (1000 / normalizationWords);
  const aiismScore = Math.min(100, clampScore(normalizedEvidence + diversityBonus));
  const density = classifyDensity(aiismScore, effectiveThresholds);
  const aiismRatio = (totalDetected / wordCount) * 100;

  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryScores.entries()).map(([category_id, weighted_score]) => ({
    category_id,
    count: matches.filter((m) => m.category_id === category_id).length,
    weighted_score: Number(weighted_score.toFixed(2))
  }));

  const result: ScanResult = {
    total_ai_isms: topMatches.length,
    total_detected_ai_isms: totalDetected,
    truncated: totalDetected > topMatches.length,
    matches: topMatches,
    category_breakdown: categoryBreakdown,
    definitions,
    density,
    aiism_score: Number(aiismScore.toFixed(2)),
    aiism_ratio: Number(aiismRatio.toFixed(2))
  };

  if (options.emitPass) {
    result.pass = aiismScore >= options.threshold;
    result.threshold_used = options.threshold;
  }

  if (options.withFingerprint) {
    result.fingerprint = makeFingerprint(text, topMatches, aiismScore, density);
  }

  return result;
}
