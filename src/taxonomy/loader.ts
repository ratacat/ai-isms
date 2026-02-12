import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

type JsonMap = Record<string, unknown>;

export class TaxonomyValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Taxonomy validation failed with ${errors.length} error(s)`);
    this.name = "TaxonomyValidationError";
    this.errors = errors;
  }
}

const TOP_LEVEL_REQUIRED = [
  "schema_version",
  "version",
  "name",
  "description",
  "detector_constraints",
  "aliases",
  "categories",
  "aggregation",
  "classification_thresholds",
  "report_schema"
] as const;

const DETECTOR_CONSTRAINT_REQUIRED = [
  "cold_code_only",
  "ai_api_calls_allowed",
  "explainable_rules_required"
] as const;

const CATEGORY_REQUIRED = ["id", "label", "definition", "rules"] as const;
const RULE_BASE_REQUIRED = ["id", "label", "definition", "match_type", "weight"] as const;
const PHRASE_RULE_REQUIRED = [...RULE_BASE_REQUIRED, "patterns", "case_sensitive"] as const;
const REGEX_RULE_REQUIRED = [...RULE_BASE_REQUIRED, "patterns", "case_sensitive"] as const;
const STRUCTURAL_RATIO_RULE_REQUIRED = [...RULE_BASE_REQUIRED, "metric", "threshold"] as const;

const AGGREGATION_REQUIRED = [
  "base_score_formula",
  "rule_match_cap_per_500_words",
  "category_diversity_bonus",
  "minimum_evidence_rules_triggered"
] as const;

const DIVERSITY_BONUS_REQUIRED = [
  "enabled",
  "bonus_if_categories_hit_at_least",
  "bonus_weight"
] as const;

const THRESHOLD_BANDS = ["low", "moderate", "high"] as const;
const SCORE_BAND_REQUIRED = ["min_score", "max_score"] as const;

const REPORT_SCHEMA_REQUIRED = [
  "total_ai_isms",
  "matches",
  "category_breakdown",
  "definitions",
  "density",
  "confidence"
] as const;

const VALID_RULE_TYPES = ["phrase", "regex", "structural_ratio"] as const;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const CATEGORY_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const RULE_ID_REGEX = /^[a-z][a-z0-9_.-]*$/;
const METRIC_REGEX = /^[a-z][a-z0-9_]*$/;

function asObject(value: unknown): JsonMap | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonMap;
}

function requireKeys(hash: JsonMap, requiredKeys: readonly string[], errors: string[], pathLabel: string): void {
  for (const key of requiredKeys) {
    if (!(key in hash)) {
      errors.push(`${pathLabel}.${key} is required`);
    }
  }
}

function rejectExtraKeys(hash: JsonMap, allowedKeys: readonly string[], errors: string[], pathLabel: string): void {
  for (const key of Object.keys(hash)) {
    if (!allowedKeys.includes(key)) {
      errors.push(`${pathLabel}.${key} is not allowed`);
    }
  }
}

function validateNonEmptyString(value: unknown, errors: string[], pathLabel: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${pathLabel} must be a non-empty string`);
  }
}

function validatePatternString(
  value: unknown,
  pattern: RegExp,
  errors: string[],
  pathLabel: string,
  message = "is invalid"
): void {
  if (typeof value !== "string" || !pattern.test(value)) {
    errors.push(`${pathLabel} ${message}`);
  }
}

function validateNumber(value: unknown, errors: string[], pathLabel: string): void {
  if (typeof value !== "number" || Number.isNaN(value)) {
    errors.push(`${pathLabel} must be numeric`);
  }
}

function validatePositiveNumber(value: unknown, errors: string[], pathLabel: string): void {
  validateNumber(value, errors, pathLabel);
  if (typeof value === "number" && value <= 0) {
    errors.push(`${pathLabel} must be > 0`);
  }
}

function validateNonNegativeNumber(value: unknown, errors: string[], pathLabel: string): void {
  validateNumber(value, errors, pathLabel);
  if (typeof value === "number" && value < 0) {
    errors.push(`${pathLabel} must be >= 0`);
  }
}

function validatePositiveInteger(value: unknown, errors: string[], pathLabel: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    errors.push(`${pathLabel} must be a positive integer`);
  }
}

