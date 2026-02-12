export type Taxonomy = Record<string, unknown>;

export interface TaxonomyCategory {
  id: string;
  label: string;
  definition: string;
  rules: TaxonomyRule[];
}

export interface TaxonomyRule {
  id: string;
  label: string;
  definition: string;
  match_type: "phrase" | "regex" | "structural_ratio";
  weight: number;
  patterns?: string[];
  case_sensitive?: boolean;
  metric?:
    | "bullet_lines_per_100_lines"
    | "em_dash_per_1000_chars"
    | "numbered_lines_per_100_lines"
    | "markdown_heading_lines_per_100_lines"
    | "this_is_sentences_per_100_sentences"
    | "emphasis_markup_lines_per_100_lines";
  threshold?: number;
}

export interface TaxonomyAggregation {
  base_score_formula: string;
  rule_match_cap_per_500_words: number;
  category_diversity_bonus: {
    enabled: boolean;
    bonus_if_categories_hit_at_least: number;
    bonus_weight: number;
  };
  minimum_evidence_rules_triggered: number;
}

export interface TaxonomyThresholdBand {
  min_score: number;
  max_score: number;
}

export interface TaxonomyThresholds {
  low: TaxonomyThresholdBand;
  moderate: TaxonomyThresholdBand;
  high: TaxonomyThresholdBand;
}

export type DensityBand = "low" | "moderate" | "high";

export interface ScanRuleMatch {
  rule_id: string;
  category_id: string;
  label: string;
  definition: string;
  match_type: TaxonomyRule["match_type"];
  weight: number;
  start_char: number;
  end_char: number;
  matched_text: string;
  confidence: number;
}

export interface CategoryBreakdown {
  category_id: string;
  count: number;
  weighted_score: number;
}

export interface ScanResult {
  total_ai_isms: number;
  matches: ScanRuleMatch[];
  category_breakdown: CategoryBreakdown[];
  definitions: Record<string, { label: string; definition: string }>;
  density: DensityBand;
  confidence: number;
  score: number;
  pass: boolean;
  threshold_used: number;
  fingerprint?: string;
}

export interface BatchItemResult {
  path: string;
  ok: boolean;
  error?: string;
  result?: ScanResult;
}

export interface ScanOptions {
  threshold: number;
  topMatches: number;
  withFingerprint: boolean;
}

export type ExitCode = 0 | 1 | 2 | 3 | 4;

export type ErrorCode =
  | "INVALID_ARGS"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "RUNTIME_ERROR";

export type Command = "validate" | "scan" | "batch" | "version" | "help";

export interface RobotError {
  code: ErrorCode;
  message: string;
  suggestions: string[];
}

export interface ScanDelta {
  before_total: number;
  after_total: number;
  delta: number;
  direction: "up" | "down" | "flat";
  before_density: DensityBand;
  after_density: DensityBand;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
}

export interface CommandResult {
  path?: string;
  source?: "stdin" | "file" | "path" | "text";
  version?: string;
  taxonomy_valid?: boolean;
  counts?: {
    categories: number;
    rules: number;
  };
  scan?: ScanResult;
  delta?: ScanDelta;
  batch?: BatchSummary;
}

export interface RobotResponse {
  ok: boolean;
  command: Command;
  json: boolean;
  exit_code: ExitCode;
  error?: RobotError;
  command_result?: CommandResult;
  details?: string[];
}
