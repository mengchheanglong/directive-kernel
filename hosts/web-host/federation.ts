import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

const FEDERATION_CONFIG_FILENAME = "kernel-federation.config.json";

export type FederationAuthConfig =
  | {
      mode?: "none";
    }
  | {
      mode: "static_bearer";
      bearerToken?: string;
      bearerTokenEnvName?: string;
    };

export type FederationTargetConfig = {
  name: string;
  url: string;
  auth?: FederationAuthConfig;
};

export type FederationConfig = {
  roots: FederationTargetConfig[];
};

export type FederationRootSnapshot = {
  name: string;
  url: string;
  authMode: "none" | "static_bearer";
  ok: boolean;
  snapshot: Record<string, unknown> | null;
  operatorInbox: Record<string, unknown> | null;
  runtimeStatus: Record<string, unknown> | null;
  failedReads: string[];
  error: string | null;
};

export type FederationSnapshotResponse = {
  configured: boolean;
  configPath: string | null;
  generatedAt: string;
  summary: {
    totalRoots: number;
    reachableRoots: number;
    failedRoots: number;
    totalQueueEntries: number;
    totalEngineRuns: number;
    totalActionableInboxEntries: number;
  };
  roots: FederationRootSnapshot[];
};

type RemoteReadKey = "snapshot" | "operatorInbox" | "runtimeStatus";

function readOptionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName}_must_be_non_empty_string`);
  }
  return value.trim();
}

function normalizeRootUrl(value: string) {
  const normalized = new URL(value);
  if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
    throw new Error("federation_root_url_must_use_http_or_https");
  }
  normalized.pathname = normalized.pathname.replace(/\/+$/u, "");
  normalized.search = "";
  normalized.hash = "";
  return normalized.toString().replace(/\/$/u, "");
}

export function resolveFederationConfigPath(directiveRoot: string) {
  return path.join(normalizeAbsolutePath(directiveRoot), FEDERATION_CONFIG_FILENAME);
}

export function readFederationConfig(directiveRoot: string): {
  configPath: string;
  config: FederationConfig | null;
} {
  const configPath = resolveFederationConfigPath(directiveRoot);
  if (!fs.existsSync(configPath)) {
    return {
      configPath,
      config: null,
    };
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    roots?: unknown;
  };
  if (!Array.isArray(parsed.roots)) {
    throw new Error("federation_config_roots_must_be_array");
  }

  const roots: FederationTargetConfig[] = parsed.roots.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`federation_config_roots_${index}_must_be_object`);
    }
    const entry = value as Record<string, unknown>;
    const name = readOptionalString(entry.name, `federation_config_roots_${index}_name`);
    const url = readOptionalString(entry.url, `federation_config_roots_${index}_url`);
    if (!name || !url) {
      throw new Error(`federation_config_roots_${index}_missing_name_or_url`);
    }

    let auth: FederationAuthConfig | undefined;
    if (entry.auth !== undefined) {
      if (!entry.auth || typeof entry.auth !== "object" || Array.isArray(entry.auth)) {
        throw new Error(`federation_config_roots_${index}_auth_must_be_object`);
      }
      const authValue = entry.auth as Record<string, unknown>;
      const mode = readOptionalString(authValue.mode, `federation_config_roots_${index}_auth_mode`) ?? "none";
      if (mode === "none") {
        auth = { mode: "none" };
      } else if (mode === "static_bearer") {
        const bearerToken = readOptionalString(
          authValue.bearerToken,
          `federation_config_roots_${index}_auth_bearerToken`,
        );
        const bearerTokenEnvName = readOptionalString(
          authValue.bearerTokenEnvName,
          `federation_config_roots_${index}_auth_bearerTokenEnvName`,
        );
        if (bearerToken && bearerTokenEnvName) {
          throw new Error(`federation_config_roots_${index}_auth_must_not_define_both_token_and_env`);
        }
        auth = {
          mode: "static_bearer",
          ...(bearerToken ? { bearerToken } : {}),
          ...(bearerTokenEnvName ? { bearerTokenEnvName } : {}),
        };
      } else {
        throw new Error(`federation_config_roots_${index}_auth_mode_invalid`);
      }
    }

    return {
      name,
      url: normalizeRootUrl(url),
      ...(auth ? { auth } : {}),
    };
  });

  const names = new Set<string>();
  for (const root of roots) {
    const lowered = root.name.toLowerCase();
    if (names.has(lowered)) {
      throw new Error(`federation_config_duplicate_root_name:${root.name}`);
    }
    names.add(lowered);
  }

  return {
    configPath,
    config: { roots },
  };
}

function resolveAuthHeader(auth: FederationAuthConfig | undefined) {
  if (!auth || auth.mode === "none" || auth.mode === undefined) {
    return null;
  }
  const bearerAuth = auth as Extract<FederationAuthConfig, { mode: "static_bearer" }>;
  const token = bearerAuth.bearerToken
    ?? (bearerAuth.bearerTokenEnvName ? process.env[bearerAuth.bearerTokenEnvName] : undefined);
  if (!token) {
    throw new Error("federation_auth_token_missing");
  }
  return `Bearer ${token}`;
}

async function fetchFederationJson(
  root: FederationTargetConfig,
  relativePath: string,
): Promise<Record<string, unknown>> {
  const headers = new Headers();
  const authHeader = resolveAuthHeader(root.auth);
  if (authHeader) {
    headers.set("authorization", authHeader);
  }

  const response = await fetch(`${root.url}${relativePath}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }
  const body = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("federation_remote_payload_invalid");
  }
  return body as Record<string, unknown>;
}