function validateStringArray(value: unknown, errors: string[], pathLabel: string): void {
  if (!Array.isArray(value)) {
    errors.push(`${pathLabel} must be an array`);
    return;
  }

  if (value.length === 0) {
    errors.push(`${pathLabel} must contain at least one value`);
  }

  value.forEach((entry, index) => validateNonEmptyString(entry, errors, `${pathLabel}[${index}]`));
}

function validateTopLevel(data: JsonMap, errors: string[], pathLabel: string): void {
  requireKeys(data, TOP_LEVEL_REQUIRED, errors, pathLabel);
  rejectExtraKeys(data, TOP_LEVEL_REQUIRED, errors, pathLabel);
  validatePatternString(data.schema_version, SEMVER_REGEX, errors, `${pathLabel}.schema_version`);
  validatePatternString(data.version, SEMVER_REGEX, errors, `${pathLabel}.version`);

  if (data.name !== "taxonomy") {
    errors.push(`${pathLabel}.name must be 'taxonomy'`);
  }

  validateNonEmptyString(data.description, errors, `${pathLabel}.description`);
}

function validateDetectorConstraints(value: unknown, errors: string[], pathLabel: string): void {
  const hash = asObject(value);
  if (!hash) {
    errors.push(`${pathLabel} must be an object`);
    return;
  }

  requireKeys(hash, DETECTOR_CONSTRAINT_REQUIRED, errors, pathLabel);
  rejectExtraKeys(hash, DETECTOR_CONSTRAINT_REQUIRED, errors, pathLabel);

  for (const key of DETECTOR_CONSTRAINT_REQUIRED) {
    if (typeof hash[key] !== "boolean") {
      errors.push(`${pathLabel}.${key} must be boolean`);
    }
  }

  if (hash.cold_code_only !== true) {
    errors.push(`${pathLabel}.cold_code_only must be true`);
  }
  if (hash.ai_api_calls_allowed !== false) {
    errors.push(`${pathLabel}.ai_api_calls_allowed must be false`);
  }
  if (hash.explainable_rules_required !== true) {
    errors.push(`${pathLabel}.explainable_rules_required must be true`);
  }
}

function validateAliases(value: unknown, errors: string[], pathLabel: string): void {
  if (!Array.isArray(value)) {
    errors.push(`${pathLabel} must be an array`);
    return;
  }

  if (value.length === 0) {
    errors.push(`${pathLabel} must include at least one alias`);
  }

  value.forEach((entry, index) => validateNonEmptyString(entry, errors, `${pathLabel}[${index}]`));

  const dedupe = new Set(value);
  if (dedupe.size !== value.length) {
    errors.push(`${pathLabel} must contain unique aliases`);
  }
}

function validateRule(rule: unknown, errors: string[], pathLabel: string): void {
  const hash = asObject(rule);
  if (!hash) {
    errors.push(`${pathLabel} must be an object`);
    return;
  }

  requireKeys(hash, RULE_BASE_REQUIRED, errors, pathLabel);

  const matchType = hash.match_type;
  if (typeof matchType !== "string" || !VALID_RULE_TYPES.includes(matchType as (typeof VALID_RULE_TYPES)[number])) {
    errors.push(`${pathLabel}.match_type must be one of ${VALID_RULE_TYPES.join(", ")}`);
    return;
  }

  const requiredKeys =
    matchType === "phrase"
      ? PHRASE_RULE_REQUIRED
      : matchType === "regex"
        ? REGEX_RULE_REQUIRED
        : STRUCTURAL_RATIO_RULE_REQUIRED;

  requireKeys(hash, requiredKeys, errors, pathLabel);
  rejectExtraKeys(hash, requiredKeys, errors, pathLabel);

  validatePatternString(hash.id, RULE_ID_REGEX, errors, `${pathLabel}.id`);
  validateNonEmptyString(hash.label, errors, `${pathLabel}.label`);
  validateNonEmptyString(hash.definition, errors, `${pathLabel}.definition`);
  validatePositiveNumber(hash.weight, errors, `${pathLabel}.weight`);

  if (matchType === "phrase" || matchType === "regex") {
    validateStringArray(hash.patterns, errors, `${pathLabel}.patterns`);
    if (typeof hash.case_sensitive !== "boolean") {
      errors.push(`${pathLabel}.case_sensitive must be boolean`);
    }
    return;
  }

  validatePatternString(hash.metric, METRIC_REGEX, errors, `${pathLabel}.metric`);
  validateNumber(hash.threshold, errors, `${pathLabel}.threshold`);
}

