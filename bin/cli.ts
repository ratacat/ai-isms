#!/usr/bin/env bun
import { defaultTaxonomyPath, loadTaxonomy, TaxonomyValidationError } from "../src/taxonomy/loader.js";
import { readTextFromPath, readTextFromStdin } from "../src/scan/io.js";
import { scanText, type ScanOptions } from "../src/scan/scanner.js";
import type {
  BatchItemResult,
  Command,
  CommandResult,
  ErrorCode,
  ExitCode,
  RobotResponse,
  Taxonomy
} from "../src/scan/types.js";

const VERSION = "0.1.1";
const ALL_MATCHES_LIMIT = Number.MAX_SAFE_INTEGER;

const HELP = "aism <cmd>\nscan|batch|validate|version|help\nuse `aism help scan` for scan flags";
const HELP_SCAN = "scan [--text t|--file p|--path p|stdin] [--threshold low|moderate|high|n (enables pass/fail)] [--top-matches n] [--fingerprint] [--quiet] [--json]\nscan --before p --after p [same flags]";
const HELP_BATCH = "batch <file1> [file2..] [--threshold low|moderate|high|n (enables pass/fail)] [--top-matches n] [--fingerprint] [--quiet] [--json]";
const HELP_VALIDATE = "validate [taxonomyPath] [--json]";

const EXIT_BY_ERROR: Record<ErrorCode, ExitCode> = {
  INVALID_ARGS: 2,
  NOT_FOUND: 1,
  VALIDATION_FAILED: 3,
  RUNTIME_ERROR: 4
};

interface ParsedArgs {
  command: string | null;
  commandArg: string | null;
  json: boolean;
  quiet: boolean;
  help: boolean;
  version: boolean;
  file: string | null;
  path: string | null;
  text: string | null;
  before: string | null;
  after: string | null;
  topMatches: number;
  threshold: string | null;
  fingerprint: boolean;
  files: string[];
  extras: string[];
}

function toJsonMode(jsonFlag: boolean): boolean {
  return jsonFlag || process.stdout.isTTY !== true;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: null,
    commandArg: null,
    json: false,
    quiet: false,
    help: false,
    version: false,
    file: null,
    path: null,
    text: null,
    before: null,
    after: null,
    topMatches: ALL_MATCHES_LIMIT,
    threshold: null,
    fingerprint: false,
    files: [],
    extras: []
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--json") {
      parsed.json = true;
      i += 1;
      continue;
    }
    if (arg === "--quiet") {
      parsed.quiet = true;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      i += 1;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      parsed.version = true;
      i += 1;
      continue;
    }
    if (arg === "--file") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--file requires a value");
      }
      parsed.file = next;
      i += 2;
      continue;
    }
    if (arg === "--path") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--path requires a value");
      }
      parsed.path = next;
      i += 2;
      continue;
    }
    if (arg === "--text") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--text requires a value");
      }
      parsed.text = next;
      i += 2;
      continue;
    }
    if (arg === "--before") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--before requires a value");
      }
      parsed.before = next;
      i += 2;
      continue;
    }
    if (arg === "--after") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--after requires a value");
      }
      parsed.after = next;
      i += 2;
      continue;
    }
    if (arg === "--top-matches") {
      const next = argv[i + 1];
      const value = Number(next);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--top-matches requires a positive integer");
      }
      parsed.topMatches = value;
      i += 2;
      continue;
    }
    if (arg === "--threshold") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--threshold requires a value");
      }
      parsed.threshold = next;
      i += 2;
      continue;
    }
    if (arg === "--fingerprint") {
      parsed.fingerprint = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`unknown flag: ${arg}`);
    }

    if (parsed.command === null) {
      parsed.command = arg;
      i += 1;
      continue;
    }

    if ((parsed.command === "validate" || parsed.command === "help") && parsed.commandArg === null) {
      parsed.commandArg = arg;
      i += 1;
      continue;
    }

    if (parsed.command === "batch") {
      parsed.files.push(arg);
      i += 1;
      continue;
    }

    parsed.extras.push(arg);
    i += 1;
  }

  return parsed;
}

