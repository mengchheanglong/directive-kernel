/**
 * Auto-Ingest: domain → GitHub search → filter → operationalization check → pipeline → registry
 *
 * Usage: npx tsx scripts/auto-ingest.ts "<search-query>" [--dry-run]
 * Example: npx tsx scripts/auto-ingest.ts "top open source cybersecurity tools github 2025"
 *
 * --dry-run: Preview operationalization decisions without running pipeline.
 *             Prints all matching repos with their decision classification.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const INTAKE_QUEUE_PATH = path.join(ROOT, "discovery/intake-queue.json");
const GITHUB_API = "https://api.github.com/search/repositories";
const MIN_STARS = 5_000;
const PER_PAGE = 30;
const DELAY_MS = 2_000;

interface GhRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
}

interface IntakeQueue {
  entries: Array<{ source_reference: string }>;
}

interface PipelineResult {
  name: string;
  url: string;
  status: "registered" | "previewed" | "failed" | "skipped";
  reason?: string;
}

function loadIntakeQueue(): IntakeQueue {
  if (!fs.existsSync(INTAKE_QUEUE_PATH)) {
    return { entries: [] };
  }
  const raw = fs.readFileSync(INTAKE_QUEUE_PATH, "utf-8");
  return JSON.parse(raw) as IntakeQueue;
}

function isDuplicate(url: string, queue: IntakeQueue): boolean {
  return queue.entries.some(
    (entry) =>
      entry.source_reference?.toLowerCase() === url.toLowerCase(),
  );
}

async function searchGitHub(query: string): Promise<GhRepo[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(PER_PAGE),
  });
  const url = `${GITHUB_API}?${params}`;

  console.log(`[search] ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "hermes-auto-ingest/1.0",
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub API returned ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { items: GhRepo[] };
  return data.items ?? [];
}

function spawnPipeline(
  name: string,
  url: string,
  dryRun = false,
): Promise<PipelineResult> {
  return new Promise((resolve) => {
    const dryFlag = dryRun ? " --dry-run" : "";
    const cmd = `npx tsx scripts/pipeline.ts "${name}" "${url}" github-repo${dryFlag}`;
    console.log(`[pipeline] ${cmd}`);

    const child = spawn(cmd, {
      cwd: path.resolve(ROOT, "../../systems/directive-kernel"),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`  |> ${text.trimEnd()}`);
      // Inject newline since pipeline output may lack it
      if (!text.endsWith("\n")) process.stdout.write("\n");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      const combined = stdout + stderr;
      if (dryRun && code === 0) {
        resolve({ name, url, status: "previewed" });
      } else if (code === 0 && combined.includes("REGISTERED")) {
        resolve({ name, url, status: "registered" });
      } else if (code === 0) {
        resolve({
          name,
          url,
          status: "failed",
          reason: "pipeline completed but did not register",
        });
      } else {
        const errorLine = stderr
          .split("\n")
          .filter((l) => l.trim())
          .slice(-3)
          .join(" | ");
        resolve({
          name,
          url,
          status: "failed",
          reason: errorLine || `exit code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      resolve({ name, url, status: "failed", reason: err.message });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes("--dry-run");
  const query = rawArgs.filter((a) => a !== "--dry-run").join(" ");
  if (!query) {
    console.error("Usage: npx tsx scripts/auto-ingest.ts \"<search-query>\" [--dry-run]");
    console.error(
      'Example: npx tsx scripts/auto-ingest.ts "top open source devops tools github 2025"',
    );
    process.exit(1);
  }

  const runMode = dryRun ? "DRY-RUN (preview only)" : "LIVE";
  console.log(`=== Hermes Auto-Ingest (${runMode}) ===`);
  console.log(`Domain: ${query}`);
  console.log(`Minimum stars: ${MIN_STARS.toLocaleString()}\n`);

  // 1. Load intake queue for dedup
  const queue = loadIntakeQueue();
  const knownUrls = new Set(
    queue.entries
      .map((e) => e.source_reference?.toLowerCase())
      .filter(Boolean),
  );
  console.log(`[queue] ${knownUrls.size} existing entries in intake queue\n`);

  // 2. Search GitHub
  let repos: GhRepo[];
  try {
    repos = await searchGitHub(query);
  } catch (err) {
    console.error(`[search] FATAL: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[search] Found ${repos.length} repos from GitHub API`);

  // 3. Filter by stars
  const qualified = repos.filter((r) => r.stargazers_count >= MIN_STARS);
  console.log(
    `[filter] ${qualified.length}/${repos.length} repos have >= ${MIN_STARS.toLocaleString()} stars`,
  );

  // 3b. Filter by callability — only ingest packages, CLI tools, and frameworks
  // Skip: documentation, awesome-lists, reference implementations, research papers
  const CALLABLE_KEYWORDS = [
    "cli", "tool", "framework", "library", "sdk", "package",
    "engine", "server", "daemon", "scraper", "browser", "agent",
    "compiler", "runtime", "parser", "generator", "converter",
  ];
  const SKIP_PATTERNS = [
    /awesome/i, /interview/i, /checklist/i, /roadmap/i,
    /tutorial/i, /guide/i, /handbook/i, /paper/i, /survey/i,
    /course/i, /book/i, /notes/i, /wiki/i, /list/i,
    /resources/i, /exercises/i, /reference/i,
  ];

  const callable = qualified.filter((r) => {
    const desc = (r.description || "").toLowerCase();
    const name = r.full_name.toLowerCase();
    // Must have at least one callable keyword
    const hasCallableKeyword = CALLABLE_KEYWORDS.some((kw) => desc.includes(kw) || name.includes(kw));
    // Must not match any skip pattern
    const isSkipPattern = SKIP_PATTERNS.some((pat) => pat.test(desc) || pat.test(name));
    return hasCallableKeyword && !isSkipPattern;
  });

  const skippedNonCallable = qualified.length - callable.length;
  if (skippedNonCallable > 0) {
    console.log(`[callable] ${callable.length}/${qualified.length} repos are callable (skipped ${skippedNonCallable} docs/lists/references)`);
  }

  if (callable.length === 0) {
    console.log("\nNo callable repos found. Exiting.");
    process.exit(0);
  }

  // 4. Deduplicate
  const newRepos = callable.filter(
    (r) => !knownUrls.has(r.html_url.toLowerCase()),
  );
  const skipped = callable.length - newRepos.length;
  if (skipped > 0) {
    console.log(`[dedup] Skipped ${skipped} duplicate(s)`);
  }

  if (newRepos.length === 0) {
    console.log("\nAll qualifying repos already in queue. Exiting.");
    process.exit(0);
  }

  // 5. Run pipeline for each
  const modeLabel = dryRun ? "previewing" : "Processing";
  console.log(
    `\n[pipeline] ${modeLabel} ${newRepos.length} new repo(s)...\n`,
  );

  let registered = 0;
  let previewed = 0;
  let failed = 0;

  for (let i = 0; i < newRepos.length; i++) {
    const repo = newRepos[i];
    const label = repo.description?.slice(0, 60) ?? repo.full_name;

    console.log(
      `\n--- [${i + 1}/${newRepos.length}] ${repo.full_name} (${repo.stargazers_count.toLocaleString()} ★) ---`,
    );
    console.log(`  ${label}`);
    console.log(`  ${repo.html_url}`);

    const result = await spawnPipeline(repo.full_name, repo.html_url, dryRun);

    if (result.status === "registered") {
      registered++;
      console.log(`  ✓ REGISTERED`);
    } else if (result.status === "previewed") {
      previewed++;
      console.log(`  ✓ PREVIEWED`);
    } else {
      failed++;
      console.log(`  ✗ FAILED: ${result.reason ?? "unknown"}`);
    }

    // Delay between pipeline runs to avoid GitHub rate limiting
    if (i < newRepos.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 6. Summary
  const summaryTitle = dryRun ? "AUTO-INGEST SUMMARY (DRY-RUN)" : "AUTO-INGEST SUMMARY";
  console.log("\n══════════════════════════════════════════════");
  console.log(`  ${summaryTitle}`);
  console.log("══════════════════════════════════════════════");
  console.log(`Mode:           ${dryRun ? "DRY-RUN — no pipelines executed" : "LIVE"}`);
  console.log(`Query:          ${query}`);
  console.log(`Repos found:    ${repos.length}`);
  console.log(`After ≥${MIN_STARS.toLocaleString()}★ filter: ${qualified.length}`);
  console.log(`Callable:       ${callable.length} (skipped ${qualified.length - callable.length} docs/lists)`);
  console.log(`Duplicates skipped: ${skipped}`);
  console.log(`Submitted:      ${newRepos.length}`);
  if (!dryRun) {
    console.log(`Registered:     ${registered}`);
    console.log(`Failed:         ${failed}`);
  } else {
    console.log(`Previewed:      ${previewed}`);
    console.log(`Failed:         ${failed}`);
    console.log(`Decision previewed for all ${newRepos.length} repos (see pipeline output above).`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