function validateCategories(value: unknown, errors: string[], pathLabel: string): void {
  if (!Array.isArray(value)) {
    errors.push(`${pathLabel} must be an array`);
    return;
  }

  if (value.length === 0) {
    errors.push(`${pathLabel} must include at least one category`);
  }

  const categoryIds = new Set<string>();
  const ruleIds = new Set<string>();

  value.forEach((entry, categoryIndex) => {
    const categoryPath = `${pathLabel}[${categoryIndex}]`;
    const category = asObject(entry);
    if (!category) {
      errors.push(`${categoryPath} must be an object`);
      return;
    }

    requireKeys(category, CATEGORY_REQUIRED, errors, categoryPath);
    rejectExtraKeys(category, CATEGORY_REQUIRED, errors, categoryPath);
    validatePatternString(category.id, CATEGORY_ID_REGEX, errors, `${categoryPath}.id`);
    validateNonEmptyString(category.label, errors, `${categoryPath}.label`);
    validateNonEmptyString(category.definition, errors, `${categoryPath}.definition`);

    if (typeof category.id === "string") {
      if (categoryIds.has(category.id)) {
        errors.push(`${categoryPath}.id duplicates category id '${category.id}'`);
      } else {
        categoryIds.add(category.id);
      }
    }

    if (!Array.isArray(category.rules)) {
      errors.push(`${categoryPath}.rules must be an array`);
      return;
    }

    if (category.rules.length === 0) {
      errors.push(`${categoryPath}.rules must include at least one rule`);
    }

    category.rules.forEach((rule, ruleIndex) => {
      const rulePath = `${categoryPath}.rules[${ruleIndex}]`;
      validateRule(rule, errors, rulePath);

      const ruleHash = asObject(rule);
      if (ruleHash && typeof ruleHash.id === "string") {
        if (ruleIds.has(ruleHash.id)) {
          errors.push(`${rulePath}.id duplicates rule id '${ruleHash.id}'`);
        } else {
          ruleIds.add(ruleHash.id);
        }
      }
    });
  });
}

function validateAggregation(value: unknown, errors: string[], pathLabel: string): void {
  const hash = asObject(value);
  if (!hash) {
    errors.push(`${pathLabel} must be an object`);
    return;
  }

  requireKeys(hash, AGGREGATION_REQUIRED, errors, pathLabel);
  rejectExtraKeys(hash, AGGREGATION_REQUIRED, errors, pathLabel);
  validateNonEmptyString(hash.base_score_formula, errors, `${pathLabel}.base_score_formula`);
  validatePositiveInteger(hash.rule_match_cap_per_500_words, errors, `${pathLabel}.rule_match_cap_per_500_words`);
  validatePositiveInteger(hash.minimum_evidence_rules_triggered, errors, `${pathLabel}.minimum_evidence_rules_triggered`);

  const bonusPath = `${pathLabel}.category_diversity_bonus`;
  const bonus = asObject(hash.category_diversity_bonus);
  if (!bonus) {
    errors.push(`${bonusPath} must be an object`);
    return;
  }

  requireKeys(bonus, DIVERSITY_BONUS_REQUIRED, errors, bonusPath);
  rejectExtraKeys(bonus, DIVERSITY_BONUS_REQUIRED, errors, bonusPath);

  if (typeof bonus.enabled !== "boolean") {
    errors.push(`${bonusPath}.enabled must be boolean`);
  }
  validatePositiveInteger(bonus.bonus_if_categories_hit_at_least, errors, `${bonusPath}.bonus_if_categories_hit_at_least`);
  validateNonNegativeNumber(bonus.bonus_weight, errors, `${bonusPath}.bonus_weight`);
}