function ok(
  command: Command,
  json: boolean,
  commandResult?: CommandResult,
  details?: string[]
): RobotResponse {
  const response: RobotResponse = {
    ok: true,
    command,
    json,
    exit_code: 0
  };

  if (commandResult) {
    response.command_result = commandResult;
  }
  if (details && details.length > 0) {
    response.details = details;
  }

  return response;
}

function fail(
  command: Command,
  json: boolean,
  code: ErrorCode,
  message: string,
  suggestions: string[],
  details?: string[],
  commandResult?: CommandResult
): RobotResponse {
  const response: RobotResponse = {
    ok: false,
    command,
    json,
    exit_code: EXIT_BY_ERROR[code],
    error: {
      code,
      message,
      suggestions
    }
  };

  if (details && details.length > 0) {
    response.details = details;
  }
  if (commandResult) {
    response.command_result = commandResult;
  }

  return response;
}

function helpText(subject?: string): string {
  if (subject === "scan") {
    return HELP_SCAN;
  }
  if (subject === "batch") {
    return HELP_BATCH;
  }
  if (subject === "validate") {
    return HELP_VALIDATE;
  }
  if (subject === "version") {
    return "version";
  }
  if (subject === "help") {
    return "help [scan|batch|validate|version]";
  }
  return HELP;
}

function printHuman(response: RobotResponse, quiet: boolean): void {
  if (!response.ok && response.error) {
    process.stdout.write(`error:${response.error.code} ${response.error.message}\n`);
    if (response.error.suggestions.length > 0) {
      process.stdout.write(`${response.error.suggestions.join(" | ")}\n`);
    }
    if (response.details && response.details.length > 0) {
      for (const detail of response.details) {
        process.stdout.write(`- ${detail}\n`);
      }
    }
    return;
  }

  if (response.command === "help") {
    process.stdout.write(`${response.details?.[0] ?? HELP}\n`);
    return;
  }

  if (response.command === "version") {
    process.stdout.write(`${response.command_result?.version ?? VERSION}\n`);
    return;
  }

  if (response.command === "validate") {
    const counts = response.command_result?.counts;
    const path = response.command_result?.path;
    const version = response.command_result?.version;
    if (quiet) {
      process.stdout.write(`valid categories=${counts?.categories ?? 0} rules=${counts?.rules ?? 0}\n`);
      return;
    }
    process.stdout.write(`taxonomy valid\npath: ${path}\nversion: ${version}\ncategories: ${counts?.categories ?? 0}\nrules: ${counts?.rules ?? 0}\n`);
    return;
  }

  if (response.command === "scan") {
    const scan = response.command_result?.scan;
    if (!scan) {
      process.stdout.write("scan complete\n");
      return;
    }

    const delta = response.command_result?.delta;
    const truncationSuffix = scan.truncated ? ` shown=${scan.total_ai_isms}/${scan.total_detected_ai_isms}` : "";
    if (quiet) {
      const fp = scan.fingerprint ? ` fp=${scan.fingerprint}` : "";
      const passPart = scan.pass === undefined ? "" : ` pass=${scan.pass}`;
      if (delta) {
        process.stdout.write(`count=${scan.total_ai_isms} density=${scan.density} score=${scan.aiism_score} ratio=${scan.aiism_ratio}${passPart} delta=${delta.delta} dir=${delta.direction}${truncationSuffix}${fp}\n`);
        return;
      }
      process.stdout.write(`count=${scan.total_ai_isms} density=${scan.density} score=${scan.aiism_score} ratio=${scan.aiism_ratio}${passPart}${truncationSuffix}${fp}\n`);
      return;
    }

    if (response.command_result?.path) {
      process.stdout.write(`path: ${response.command_result.path}\n`);
    }
    if (response.command_result?.source) {
      process.stdout.write(`source: ${response.command_result.source}\n`);
    }
    if (delta) {
      process.stdout.write(`delta: ${delta.delta} (${delta.direction})\n`);
      process.stdout.write(`before: ${delta.before_total} (${delta.before_density})\n`);
      process.stdout.write(`after: ${delta.after_total} (${delta.after_density})\n`);
    }
    process.stdout.write(`density: ${scan.density}\nscore: ${scan.aiism_score}\nratio: ${scan.aiism_ratio}\ncount: ${scan.total_ai_isms}\n`);
    if (scan.pass !== undefined) {
      process.stdout.write(`pass: ${scan.pass}\n`);
    }
    if (scan.truncated) {
      process.stdout.write(`warning: showing top ${scan.total_ai_isms} of ${scan.total_detected_ai_isms} matches (use --top-matches N)\n`);
    }
    if (scan.fingerprint) {
      process.stdout.write(`fingerprint: ${scan.fingerprint}\n`);
    }
    if (scan.matches.length > 0) {
      const top = scan.matches
        .slice(0, 3)
        .map((match) => `${match.rule_id}@${match.start_char}-${match.end_char}`)
        .join(", ");
      process.stdout.write(`top: ${top}\n`);
    }
    return;
  }

  if (response.command === "batch") {
    const batch = response.command_result?.batch;
    if (!batch) {
      process.stdout.write("batch complete\n");
      return;
    }

    if (quiet) {
      process.stdout.write(`total=${batch.total} succeeded=${batch.succeeded} failed=${batch.failed}\n`);
      return;
    }

    for (const item of batch.results) {
      if (!item.ok) {
        process.stdout.write(`err ${item.path}: ${item.error ?? "failed"}\n`);
        continue;
      }
      process.stdout.write(`ok ${item.path}: count=${item.result?.total_ai_isms ?? 0} density=${item.result?.density ?? "low"}\n`);
    }
    process.stdout.write(`summary: total=${batch.total} succeeded=${batch.succeeded} failed=${batch.failed}\n`);
  }
}

