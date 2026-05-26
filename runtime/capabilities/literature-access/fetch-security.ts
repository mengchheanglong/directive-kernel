import { assertUrlIsSafe } from "../../../shared/lib/ssrf-guard.ts";

export type LiteratureAccessFetchOptions = {
  allowExternalFetches?: boolean;
};

export function literatureFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.startsWith("ssrf_blocked_")) {
    return null;
  }
  return {
    error: message.startsWith("ssrf_blocked_offline:")
      ? "external_fetches_disabled"
      : "ssrf_blocked",
    message,
  };
}

export async function assertLiteratureFetchUrl(
  url: string,
  options: LiteratureAccessFetchOptions = {},
) {
  await assertUrlIsSafe(url, {
    allowExternalFetches: options.allowExternalFetches,
  });
}
