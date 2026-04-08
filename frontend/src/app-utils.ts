export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error((await response.text()) || `request_failed:${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function navTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function artifactPathToViewPath(relativePath: string) {
  if (
    relativePath.startsWith("architecture/01-experiments/")
    && relativePath.endsWith("-bounded-start.md")
  ) {
    return `/architecture-starts/view?path=${encodeURIComponent(relativePath)}`;
  }
  if (
    relativePath.startsWith("architecture/01-experiments/")
    && relativePath.endsWith("-bounded-result.md")
  ) {
    return `/architecture-results/view?path=${encodeURIComponent(relativePath)}`;
  }
  return `/artifacts?path=${encodeURIComponent(relativePath)}`;
}