function emitAndExit(response: RobotResponse, quiet: boolean): never {
  if (response.json) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } else {
    printHuman(response, quiet);
  }
  process.exit(response.exit_code);
}

function parseThreshold(value: string | null): number {
  if (value === null) {
    return 0;
  }
  if (value === "low") {
    return 0;
  }
  if (value === "moderate") {
    return 4;
  }
  if (value === "high") {
    return 8;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("--threshold must be low|moderate|high|number");
  }
  return numeric;
}

function buildScanOptions(args: ParsedArgs): ScanOptions {
  return {
    threshold: parseThreshold(args.threshold),
    topMatches: Math.max(1, args.topMatches),
    withFingerprint: args.fingerprint,
    emitPass: args.threshold !== null
  };
}

function taxonomyCounts(taxonomy: Taxonomy): { categories: number; rules: number } {
  const categories = Array.isArray(taxonomy.categories) ? taxonomy.categories : [];
  const categoryCount = categories.length;
  const ruleCount = categories.reduce((count, category) => {
    if (category && typeof category === "object" && Array.isArray((category as { rules?: unknown[] }).rules)) {
      return count + (category as { rules: unknown[] }).rules.length;
    }
    return count;
  }, 0);

  return { categories: categoryCount, rules: ruleCount };
}

function hasNotFoundSemantics(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("not found") || lower.includes("no such file");
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: string }).code ?? "");
    if (code === "ENOENT") {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return hasNotFoundSemantics(message);
}

function taxonomyError(
  command: Command,
  json: boolean,
  error: unknown,
  taxonomyPath: string
): RobotResponse {
  if (error instanceof TaxonomyValidationError) {
    const first = error.errors[0] ?? "taxonomy validation failed";
    if (hasNotFoundSemantics(first)) {
      return fail(
        command,
        json,
        "NOT_FOUND",
        first,
        [`create or fix file: ${taxonomyPath}`, "run: aism validate --json"],
        error.errors
      );
    }

    return fail(
      command,
      json,
      "VALIDATION_FAILED",
      "taxonomy validation failed",
      ["inspect taxonomy errors", "run: aism validate --json"],
      error.errors
    );
  }

  return fail(
    command,
    json,
    "RUNTIME_ERROR",
    error instanceof Error ? error.message : "unexpected runtime error",
    ["rerun with --json", "verify file paths"]
  );
}

function loadTaxonomyFor(command: Command, json: boolean): { taxonomy?: Taxonomy; error?: RobotResponse } {
  const taxonomyPath = defaultTaxonomyPath();
  try {
    return { taxonomy: loadTaxonomy(taxonomyPath) as Taxonomy };
  } catch (error) {
    return { error: taxonomyError(command, json, error, taxonomyPath) };
  }
}