function readNestedNumber(
  body: Record<string, unknown> | null,
  pathSegments: readonly string[],
) {
  let current: unknown = body;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return 0;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : 0;
}

async function readOneFederatedRoot(root: FederationTargetConfig): Promise<FederationRootSnapshot> {
  const reads: Array<{
    key: RemoteReadKey;
    path: string;
  }> = [
    { key: "snapshot", path: "/api/snapshot" },
    { key: "operatorInbox", path: "/api/operator-decision-inbox" },
    { key: "runtimeStatus", path: "/api/runtime/status" },
  ];

  const settled = await Promise.allSettled(
    reads.map(async (entry) => ({
      key: entry.key,
      value: await fetchFederationJson(root, entry.path),
    })),
  );

  const result: FederationRootSnapshot = {
    name: root.name,
    url: root.url,
    authMode: root.auth?.mode === "static_bearer" ? "static_bearer" : "none",
    ok: true,
    snapshot: null,
    operatorInbox: null,
    runtimeStatus: null,
    failedReads: [],
    error: null,
  };

  settled.forEach((entry, index) => {
    const key = reads[index]!.key;
    if (entry.status === "fulfilled") {
      result[key] = entry.value.value;
      return;
    }
    result.ok = false;
    result.failedReads.push(key);
    if (!result.error) {
      result.error = String(entry.reason instanceof Error ? entry.reason.message : entry.reason);
    }
  });

  return result;
}

export async function readFederationSnapshot(
  directiveRoot: string,
): Promise<FederationSnapshotResponse> {
  const { configPath, config } = readFederationConfig(directiveRoot);
  const generatedAt = new Date().toISOString();
  if (!config) {
    return {
      configured: false,
      configPath: null,
      generatedAt,
      summary: {
        totalRoots: 0,
        reachableRoots: 0,
        failedRoots: 0,
        totalQueueEntries: 0,
        totalEngineRuns: 0,
        totalActionableInboxEntries: 0,
      },
      roots: [],
    };
  }

  const roots = await Promise.all(config.roots.map((root) => readOneFederatedRoot(root)));
  return {
    configured: true,
    configPath,
    generatedAt,
    summary: {
      totalRoots: roots.length,
      reachableRoots: roots.filter((root) => root.ok).length,
      failedRoots: roots.filter((root) => !root.ok).length,
      totalQueueEntries: roots.reduce(
        (sum, root) => sum + readNestedNumber(root.snapshot, ["queue", "totalEntries"]),
        0,
      ),
      totalEngineRuns: roots.reduce(
        (sum, root) => sum + readNestedNumber(root.snapshot, ["engineRuns", "totalRuns"]),
        0,
      ),
      totalActionableInboxEntries: roots.reduce(
        (sum, root) => sum + readNestedNumber(root.operatorInbox, ["summary", "totalActionableEntries"]),
        0,
      ),
    },
    roots,
  };
}
