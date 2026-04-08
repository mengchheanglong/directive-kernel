import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

type JsonValue = Record<string, unknown>;

export const STANDALONE_HOST_CONFIG_MODE = "standalone_reference_api_host";
export const DEFAULT_STANDALONE_HOST_SERVER_HOST = "127.0.0.1";
export const DEFAULT_STANDALONE_HOST_SERVER_PORT = 8787;
export const DEFAULT_STANDALONE_RUNTIME_ARTIFACTS_RELATIVE_ROOT =
  "runtime/standalone-host";
export const DEFAULT_STANDALONE_HOST_PROTECTED_ROUTE_PREFIXES = ["/api/"] as const;
export const DEFAULT_STANDALONE_HOST_PERSISTENCE_SQLITE_FILENAME =
  "standalone-host.sqlite";

export type ResolvedStandaloneHostAuth =
  | {
      mode: "none";
      protectedRoutePrefixes: string[];
    }
  | {
      mode: "static_bearer";
      bearerToken: string;
      bearerTokenSource: "config" | "env" | "override";
      protectedRoutePrefixes: string[];
    };

export type ResolvedStandaloneHostPersistence =
  | {
      mode: "filesystem";
      sqlitePath: null;
      experimentalRuntime: false;
    }
  | {
      mode: "filesystem_and_sqlite";
      sqlitePath: string;
      sqlitePathSource: "default" | "config" | "override";
      experimentalRuntime: true;
    };

export type StandaloneHostConfig = {
  mode?: string;
  directiveRoot: string;
  receivedAt?: string;
  unresolvedGapIds?: string[];
  initialQueue?: JsonValue;
  server?: {
    host?: string;
    port?: number;
  };
  runtimeArtifacts?: {
    relativeRoot?: string;
    writeStatusFile?: boolean;
    writeAccessLog?: boolean;
    writeBootLog?: boolean;
  };
  auth?: {
    mode?: "none" | "static_bearer";
    bearerToken?: string;
    bearerTokenEnvName?: string;
  };
  persistence?: {
    mode?: "filesystem" | "filesystem_and_sqlite";
    sqlitePath?: string;
  };
};

export type ResolvedStandaloneHostConfig = {
  configPath: string | null;
  mode: typeof STANDALONE_HOST_CONFIG_MODE;
  directiveRoot: string;
  receivedAt?: string;
  unresolvedGapIds: string[];
  initialQueue?: JsonValue;
  server: {
    host: string;
    port: number;
  };
  auth: ResolvedStandaloneHostAuth;
  persistence: ResolvedStandaloneHostPersistence;
  runtimeArtifacts: {
    root: string;
    relativeRoot: string;
    writeStatusFile: boolean;
    writeAccessLog: boolean;
    writeBootLog: boolean;
  };
};

export type StandaloneHostConfigOverrides = {
  directiveRoot?: string;
  receivedAt?: string;
  unresolvedGapIds?: string[];
  host?: string;
  port?: number;
  authBearerToken?: string;
  persistenceSqlitePath?: string;
};

