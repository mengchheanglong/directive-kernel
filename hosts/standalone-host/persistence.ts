import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import type { ResolvedStandaloneHostPersistence } from "./config.ts";

type JsonValue = Record<string, unknown>;

export type StandaloneHostPersistenceSnapshot = {
  mode: ResolvedStandaloneHostPersistence["mode"];
  sqlitePath: string | null;
  experimentalRuntime: boolean;
};

export type StandaloneHostPersistenceLedger = {
  describe(): StandaloneHostPersistenceSnapshot;
  recordJsonArtifact(
    filePath: string,
    value: unknown,
    artifactKind?: string,
  ): void;
  recordTextArtifact(
    filePath: string,
    content: string,
    artifactKind?: string,
  ): void;
  recordRuntimeStarted(event: {
    recordedAt: string;
    directiveRoot: string;
    runtimeArtifactsRoot: string;
    host: string;
    port: number;
    origin: string;
    authMode: string;
  }): void;
  recordRuntimeRequest(event: {
    recordedAt: string;
    method: string;
    path: string;
    query: string;
    routeId: string;
    statusCode: number;
    durationMs: number;
    error: string | null;
  }): void;
  recordRuntimeStopped(event: {
    recordedAt: string;
    requestCount: number;
  }): void;
  close(): void;
};

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function createNoopLedger(
  persistence: ResolvedStandaloneHostPersistence,
): StandaloneHostPersistenceLedger {
  return {
    describe() {
      return {
        mode: persistence.mode,
        sqlitePath: null,
        experimentalRuntime: false,
      };
    },
    recordJsonArtifact() {},
    recordTextArtifact() {},
    recordRuntimeStarted() {},
    recordRuntimeRequest() {},
    recordRuntimeStopped() {},
    close() {},
  };
}

function createSqliteLedger(
  persistence: Extract<
    ResolvedStandaloneHostPersistence,
    { mode: "filesystem_and_sqlite" }
  >,
): StandaloneHostPersistenceLedger {
  const sqlitePath = normalizeAbsolutePath(persistence.sqlitePath);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const sqlite = new DatabaseSync(sqlitePath);
  let currentSessionId: number | null = null;
  let closed = false;

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS persistence_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      directive_root TEXT NOT NULL,
      runtime_artifacts_root TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      origin TEXT NOT NULL,
      auth_mode TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_request_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      recorded_at TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      query TEXT NOT NULL,
      route_id TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      error TEXT,
      FOREIGN KEY (session_id) REFERENCES runtime_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS runtime_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      event_type TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES runtime_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS discovery_queue_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      queue_path TEXT NOT NULL,
      updated_at TEXT,
      entry_count INTEGER NOT NULL,
      queue_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifact_writes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      artifact_kind TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      byte_length INTEGER NOT NULL
    );
  `);

  sqlite.prepare(`
    INSERT INTO persistence_meta(key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run("schema_version", "1");
  sqlite.prepare(`
    INSERT INTO persistence_meta(key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run("persistence_mode", persistence.mode);

  const insertRuntimeSession = sqlite.prepare(`
    INSERT INTO runtime_sessions(
      started_at,
      directive_root,
      runtime_artifacts_root,
      host,
      port,
      origin,
      auth_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateRuntimeSessionStop = sqlite.prepare(`
    UPDATE runtime_sessions
    SET stopped_at = ?
    WHERE id = ?
  `);
  const insertRuntimeRequest = sqlite.prepare(`
    INSERT INTO runtime_request_log(
      session_id,
      recorded_at,
      method,
      path,
      query,
      route_id,
      status_code,
      duration_ms,
      error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRuntimeEvent = sqlite.prepare(`
    INSERT INTO runtime_events(
      session_id,
      event_type,
      recorded_at,
      payload_json
    )
    VALUES (?, ?, ?, ?)
  `);
  const insertQueueSnapshot = sqlite.prepare(`
    INSERT INTO discovery_queue_snapshots(
      recorded_at,
      queue_path,
      updated_at,
      entry_count,
      queue_json
    )
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertArtifactWrite = sqlite.prepare(`
    INSERT INTO artifact_writes(
      recorded_at,
      artifact_path,
      artifact_kind,
      content_sha256,
      byte_length
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  function recordArtifactWrite(
    filePath: string,
    artifactKind: string,
    content: string,
  ) {
    insertArtifactWrite.run(
      new Date().toISOString(),
      normalizeAbsolutePath(filePath),
      artifactKind,
      sha256(content),
      Buffer.byteLength(content, "utf8"),
    );
  }

  return {
    describe() {
      return {
        mode: persistence.mode,
        sqlitePath,
        experimentalRuntime: true,
      };
    },
    recordJsonArtifact(filePath, value, artifactKind = "json_artifact") {
      const serialized = JSON.stringify(value, null, 2);
      recordArtifactWrite(filePath, artifactKind, serialized);

      if (normalizeAbsolutePath(filePath).endsWith("/discovery/intake-queue.json")) {
        const queue = value as JsonValue & {
          updatedAt?: string;
          entries?: unknown[];
        };
        insertQueueSnapshot.run(
          new Date().toISOString(),
          normalizeAbsolutePath(filePath),
          typeof queue.updatedAt === "string" ? queue.updatedAt : null,
          Array.isArray(queue.entries) ? queue.entries.length : 0,
          serialized,
        );
      }
    },
    recordTextArtifact(filePath, content, artifactKind = "text_artifact") {
      recordArtifactWrite(filePath, artifactKind, content);
    },
    recordRuntimeStarted(event) {
      const result = insertRuntimeSession.run(
        event.recordedAt,
        normalizeAbsolutePath(event.directiveRoot),
        normalizeAbsolutePath(event.runtimeArtifactsRoot),
        event.host,
        event.port,
        event.origin,
        event.authMode,
      );
      currentSessionId = Number(result.lastInsertRowid);
      insertRuntimeEvent.run(
        currentSessionId,
        "started",
        event.recordedAt,
        JSON.stringify({
          directiveRoot: normalizeAbsolutePath(event.directiveRoot),
          runtimeArtifactsRoot: normalizeAbsolutePath(event.runtimeArtifactsRoot),
          host: event.host,
          port: event.port,
          origin: event.origin,
          authMode: event.authMode,
        }),
      );
    },
    recordRuntimeRequest(event) {
      insertRuntimeRequest.run(
        currentSessionId,
        event.recordedAt,
        event.method,
        event.path,
        event.query,
        event.routeId,
        event.statusCode,
        event.durationMs,
        event.error,
      );
    },
    recordRuntimeStopped(event) {
      if (currentSessionId !== null) {
        updateRuntimeSessionStop.run(event.recordedAt, currentSessionId);
      }
      insertRuntimeEvent.run(
        currentSessionId,
        "stopped",
        event.recordedAt,
        JSON.stringify({
          requestCount: event.requestCount,
        }),
      );
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      sqlite.close();
    },
  };
}

export function createStandaloneHostPersistenceLedger(input: {
  persistence?: ResolvedStandaloneHostPersistence;
}): StandaloneHostPersistenceLedger {
  const persistence =
    input.persistence ??
    ({
      mode: "filesystem",
      experimentalRuntime: false,
      sqlitePath: null,
    } satisfies ResolvedStandaloneHostPersistence);

  if (persistence.mode === "filesystem") {
    return createNoopLedger(persistence);
  }

  return createSqliteLedger(persistence);
}
