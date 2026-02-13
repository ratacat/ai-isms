import { scanText } from "../scan/scanner.js";
import type { ScanOptions, Taxonomy } from "../scan/types.js";
import { defaultTaxonomyPath, loadTaxonomy } from "../taxonomy/loader.js";

interface FixtureExpectations {
  includeRules?: string[];
  excludeRules?: string[];
  minRuleCounts?: Record<string, number>;
  maxAiismScore?: number;
}

interface CalibrationFixture {
  id: string;
  note: string;
  text: string;
  expect: FixtureExpectations;
}

interface FixtureFailure {
  fixtureId: string;
  message: string;
}

const SCAN_OPTIONS: ScanOptions = {
  threshold: 0,
  topMatches: Number.MAX_SAFE_INTEGER,
  withFingerprint: false,
  emitPass: false
};

const FIXTURES: CalibrationFixture[] = [
  {
    id: "domain-leverage-neutral",
    note: "Leverage should not trigger inflated action-verb rule in trading context.",
    text: [
      "In derivatives trading, leverage changes liquidation distance and margin requirements.",
      "Lower leverage leaves more room before invalidation.",
      "A risk plan should define stop placement before entry."
    ].join(" "),
    expect: {
      excludeRules: ["phrase.action_verb_inflation"],
      maxAiismScore: 3.49
    }
  },
  {
    id: "editorial-key-insight-heading",
    note: "Repeated handbook heading style should not dominate assistant scaffolding score.",
    text: [
      "Key Insight: Volatility expands around major events.",
      "Key Insight: Liquidity can disappear during fast moves.",
      "Key Insight: Position size should shrink when uncertainty rises."
    ].join("\n"),
    expect: {
      excludeRules: ["scaffold.key_takeaways"],
      maxAiismScore: 3.49
    }
  },
  {
    id: "certainty-softener-singleton",
    note: "Single hedge token should not trigger certainty softener stack.",
    text: "Price behavior often changes near large session opens.",
    expect: {
      excludeRules: ["tone.certainty_softener"]
    }
  },
  {
    id: "certainty-softener-clustered",
    note: "Multiple hedges in a local span should trigger certainty softener stack.",
    text: "Price behavior generally shifts during transitions, and it often mean-reverts after failed breakouts.",
    expect: {
      includeRules: ["tone.certainty_softener"],
      minRuleCounts: {
        "tone.certainty_softener": 2
      }
    }
  },
  {
    id: "not-because-but-because",
    note: "Contrast variant from manual handbook review should be detected.",
    text: "The setup failed not because buyers were absent but because trapped longs kept selling into every bounce.",
    expect: {
      includeRules: ["template.not_x_but_y"]
    }
  },
  {
    id: "not-because-dash-because",
    note: "Dash-separated because contrast should still be detected.",
    text: "The loss came not because of the multiplier -- because of where liquidation sat relative to invalidation.",
    expect: {
      includeRules: ["template.not_x_but_y"]
    }
  },
  {
    id: "not-then-but-next-sentence",
    note: "Cross-sentence not/but contrast should be detected.",
    text: "Time is not a signal by itself. But setup quality at the right session can shift edge materially.",
    expect: {
      includeRules: ["template.not_x_but_y"]
    }
  },
  {
    id: "when-when-long-span",
    note: "Long-span didactic mirror should be detected after regex expansion.",
    text: [
      "When volume expands into resistance while funding stays one-sided and late longs keep adding at worse prices despite repeated absorption at the highs and weakening follow-through on each push, risk of reversal builds quickly.",
      "When that pressure finally releases, liquidation cascades can accelerate."
    ].join(" "),
    expect: {
      includeRules: ["template.when_when_didactic"]
    }
  },
  {
    id: "when-bridge-sentences",
    note: "When/when with bridge sentences should be detected.",
    text: "When perp price trades above spot, longs pay shorts. This discourages excess positioning. When perp price trades below spot, shorts pay longs.",
    expect: {
      includeRules: ["template.when_when_bridge"]
    }
  },
  {
    id: "when-and-when-single-sentence",
    note: "Single-sentence when ... and when ... form should be detected.",
    text: "Risk discipline matters most when you are winning and when you are losing.",
    expect: {
      includeRules: ["template.when_when_didactic"]
    }
  },
  {
    id: "when-reverse-bridge",
    note: "When ... The reverse when ... form should be detected.",
    text: "When longs outnumber shorts, longs pay shorts. The reverse when shorts dominate.",
    expect: {
      includeRules: ["template.when_when_didactic"]
    }
  }
];

function collectRuleCounts(ruleIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ruleId of ruleIds) {
    counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
  }
  return counts;
}