function validateThresholds(value: unknown, errors: string[], pathLabel: string): void {
  const hash = asObject(value);
  if (!hash) {
    errors.push(`${pathLabel} must be an object`);
    return;
  }

  requireKeys(hash, THRESHOLD_BANDS, errors, pathLabel);
  rejectExtraKeys(hash, THRESHOLD_BANDS, errors, pathLabel);

  for (const band of THRESHOLD_BANDS) {
    const bandPath = `${pathLabel}.${band}`;
    const bandValue = asObject(hash[band]);
    if (!bandValue) {
      errors.push(`${bandPath} must be an object`);
      continue;
    }

    requireKeys(bandValue, SCORE_BAND_REQUIRED, errors, bandPath);
    rejectExtraKeys(bandValue, SCORE_BAND_REQUIRED, errors, bandPath);
    validateNumber(bandValue.min_score, errors, `${bandPath}.min_score`);
    validateNumber(bandValue.max_score, errors, `${bandPath}.max_score`);
  }

  const low = asObject(hash.low);
  const moderate = asObject(hash.moderate);
  const high = asObject(hash.high);

  if (
    low &&
    moderate &&
    high &&
    typeof low.max_score === "number" &&
    typeof moderate.min_score === "number" &&
    typeof moderate.max_score === "number" &&
    typeof high.min_score === "number"
  ) {
    if (low.max_score > moderate.min_score) {
      errors.push(`${pathLabel}.low.max_score must be <= ${pathLabel}.moderate.min_score`);
    }
    if (moderate.max_score > high.min_score) {
      errors.push(`${pathLabel}.moderate.max_score must be <= ${pathLabel}.high.min_score`);
    }
  }
}

function validateReportSchema(value: unknown, errors: string[], pathLabel: string): void {
  const hash = asObject(value);
  if (!hash) {
    errors.push(`${pathLabel} must be an object`);
    return;
  }

  requireKeys(hash, REPORT_SCHEMA_REQUIRED, errors, pathLabel);
  rejectExtraKeys(hash, REPORT_SCHEMA_REQUIRED, errors, pathLabel);

  if (hash.total_ai_isms !== "integer") {
    errors.push(`${pathLabel}.total_ai_isms must equal 'integer'`);
  }

  validateStringArray(hash.matches, errors, `${pathLabel}.matches`);
  validateStringArray(hash.category_breakdown, errors, `${pathLabel}.category_breakdown`);

  const definitionsPath = `${pathLabel}.definitions`;
  const definitions = asObject(hash.definitions);
  if (!definitions) {
    errors.push(`${definitionsPath} must be an object`);
  } else {
    requireKeys(definitions, ["keyed_by"], errors, definitionsPath);
    rejectExtraKeys(definitions, ["keyed_by"], errors, definitionsPath);
    validateNonEmptyString(definitions.keyed_by, errors, `${definitionsPath}.keyed_by`);
  }

  if (hash.density !== "low_or_moderate_or_high") {
    errors.push(`${pathLabel}.density must equal 'low_or_moderate_or_high'`);
  }
  if (hash.confidence !== "0_to_1") {
    errors.push(`${pathLabel}.confidence must equal '0_to_1'`);
  }
}

function parseYamlFile(taxonomyPath: string): JsonMap {
  let content: string;
  try {
    content = fs.readFileSync(taxonomyPath, "utf8");
  } catch {
    throw new TaxonomyValidationError([`taxonomy file not found: ${taxonomyPath}`]);
  }

  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TaxonomyValidationError([`invalid YAML: ${message}`]);
  }

  const map = asObject(parsed);
  if (!map) {
    throw new TaxonomyValidationError(["$ must be a map/object"]);
  }

  return map;
}

export function defaultTaxonomyPath(): string {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  return path.resolve(dirname, "../../taxonomy/taxonomy.yml");
}

export function loadTaxonomy(taxonomyPath = defaultTaxonomyPath()): JsonMap {
  const data = parseYamlFile(taxonomyPath);
  const errors: string[] = [];

  validateTopLevel(data, errors, "$");
  validateDetectorConstraints(data.detector_constraints, errors, "$.detector_constraints");
  validateAliases(data.aliases, errors, "$.aliases");
  validateCategories(data.categories, errors, "$.categories");
  validateAggregation(data.aggregation, errors, "$.aggregation");
  validateThresholds(data.classification_thresholds, errors, "$.classification_thresholds");
  validateReportSchema(data.report_schema, errors, "$.report_schema");

  if (errors.length > 0) {
    throw new TaxonomyValidationError(errors);
  }

  return data;
}
