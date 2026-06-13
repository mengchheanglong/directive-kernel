import { pathToFileURL } from "node:url";

import {
  renderRecentResearchBriefMarkdown,
  runRecentResearchBrief,
  type RecentResearchBriefInput,
  type RecentResearchBriefRunOptions,
  type ResearchBriefDepth,
  type ResearchBriefIntent,
} from "../discovery/lib/research-planner/recent-research-brief.ts";

const INTENTS = new Set<ResearchBriefIntent>([
  "auto",
  "factual",
  "product",
  "concept",
  "opinion",
  "how_to",
  "comparison",
  "breaking_news",
  "prediction",
]);

const DEPTHS = new Set<ResearchBriefDepth>(["quick", "default", "deep"]);

export interface RecentResearchBriefCliArgs {
  topic?: string;
  sources?: string[];
  intent?: ResearchBriefIntent;
  depth?: ResearchBriefDepth;
  lookbackDays?: number;
  perSourceLimit?: number;
  totalLimit?: number;
  timeoutMs?: number;
  json: boolean;
  errors: string[];
}

export interface RecentResearchBriefCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const takeValue = (argv: string[], index: number, flag: string): string | undefined => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }
  return value;
};

const parsePositiveInteger = (value: string | undefined, flag: string, errors: string[]): number | undefined => {
  if (!value) {
    errors.push(`Missing value for ${flag}`);
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    errors.push(`${flag} must be a positive integer`);
    return undefined;
  }
  return parsed;
};

export function parseRecentResearchBriefCliArgs(argv: string[]): RecentResearchBriefCliArgs {
  const parsed: RecentResearchBriefCliArgs = { json: false, errors: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--json") {
      parsed.json = true;
      continue;
    }

    const value = takeValue(argv, index, flag);
    if (flag === "--topic") {
      if (!value) {
        parsed.errors.push("Missing value for --topic");
      } else {
        parsed.topic = value;
        index += 1;
      }
      continue;
    }
    if (flag === "--sources") {
      if (!value) {
        parsed.errors.push("Missing value for --sources");
      } else {
        parsed.sources = value.split(",").map((source) => source.trim()).filter(Boolean);
        index += 1;
      }
      continue;
    }
    if (flag === "--intent") {
      if (!value) {
        parsed.errors.push("Missing value for --intent");
      } else if (!INTENTS.has(value as ResearchBriefIntent)) {
        parsed.errors.push(`Unsupported --intent: ${value}`);
        index += 1;
      } else {
        parsed.intent = value as ResearchBriefIntent;
        index += 1;
      }
      continue;
    }
    if (flag === "--depth") {
      if (!value) {
        parsed.errors.push("Missing value for --depth");
      } else if (!DEPTHS.has(value as ResearchBriefDepth)) {
        parsed.errors.push(`Unsupported --depth: ${value}`);
        index += 1;
      } else {
        parsed.depth = value as ResearchBriefDepth;
        index += 1;
      }
      continue;
    }
    if (flag === "--lookback-days") {
      parsed.lookbackDays = parsePositiveInteger(value, flag, parsed.errors);
      if (value) {
        index += 1;
      }
      continue;
    }
    if (flag === "--per-source-limit") {
      parsed.perSourceLimit = parsePositiveInteger(value, flag, parsed.errors);
      if (value) {
        index += 1;
      }
      continue;
    }
    if (flag === "--total-limit") {
      parsed.totalLimit = parsePositiveInteger(value, flag, parsed.errors);
      if (value) {
        index += 1;
      }
      continue;
    }
    if (flag === "--timeout-ms") {
      parsed.timeoutMs = parsePositiveInteger(value, flag, parsed.errors);
      if (value) {
        index += 1;
      }
      continue;
    }

    parsed.errors.push(`Unknown argument: ${flag}`);
  }

  return parsed;
}

export async function handleRecentResearchBriefCli(
  parsed: RecentResearchBriefCliArgs,
  options: Pick<RecentResearchBriefRunOptions, "fetch" | "now"> = {},
): Promise<RecentResearchBriefCliResult> {
  const errors = [...parsed.errors];
  if (!parsed.topic?.trim()) {
    errors.push("Missing required --topic");
  }
  if (errors.length > 0) {
    return {
      stdout: "",
      stderr: `${errors.join("\n")}\n`,
      exitCode: 1,
    };
  }

  const input: RecentResearchBriefInput = {
    topic: parsed.topic!,
    sources: parsed.sources,
    intent: parsed.intent,
    depth: parsed.depth,
    lookbackDays: parsed.lookbackDays,
    requireCitations: true,
  };

  try {
    const result = await runRecentResearchBrief(input, {
      fetch: options.fetch,
      now: options.now,
      timeoutMs: parsed.timeoutMs,
      perSourceLimit: parsed.perSourceLimit,
      totalLimit: parsed.totalLimit,
    });
    const stdout = parsed.json
      ? `${JSON.stringify(result, null, 2)}\n`
      : renderRecentResearchBriefMarkdown(result);
    const hasValidationErrors = result.validation.issues.some((issue) => issue.severity === "error");
    return {
      stdout,
      stderr: "",
      exitCode: hasValidationErrors ? 1 : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown recent research brief failure";
    return {
      stdout: "",
      stderr: `${message}\n`,
      exitCode: 1,
    };
  }
}

const main = async () => {
  const result = await handleRecentResearchBriefCli(
    parseRecentResearchBriefCliArgs(process.argv.slice(2)),
    { fetch: globalThis.fetch },
  );
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
