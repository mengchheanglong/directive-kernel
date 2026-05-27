import * as fs from "node:fs";
import * as path from "node:path";
import { withPerFileLock } from "../../shared/lib/file-io.ts";

export interface ArchiveResult {
  archivedCount: number;
  archivedBasenames: string[];
  bytesMoved: number;
}

export async function archiveRunRecords(
  directiveRoot: string,
  opts: { maxAgeDays: number; now?: Date },
): Promise<ArchiveResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - opts.maxAgeDays * 86_400_000);
  const activeDir = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");
  if (!fs.existsSync(activeDir)) return { archivedCount: 0, archivedBasenames: [], bytesMoved: 0 };

  const archivedBasenames: string[] = [];
  let bytesMoved = 0;

  for (const entry of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const sourcePath = path.join(activeDir, entry.name);
    let record: { receivedAt?: string };
    try { record = JSON.parse(fs.readFileSync(sourcePath, "utf8")); } catch { continue; }
    if (!record.receivedAt) continue;
    const receivedAt = new Date(record.receivedAt);
    if (receivedAt >= cutoff) continue;

    const yyyy = String(receivedAt.getUTCFullYear());
    const mm = String(receivedAt.getUTCMonth() + 1).padStart(2, "0");
    const bucket = path.join(directiveRoot, "archive", yyyy, mm);
    fs.mkdirSync(bucket, { recursive: true });
    const destPath = path.join(bucket, entry.name);
    if (fs.existsSync(destPath)) {
      throw new Error(`archive_collision: ${entry.name} already exists in archive/${yyyy}/${mm}`);
    }
    const stat = fs.statSync(sourcePath);
    await withPerFileLock(sourcePath, () => {
      fs.renameSync(sourcePath, destPath);
    });
    archivedBasenames.push(entry.name);
    bytesMoved += stat.size;
    process.stderr.write(`archived: ${entry.name} → archive/${yyyy}/${mm}\n`);
  }

  return { archivedCount: archivedBasenames.length, archivedBasenames, bytesMoved };
}

function peekLastLineTimestamp(filePath: string): string | null {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) return null;
    const readSize = Math.min(65536, stat.size);
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
    const content = buf.toString("utf8");
    const startFromBeginning = stat.size === readSize;
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const effectiveLines = startFromBeginning ? lines : lines.slice(1);
    if (effectiveLines.length === 0) return null;
    const lastLine = effectiveLines[effectiveLines.length - 1];
    try {
      const parsed = JSON.parse(lastLine);
      return parsed.timestamp ?? parsed.receivedAt ?? parsed.recordedAt ?? null;
    } catch { return null; }
  } finally {
    fs.closeSync(fd);
  }
}

export async function rotateDecisionPolicyLedger(
  directiveRoot: string,
  opts: { now?: Date } = {},
): Promise<{ rotated: boolean; rotatedTo?: string }> {
  const now = opts.now ?? new Date();
  const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");
  if (!fs.existsSync(activePath)) return { rotated: false };
  const stat = fs.statSync(activePath);
  if (stat.size === 0) return { rotated: false };

  const result = await withPerFileLock(activePath, async () => {
    const lastTs = peekLastLineTimestamp(activePath);
    const lastDate = lastTs ? new Date(lastTs) : null;
    if (!lastDate) return { rotated: false };
    const sameMonth = lastDate.getUTCFullYear() === now.getUTCFullYear()
      && lastDate.getUTCMonth() === now.getUTCMonth();
    if (sameMonth) return { rotated: false };

    const yyyy = String(lastDate.getUTCFullYear());
    const mm = String(lastDate.getUTCMonth() + 1).padStart(2, "0");
    const rotatedPath = path.join(directiveRoot, "engine", `decision-policy-ledger.${yyyy}-${mm}.jsonl`);
    if (fs.existsSync(rotatedPath)) {
      throw new Error(`rotate_collision: ${path.basename(rotatedPath)} already exists`);
    }
    fs.renameSync(activePath, rotatedPath);
    fs.writeFileSync(activePath, "");
    return { rotated: true, rotatedTo: path.basename(rotatedPath) };
  });
  return result;
}

export interface KernelStorageSummary {
  activeRunRecords: number;
  archivedRunRecords: number;
  activeLedgerBytes: number;
  rotatedLedgerBytes: number;
  rotatedLedgerSegments: number;
}

export function summarizeKernelStorage(directiveRoot: string): KernelStorageSummary {
  const activeRunDir = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");
  let activeRunRecords = 0;
  if (fs.existsSync(activeRunDir)) {
    activeRunRecords = fs.readdirSync(activeRunDir).filter((f) => f.endsWith(".json")).length;
  }

  const archiveDir = path.join(directiveRoot, "archive");
  let archivedRunRecords = 0;
  if (fs.existsSync(archiveDir)) {
    for (const yearEntry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
      if (!yearEntry.isDirectory()) continue;
      const yearDir = path.join(archiveDir, yearEntry.name);
      for (const monthEntry of fs.readdirSync(yearDir, { withFileTypes: true })) {
        if (!monthEntry.isDirectory()) continue;
        const monthDir = path.join(yearDir, monthEntry.name);
        archivedRunRecords += fs.readdirSync(monthDir).filter((f) => f.endsWith(".json")).length;
      }
    }
  }

  const engineDir = path.join(directiveRoot, "engine");
  const activeLedgerPath = path.join(engineDir, "decision-policy-ledger.jsonl");
  let activeLedgerBytes = 0;
  if (fs.existsSync(activeLedgerPath)) {
    activeLedgerBytes = fs.statSync(activeLedgerPath).size;
  }

  let rotatedLedgerBytes = 0;
  let rotatedLedgerSegments = 0;
  if (fs.existsSync(engineDir)) {
    const rotatedPattern = /^decision-policy-ledger\.\d{4}-\d{2}\.jsonl$/;
    for (const f of fs.readdirSync(engineDir)) {
      if (!rotatedPattern.test(f)) continue;
      rotatedLedgerSegments += 1;
      try { rotatedLedgerBytes += fs.statSync(path.join(engineDir, f)).size; } catch { /* skip */ }
    }
  }

  return { activeRunRecords, archivedRunRecords, activeLedgerBytes, rotatedLedgerBytes, rotatedLedgerSegments };
}