function invalidInputMix(args: ParsedArgs, json: boolean): RobotResponse | null {
  const directInputs = [args.text !== null, args.file !== null, args.path !== null].filter(Boolean).length;
  const deltaInput = args.before !== null || args.after !== null;

  if (directInputs > 1) {
    return fail("scan", json, "INVALID_ARGS", "choose one input mode: --text or --file or --path", ["remove extra input flags"]);
  }
  if (deltaInput && directInputs > 0) {
    return fail("scan", json, "INVALID_ARGS", "delta mode cannot be combined with --text/--file/--path", ["use only --before/--after"]);
  }
  if ((args.before === null) !== (args.after === null)) {
    return fail("scan", json, "INVALID_ARGS", "both --before and --after are required for delta mode", ["add the missing flag"]);
  }

  return null;
}

async function runScan(args: ParsedArgs, json: boolean): Promise<RobotResponse> {
  if (args.extras.length > 0 || args.files.length > 0) {
    return fail("scan", json, "INVALID_ARGS", "unexpected positional arguments for scan", ["use: aism scan --file <path>"]);
  }

  const mixedInputError = invalidInputMix(args, json);
  if (mixedInputError) {
    return mixedInputError;
  }

  let options: ScanOptions;
  try {
    options = buildScanOptions(args);
  } catch (error) {
    return fail(
      "scan",
      json,
      "INVALID_ARGS",
      error instanceof Error ? error.message : "invalid scan options",
      ["run: aism help scan"]
    );
  }

  const taxonomyLoad = loadTaxonomyFor("scan", json);
  if (!taxonomyLoad.taxonomy) {
    return taxonomyLoad.error as RobotResponse;
  }

  if (args.before !== null && args.after !== null) {
    try {
      const [beforeText, afterText] = await Promise.all([
        readTextFromPath(args.before),
        readTextFromPath(args.after)
      ]);

      const before = scanText(beforeText, taxonomyLoad.taxonomy, options);
      const after = scanText(afterText, taxonomyLoad.taxonomy, options);
      const delta = after.total_ai_isms - before.total_ai_isms;

      return ok("scan", json, {
        scan: after,
        delta: {
          before_total: before.total_ai_isms,
          after_total: after.total_ai_isms,
          delta,
          direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
          before_density: before.density,
          after_density: after.density
        }
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return fail("scan", json, "NOT_FOUND", "delta input file not found", ["check --before and --after paths"]);
      }
      return fail(
        "scan",
        json,
        "RUNTIME_ERROR",
        error instanceof Error ? error.message : "failed to read delta input",
        ["verify input files are readable"]
      );
    }
  }

  try {
    let source: CommandResult["source"] = "stdin";
    let path: string | undefined;
    let text: string;

    if (args.text !== null) {
      source = "text";
      text = args.text;
    } else if (args.file !== null) {
      source = "file";
      path = args.file;
      text = await readTextFromPath(args.file);
    } else if (args.path !== null) {
      source = "path";
      path = args.path;
      text = await readTextFromPath(args.path);
    } else {
      source = "stdin";
      text = await readTextFromStdin();
    }

    const scan = scanText(text, taxonomyLoad.taxonomy, options);
    return ok("scan", json, { source, path, scan });
  } catch (error) {
    if (isNotFoundError(error)) {
      return fail("scan", json, "NOT_FOUND", "input file not found", ["check --file/--path value"]);
    }
    return fail(
      "scan",
      json,
      "RUNTIME_ERROR",
      error instanceof Error ? error.message : "scan failed",
      ["retry with --json", "verify input text and file access"]
    );
  }
}

async function runBatch(args: ParsedArgs, json: boolean): Promise<RobotResponse> {
  if (args.before !== null || args.after !== null || args.file !== null || args.path !== null || args.text !== null) {
    return fail("batch", json, "INVALID_ARGS", "batch only accepts positional file paths", ["use: aism batch <file1> <file2>"]);
  }

  let options: ScanOptions;
  try {
    options = buildScanOptions(args);
  } catch (error) {
    return fail(
      "batch",
      json,
      "INVALID_ARGS",
      error instanceof Error ? error.message : "invalid batch options",
      ["run: aism help batch"]
    );
  }

  const files = args.files.length > 0 ? args.files : args.extras;
  if (files.length === 0) {
    return fail("batch", json, "INVALID_ARGS", "batch requires at least one file path", ["use: aism batch file1.txt file2.txt"]);
  }

  const taxonomyLoad = loadTaxonomyFor("batch", json);
  if (!taxonomyLoad.taxonomy) {
    return taxonomyLoad.error as RobotResponse;
  }

  const results: BatchItemResult[] = [];
  let notFoundFailures = 0;

  for (const file of files) {
    try {
      const text = await readTextFromPath(file);
      const result = scanText(text, taxonomyLoad.taxonomy, options);
      results.push({ path: file, ok: true, result });
    } catch (error) {
      if (isNotFoundError(error)) {
        notFoundFailures += 1;
      }
      results.push({
        path: file,
        ok: false,
        error: error instanceof Error ? error.message : "failed to scan file"
      });
    }
  }

  const succeeded = results.filter((item) => item.ok).length;
  const failed = results.length - succeeded;
  const commandResult: CommandResult = {
    batch: {
      total: results.length,
      succeeded,
      failed,
      results
    }
  };

  if (failed === 0) {
    return ok("batch", json, commandResult);
  }

  if (failed === notFoundFailures) {
    return fail(
      "batch",
      json,
      "NOT_FOUND",
      "one or more input files were not found",
      ["check file paths passed to batch"],
      undefined,
      commandResult
    );
  }

  return fail(
    "batch",
    json,
    "RUNTIME_ERROR",
    "batch completed with one or more failures",
    ["inspect per-file errors in batch results"],
    undefined,
    commandResult
  );
}

function runValidate(args: ParsedArgs, json: boolean): RobotResponse {
  if (args.files.length > 0 || args.extras.length > 0) {
    return fail("validate", json, "INVALID_ARGS", "validate accepts at most one path", ["use: aism validate [taxonomyPath]"]);
  }

  const taxonomyPath = args.commandArg ?? defaultTaxonomyPath();

  try {
    const taxonomy = loadTaxonomy(taxonomyPath) as Taxonomy;
    const counts = taxonomyCounts(taxonomy);
    return ok("validate", json, {
      path: taxonomyPath,
      version: String(taxonomy.version ?? "unknown"),
      counts,
      taxonomy_valid: true
    });
  } catch (error) {
    return taxonomyError("validate", json, error, taxonomyPath);
  }
}

async function run(): Promise<never> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const json = toJsonMode(process.argv.slice(2).includes("--json"));
    return emitAndExit(
      fail(
        "help",
        json,
        "INVALID_ARGS",
        error instanceof Error ? error.message : "invalid arguments",
        ["run: aism help"]
      ),
      false
    );
  }

  const json = toJsonMode(args.json);

  if (args.version) {
    return emitAndExit(ok("version", json, { version: VERSION }), args.quiet);
  }

  if (args.help) {
    const subject = args.command && args.command !== "help" ? args.command : args.commandArg ?? args.extras[0];
    return emitAndExit(ok("help", json, undefined, [helpText(subject)]), args.quiet);
  }

  const command = args.command;
  if (command === null) {
    return emitAndExit(ok("help", json, undefined, [HELP]), args.quiet);
  }

  if (command === "help") {
    return emitAndExit(ok("help", json, undefined, [helpText(args.commandArg ?? args.extras[0])]), args.quiet);
  }

  if (command === "version") {
    return emitAndExit(ok("version", json, { version: VERSION }), args.quiet);
  }

  if (command === "validate") {
    return emitAndExit(runValidate(args, json), args.quiet);
  }

  if (command === "scan") {
    return emitAndExit(await runScan(args, json), args.quiet);
  }

  if (command === "batch") {
    return emitAndExit(await runBatch(args, json), args.quiet);
  }

  return emitAndExit(
    fail("help", json, "INVALID_ARGS", `unknown command: ${command}`, ["valid commands: scan|batch|validate|version|help"]),
    args.quiet
  );
}

run();
