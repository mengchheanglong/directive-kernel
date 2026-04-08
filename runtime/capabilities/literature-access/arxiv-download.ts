/**
 * Directive-owned arXiv download tool.
 *
 * Adapted from Scientify arxiv-download.ts under the bounded
 * Scientify literature-access tool bundle Runtime proof.
 *
 * Behavior-preserving claims honored:
 * - Same source->PDF fallback chain
 * - Same 3s rate limit between requests
 * - Same directory/file structure
 * - Same tar extraction logic
 *
 * Uses system `tar` command for archive extraction (available on
 * Windows 10+, macOS, and Linux without additional npm dependencies).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";

const RATE_LIMIT_MS = 3000;

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function extractTarGz(tarPath: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("tar", ["xzf", tarPath, "-C", cwd], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// --- Input / Output types ---

export interface ArxivDownloadInput {
  arxiv_ids: string[];
  output_dir?: string;
}

export interface ArxivDownloadItemResult {
  arxiv_id: string;
  success: boolean;
  format: "tex" | "pdf";
  path: string;
  files: string[];
  error?: string;
  fallback_reason?: string;
}

export type ArxivDownloadResult =
  | {
      ok: true;
      output_dir: string;
      total: number;
      successful: number;
      failed: number;
      downloads: ArxivDownloadItemResult[];
    }
  | { ok: false; error: string; message: string };

// --- Internal helpers ---

interface InternalDownloadResult {
  success: boolean;
  format: "tex" | "pdf";
  path: string;
  files: string[];
  error?: string;
  fallbackReason?: string;
}

async function findTexFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findTexFiles(fullPath);
      files.push(...subFiles.map((f) => path.join(entry.name, f)));
    } else if (entry.name.endsWith(".tex")) {
      files.push(entry.name);
    }
  }
  return files;
}

async function downloadPdf(
  arxivId: string,
  outputDir: string,
): Promise<InternalDownloadResult> {
  try {
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return {
        success: false,
        format: "pdf",
        path: "",
        files: [],
        error: `PDF download failed: ${response.status}`,
      };
    }
    const pdfPath = path.join(outputDir, `${arxivId}.pdf`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(pdfPath, buffer);
    return {
      success: true,
      format: "pdf",
      path: pdfPath,
      files: [`${arxivId}.pdf`],
    };
  } catch (error) {
    return {
      success: false,
      format: "pdf",
      path: "",
      files: [],
      error: String(error),
    };
  }
}

async function downloadTexSource(
  arxivId: string,
  outputDir: string,
): Promise<InternalDownloadResult> {
  const paperDir = path.join(outputDir, arxivId);
  await fs.promises.mkdir(paperDir, { recursive: true });

  const srcUrl = `https://arxiv.org/src/${arxivId}`;
  const tarPath = path.join(paperDir, "source.tar.gz");

  try {
    const response = await fetch(srcUrl);
    if (!response.ok) {
      const reason = `Source download failed: HTTP ${response.status} ${response.statusText}`;
      const result = await downloadPdf(arxivId, outputDir);
      return { ...result, fallbackReason: reason };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(tarPath, buffer);

    const isTarGz = buffer[0] === 0x1f && buffer[1] === 0x8b;

    if (isTarGz) {
      await extractTarGz(tarPath, paperDir);
      await fs.promises.unlink(tarPath);

      const files = await findTexFiles(paperDir);
      if (files.length === 0) {
        const reason = "No .tex files found in source archive";
        const result = await downloadPdf(arxivId, outputDir);
        return { ...result, fallbackReason: reason };
      }
      return { success: true, format: "tex", path: paperDir, files };
    } else {
      const texPath = path.join(paperDir, "main.tex");
      await fs.promises.rename(tarPath, texPath);
      return {
        success: true,
        format: "tex",
        path: paperDir,
        files: ["main.tex"],
      };
    }
  } catch (error) {
    const reason = `Source extraction error: ${error instanceof Error ? error.message : String(error)}`;
    const result = await downloadPdf(arxivId, outputDir);
    return { ...result, fallbackReason: reason };
  }
}

// --- Public API ---

export async function arxivDownload(
  input: ArxivDownloadInput,
): Promise<ArxivDownloadResult> {
  const { arxiv_ids, output_dir } = input;

  if (arxiv_ids.length === 0) {
    return {
      ok: false,
      error: "invalid_params",
      message: "arxiv_ids must be a non-empty array",
    };
  }

  const resolvedOutputDir = path.resolve(output_dir ?? "papers");
  await fs.promises.mkdir(resolvedOutputDir, { recursive: true });

  const downloads: ArxivDownloadItemResult[] = [];

  for (let i = 0; i < arxiv_ids.length; i++) {
    const arxivId = arxiv_ids[i];

    // Rate limit: wait before each request (except first)
    if (i > 0) {
      await delay(RATE_LIMIT_MS);
    }

    const result = await downloadTexSource(arxivId, resolvedOutputDir);

    downloads.push({
      arxiv_id: arxivId,
      success: result.success,
      format: result.format,
      path: result.path,
      files: result.files,
      error: result.error,
      fallback_reason: result.fallbackReason,
    });
  }

  const successful = downloads.filter((d) => d.success).length;
  const failed = downloads.filter((d) => !d.success).length;

  return {
    ok: true,
    output_dir: resolvedOutputDir,
    total: arxiv_ids.length,
    successful,
    failed,
    downloads,
  };
}