function assertRecord(value: unknown, fieldName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function readRequiredString(value: unknown, fieldName: string) {
  const normalized = readOptionalString(value, fieldName);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function readStringArray(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((entry, index) =>
    readRequiredString(entry, `${fieldName}[${index}]`),
  );
}

function readOptionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

function readOptionalPort(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < 0
    || value > 65535
  ) {
    throw new Error(`${fieldName} must be an integer between 0 and 65535`);
  }
  return value;
}

function readOptionalJsonObject(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return assertRecord(value, fieldName);
}

function resolveStandaloneHostAuth(
  value: unknown,
  fieldName: string,
): ResolvedStandaloneHostAuth {
  const auth = readOptionalJsonObject(value, fieldName) ?? {};
  const mode = readOptionalString(auth.mode, `${fieldName}.mode`) ?? "none";
  const protectedRoutePrefixes = [...DEFAULT_STANDALONE_HOST_PROTECTED_ROUTE_PREFIXES];

  if (mode === "none") {
    return {
      mode,
      protectedRoutePrefixes,
    };
  }

  if (mode !== "static_bearer") {
    throw new Error(`${fieldName}.mode must be one of: none, static_bearer`);
  }

  const bearerToken = readOptionalString(
    auth.bearerToken,
    `${fieldName}.bearerToken`,
  );
  const bearerTokenEnvName = readOptionalString(
    auth.bearerTokenEnvName,
    `${fieldName}.bearerTokenEnvName`,
  );

  if (bearerToken && bearerTokenEnvName) {
    throw new Error(
      `${fieldName} must provide either bearerToken or bearerTokenEnvName, not both`,
    );
  }

  if (bearerToken) {
    return {
      mode,
      bearerToken,
      bearerTokenSource: "config",
      protectedRoutePrefixes,
    };
  }

  if (bearerTokenEnvName) {
    const tokenFromEnv = readRequiredString(
      process.env[bearerTokenEnvName],
      `process.env.${bearerTokenEnvName}`,
    );
    return {
      mode,
      bearerToken: tokenFromEnv,
      bearerTokenSource: "env",
      protectedRoutePrefixes,
    };
  }

  throw new Error(
    `${fieldName} requires bearerToken or bearerTokenEnvName when mode is static_bearer`,
  );
}

function resolveStandaloneHostPersistence(
  value: unknown,
  fieldName: string,
  directiveRoot: string,
  runtimeArtifactsRelativeRoot: string,
): ResolvedStandaloneHostPersistence {
  const persistence = readOptionalJsonObject(value, fieldName) ?? {};
  const mode = readOptionalString(persistence.mode, `${fieldName}.mode`) ?? "filesystem";

  if (mode === "filesystem") {
    return {
      mode,
      sqlitePath: null,
      experimentalRuntime: false,
    };
  }

  if (mode !== "filesystem_and_sqlite") {
    throw new Error(
      `${fieldName}.mode must be one of: filesystem, filesystem_and_sqlite`,
    );
  }

  const sqlitePath = readOptionalString(
    persistence.sqlitePath,
    `${fieldName}.sqlitePath`,
  );
  const defaultSqlitePath = normalizeAbsolutePath(
    path.resolve(
      directiveRoot,
      runtimeArtifactsRelativeRoot,
      DEFAULT_STANDALONE_HOST_PERSISTENCE_SQLITE_FILENAME,
    ),
  );

  return {
    mode,
    sqlitePath: sqlitePath
      ? normalizeAbsolutePath(path.resolve(directiveRoot, sqlitePath))
      : defaultSqlitePath,
    sqlitePathSource: sqlitePath ? "config" : "default",
    experimentalRuntime: true,
  };
}

export function resolveStandaloneHostConfig(
  input: StandaloneHostConfig,
  options?: {
    configPath?: string | null;
    baseDir?: string;
  },
): ResolvedStandaloneHostConfig {
  const config = assertRecord(input, "standaloneHostConfig");
  const baseDir = options?.baseDir
    ? path.resolve(options.baseDir)
    : process.cwd();

  const mode = readOptionalString(config.mode, "mode");
  if (mode && mode !== STANDALONE_HOST_CONFIG_MODE) {
    throw new Error(
      `mode must be ${STANDALONE_HOST_CONFIG_MODE} when provided`,
    );
  }

  const directiveRoot = normalizeAbsolutePath(
    path.resolve(baseDir, readRequiredString(config.directiveRoot, "directiveRoot")),
  );
  const server = readOptionalJsonObject(config.server, "server") ?? {};
  const runtimeArtifacts =
    readOptionalJsonObject(config.runtimeArtifacts, "runtimeArtifacts") ?? {};

  const relativeRoot =
    readOptionalString(runtimeArtifacts.relativeRoot, "runtimeArtifacts.relativeRoot")
    ?? DEFAULT_STANDALONE_RUNTIME_ARTIFACTS_RELATIVE_ROOT;

  return {
    configPath: options?.configPath ?? null,
    mode: STANDALONE_HOST_CONFIG_MODE,
    directiveRoot,
    receivedAt: readOptionalString(config.receivedAt, "receivedAt"),
    unresolvedGapIds:
      readStringArray(config.unresolvedGapIds, "unresolvedGapIds") ?? [],
    initialQueue: readOptionalJsonObject(config.initialQueue, "initialQueue"),
    server: {
      host:
        readOptionalString(server.host, "server.host")
        ?? DEFAULT_STANDALONE_HOST_SERVER_HOST,
      port:
        readOptionalPort(server.port, "server.port")
        ?? DEFAULT_STANDALONE_HOST_SERVER_PORT,
    },
    auth: resolveStandaloneHostAuth(config.auth, "auth"),
    persistence: resolveStandaloneHostPersistence(
      config.persistence,
      "persistence",
      directiveRoot,
      relativeRoot,
    ),
    runtimeArtifacts: {
      relativeRoot,
      root: normalizeAbsolutePath(path.resolve(directiveRoot, relativeRoot)),
      writeStatusFile:
        readOptionalBoolean(
          runtimeArtifacts.writeStatusFile,
          "runtimeArtifacts.writeStatusFile",
        ) ?? true,
      writeAccessLog:
        readOptionalBoolean(
          runtimeArtifacts.writeAccessLog,
          "runtimeArtifacts.writeAccessLog",
        ) ?? true,
      writeBootLog:
        readOptionalBoolean(
          runtimeArtifacts.writeBootLog,
          "runtimeArtifacts.writeBootLog",
        ) ?? true,
    },
  };
}

export function loadStandaloneHostConfig(configPath: string) {
  const absoluteConfigPath = normalizeAbsolutePath(configPath);
  const parsed = JSON.parse(
    fs.readFileSync(absoluteConfigPath, "utf8").replace(/^\uFEFF/u, ""),
  ) as StandaloneHostConfig;

  return resolveStandaloneHostConfig(parsed, {
    configPath: absoluteConfigPath,
    baseDir: path.dirname(absoluteConfigPath),
  });
}

export function applyStandaloneHostConfigOverrides(
  config: ResolvedStandaloneHostConfig,
  overrides: StandaloneHostConfigOverrides = {},
): ResolvedStandaloneHostConfig {
  const directiveRoot = overrides.directiveRoot
    ? normalizeAbsolutePath(path.resolve(overrides.directiveRoot))
    : config.directiveRoot;

  return {
    ...config,
    directiveRoot,
    receivedAt: overrides.receivedAt ?? config.receivedAt,
    unresolvedGapIds: [...(overrides.unresolvedGapIds ?? config.unresolvedGapIds)],
    server: {
      host: overrides.host ?? config.server.host,
      port: overrides.port ?? config.server.port,
    },
    auth: overrides.authBearerToken
      ? {
          mode: "static_bearer",
          bearerToken: overrides.authBearerToken,
          bearerTokenSource: "override",
          protectedRoutePrefixes: [...config.auth.protectedRoutePrefixes],
        }
      : config.auth,
    persistence: overrides.persistenceSqlitePath
      ? {
          mode: "filesystem_and_sqlite",
          sqlitePath: normalizeAbsolutePath(
            path.resolve(overrides.persistenceSqlitePath),
          ),
          sqlitePathSource: "override",
          experimentalRuntime: true,
        }
      : config.persistence,
    runtimeArtifacts: {
      ...config.runtimeArtifacts,
      root: normalizeAbsolutePath(
        path.resolve(directiveRoot, config.runtimeArtifacts.relativeRoot),
      ),
    },
  };
}