function runFixture(fixture: CalibrationFixture, taxonomy: Taxonomy): FixtureFailure[] {
  const failures: FixtureFailure[] = [];
  const result = scanText(fixture.text, taxonomy, SCAN_OPTIONS);
  const ruleCounts = collectRuleCounts(result.matches.map((match) => match.rule_id));

  for (const ruleId of fixture.expect.includeRules ?? []) {
    if (!ruleCounts.has(ruleId)) {
      failures.push({
        fixtureId: fixture.id,
        message: `expected rule '${ruleId}' to be present`
      });
    }
  }

  for (const ruleId of fixture.expect.excludeRules ?? []) {
    if (ruleCounts.has(ruleId)) {
      failures.push({
        fixtureId: fixture.id,
        message: `expected rule '${ruleId}' to be absent, found count=${ruleCounts.get(ruleId) ?? 0}`
      });
    }
  }

  for (const [ruleId, minimum] of Object.entries(fixture.expect.minRuleCounts ?? {})) {
    const actual = ruleCounts.get(ruleId) ?? 0;
    if (actual < minimum) {
      failures.push({
        fixtureId: fixture.id,
        message: `expected rule '${ruleId}' count >= ${minimum}, found ${actual}`
      });
    }
  }

  if (fixture.expect.maxAiismScore !== undefined && result.aiism_score > fixture.expect.maxAiismScore) {
    failures.push({
      fixtureId: fixture.id,
      message: `expected aiism_score <= ${fixture.expect.maxAiismScore}, found ${result.aiism_score}`
    });
  }

  if (failures.length === 0) {
    const topRules = Array.from(ruleCounts.entries())
      .map(([ruleId, count]) => `${ruleId}(${count})`)
      .slice(0, 5)
      .join(", ");
    console.log(`PASS ${fixture.id} score=${result.aiism_score} ratio=${result.aiism_ratio} rules=[${topRules}]`);
  } else {
    console.log(`FAIL ${fixture.id} score=${result.aiism_score} ratio=${result.aiism_ratio}`);
    for (const failure of failures) {
      console.log(`  - ${failure.message}`);
    }
  }

  return failures;
}

function runDedupeSanityCheck(): FixtureFailure[] {
  const taxonomy: Taxonomy = {
    categories: [
      {
        id: "duplication_test",
        label: "Duplication Test",
        definition: "Synthetic category for dedupe guard regression.",
        rules: [
          {
            id: "test.duplicate_regex",
            label: "Duplicate regex",
            definition: "Intentionally duplicate patterns to ensure dedupe.",
            match_type: "regex",
            patterns: ["\\bsynthetic\\b", "\\bsynthetic\\b"],
            case_sensitive: false,
            weight: 1
          }
        ]
      }
    ]
  };

  const result = scanText("synthetic", taxonomy, SCAN_OPTIONS);
  const failures: FixtureFailure[] = [];
  if (result.total_detected_ai_isms !== 1) {
    failures.push({
      fixtureId: "dedupe-sanity-check",
      message: `expected exactly 1 detected AIism, found ${result.total_detected_ai_isms}`
    });
  }

  if (result.matches.length !== 1) {
    failures.push({
      fixtureId: "dedupe-sanity-check",
      message: `expected exactly 1 emitted match, found ${result.matches.length}`
    });
  }

  if (failures.length === 0) {
    console.log("PASS dedupe-sanity-check detected=1 emitted=1");
  } else {
    console.log("FAIL dedupe-sanity-check");
    for (const failure of failures) {
      console.log(`  - ${failure.message}`);
    }
  }

  return failures;
}

function runOverlapCollapseSanityCheck(): FixtureFailure[] {
  const taxonomy: Taxonomy = {
    categories: [
      {
        id: "overlap_test",
        label: "Overlap Test",
        definition: "Synthetic category for overlap-collapse regression.",
        rules: [
          {
            id: "test.overlap_regex",
            label: "Overlap regex",
            definition: "Intentionally overlapping patterns to ensure collapse.",
            match_type: "regex",
            patterns: [
              "\\bnot\\s+because\\b[^.?!]{1,120}\\bbut\\s+because\\b[^.?!]{1,120}",
              "\\bnot\\s+(?!only\\b)[^.?!]{5,140}\\bbut\\s+[^.?!]{5,140}"
            ],
            case_sensitive: false,
            weight: 1
          }
        ]
      }
    ]
  };

  const result = scanText(
    "The setup failed not because buyers were absent but because trapped longs kept selling.",
    taxonomy,
    SCAN_OPTIONS
  );

  const failures: FixtureFailure[] = [];
  if (result.total_detected_ai_isms !== 1) {
    failures.push({
      fixtureId: "overlap-collapse-sanity-check",
      message: `expected exactly 1 detected AIism after overlap collapse, found ${result.total_detected_ai_isms}`
    });
  }

  if (result.matches.length !== 1) {
    failures.push({
      fixtureId: "overlap-collapse-sanity-check",
      message: `expected exactly 1 emitted match after overlap collapse, found ${result.matches.length}`
    });
  }

  if (failures.length === 0) {
    console.log("PASS overlap-collapse-sanity-check detected=1 emitted=1");
  } else {
    console.log("FAIL overlap-collapse-sanity-check");
    for (const failure of failures) {
      console.log(`  - ${failure.message}`);
    }
  }

  return failures;
}

function main(): void {
  const taxonomyPath = defaultTaxonomyPath();
  const taxonomy = loadTaxonomy(taxonomyPath) as Taxonomy;

  console.log(`Running handbook calibration fixtures with taxonomy: ${taxonomyPath}`);

  const failures: FixtureFailure[] = [];
  for (const fixture of FIXTURES) {
    console.log(`\nFixture: ${fixture.id}`);
    console.log(`Note: ${fixture.note}`);
    failures.push(...runFixture(fixture, taxonomy));
  }

  console.log("\nFixture: dedupe-sanity-check");
  console.log("Note: Duplicate rule/span hits should be collapsed before scoring and output.");
  failures.push(...runDedupeSanityCheck());

  console.log("\nFixture: overlap-collapse-sanity-check");
  console.log("Note: Overlapping same-rule spans should collapse to one strongest match.");
  failures.push(...runOverlapCollapseSanityCheck());

  if (failures.length > 0) {
    console.error(`\n${failures.length} calibration assertion(s) failed.`);
    process.exit(1);
  }

  console.log(`\nAll ${FIXTURES.length + 2} handbook calibration fixture checks passed.`);
}

main();
