/**
 * Directive-owned Unpaywall download tool.
 *
 * Adapted from Scientify unpaywall-download.ts under the bounded
 * Scientify literature-access tool bundle Runtime proof.
 *
 * Behavior-preserving claims honored:
 * - Same DOI lookup -> PDF download chain
 * - Same OA / non-OA classification
 * - Same 100ms rate limit between requests
 * - Same filename sanitization (replace /\: with _)
 * - Same content-type validation for PDFs
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const UNPAYWALL_API = "https://api.unpaywall.org/v2";
const POLITE_POOL_EMAIL = "research@openclaw.ai";
const USER_AGENT = `directive-workspace/1.0 (mailto:${POLITE_POOL_EMAIL})`;
const RATE_LIMIT_MS = 100;
const MAX_DOIS_PER_REQUEST = 20;

// --- Input / Output types ---

export interface UnpaywallDownloadInput {
  dois: string[];
  output_dir?: string;
}

export interface UnpaywallDownloadItemResult {
  doi: string;
  status: "success" | "not_oa" | "no_pdf_url" | "download_failed" | "api_error";
  message: string;
  file_path?: string;
  title?: string;
}

export type UnpaywallDownloadResult =
  | {
      ok: true;
      total: number;
      success: number;
      not_oa: number;
      failed: number;
      output_dir: string;
      results: UnpaywallDownloadItemResult[];
    }
  | { ok: false; error: string; message: string };

// --- Internal types ---

interface UnpaywallApiResponse {
  doi: string;
  is_oa: boolean;
  best_oa_location: {
    url: string;
    url_for_pdf: string | null;
    url_for_landing_page: string | null;
    license: string | null;
  } | null;
  title: string;
  year: number | null;
}

// --- Internal helpers ---

async function downloadPDF(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      return false;
    }

    const buffer = await response.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

// --- Public API ---

export async function unpaywallDownload(
  input: UnpaywallDownloadInput,
): Promise<UnpaywallDownloadResult> {
  const rawDois = input.dois;

  if (!Array.isArray(rawDois) || rawDois.length === 0) {
    return {
      ok: false,
      error: "invalid_input",
      message: "dois must be a non-empty array",
    };
  }

  const dois = rawDois
    .map((d) => String(d).trim())
    .filter((d) => d.length > 0)
    .slice(0, MAX_DOIS_PER_REQUEST);

  const resolvedOutputDir = resolve(input.output_dir ?? "papers");

  try {
    if (!existsSync(resolvedOutputDir)) {
      mkdirSync(resolvedOutputDir, { recursive: true });
    }
  } catch (error) {
    return {
      ok: false,
      error: "filesystem_error",
      message: `Failed to create output directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const results: UnpaywallDownloadItemResult[] = [];
  let successCount = 0;
  let notOACount = 0;
  let failedCount = 0;

  for (const doi of dois) {
    try {
      const apiUrl = `${UNPAYWALL_API}/${encodeURIComponent(doi)}?email=${POLITE_POOL_EMAIL}`;
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!response.ok) {
        results.push({
          doi,
          status: "api_error",
          message: `API error: ${response.status} ${response.statusText}`,
        });
        failedCount++;
        continue;
      }

      const data = (await response.json()) as UnpaywallApiResponse;

      if (!data.is_oa || !data.best_oa_location) {
        results.push({
          doi,
          status: "not_oa",
          message: "Paper is not open access",
          title: data.title,
        });
        notOACount++;
        continue;
      }

      const pdfUrl =
        data.best_oa_location.url_for_pdf || data.best_oa_location.url;
      if (!pdfUrl) {
        results.push({
          doi,
          status: "no_pdf_url",
          message: "No PDF URL available",
          title: data.title,
        });
        failedCount++;
        continue;
      }

      const sanitizedDoi = doi.replace(/[\/\\:]/g, "_");
      const filename = `${sanitizedDoi}.pdf`;
      const outputPath = join(resolvedOutputDir, filename);

      const downloaded = await downloadPDF(pdfUrl, outputPath);

      if (downloaded) {
        results.push({
          doi,
          status: "success",
          message: "Downloaded successfully",
          file_path: outputPath,
          title: data.title,
        });
        successCount++;
      } else {
        results.push({
          doi,
          status: "download_failed",
          message:
            "Failed to download PDF (might be HTML landing page or access denied)",
          title: data.title,
        });
        failedCount++;
      }
    } catch (error) {
      results.push({
        doi,
        status: "api_error",
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      });
      failedCount++;
    }

    // Rate limiting: 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
  }

  return {
    ok: true,
    total: dois.length,
    success: successCount,
    not_oa: notOACount,
    failed: failedCount,
    output_dir: resolvedOutputDir,
    results,
  };
}
