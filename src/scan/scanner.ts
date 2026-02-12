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

function countStructuralIndicators(text: string, metric: TaxonomyRule["metric"]): number {
  if (!metric) {
    return 0;
  }

  const ls = lines(text);

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

    return results;
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

function safeConfidence(score: number, maxPossible: number): number {
  const max = Math.max(maxPossible, 1);
  const ratio = Math.min(1, score / max);
  return Number(Math.min(0.99, Math.max(0.05, ratio)).toFixed(2));
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

      const capped = capRuleMatches(matched.length, aggregation.rule_match_cap_per_500_words, wordCount);
      const ruleScore = capped * rule.weight;
      categoryScore += ruleScore;
      definitions[rule.id] = {
        label: rule.label,
        definition: rule.definition
      };

      for (const match of matched.slice(0, capped)) {
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

  const topMatches = matches.slice(0, options.topMatches);

  let score = 0;
  for (const match of topMatches) {
    score += match.weight;
  }

  const categoriesTriggered = Array.from(categoryScores.keys()).length;
  const diversityBonus =
    aggregation.category_diversity_bonus.enabled && categoriesTriggered >= aggregation.category_diversity_bonus.bonus_if_categories_hit_at_least
      ? aggregation.category_diversity_bonus.bonus_weight
      : 0;

  const densityScore = clampScore(score + diversityBonus);
  const density = classifyDensity(densityScore, effectiveThresholds);
  const thresholdUsed = options.threshold;
  const pass = densityScore >= thresholdUsed;

  const maxPossible = Math.max(topMatches.length * 3, 1) * 3;
  const confidence = safeConfidence(densityScore, maxPossible);

  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryScores.entries()).map(([category_id, weighted_score]) => ({
    category_id,
    count: topMatches.filter((m) => m.category_id === category_id).length,
    weighted_score: Number(weighted_score.toFixed(2))
  }));

  const result: ScanResult = {
    total_ai_isms: topMatches.length,
    matches: topMatches,
    category_breakdown: categoryBreakdown,
    definitions,
    density,
    confidence,
    score: Number(densityScore.toFixed(2)),
    pass,
    threshold_used: thresholdUsed
  };

  if (options.withFingerprint) {
    result.fingerprint = makeFingerprint(text, topMatches, densityScore, density);
  }

  return result;
}
