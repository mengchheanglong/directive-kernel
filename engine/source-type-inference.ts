import type { DirectiveEngineSourceType } from "./types.ts";
import { normalizeText } from "./engine-source-utils.ts";

function normalizeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function sourceText(input: {
  title: string;
  summary?: string | null;
}) {
  return `${normalizeText(input.title)} ${normalizeText(input.summary)}`.toLowerCase();
}

export function inferDirectiveEngineSourceType(input: {
  title: string;
  url?: string | null;
  summary?: string | null;
}): DirectiveEngineSourceType {
  const url = normalizeUrl(normalizeText(input.url));
  const host = url?.hostname.toLowerCase() ?? "";
  const path = url?.pathname.toLowerCase() ?? "";
  const text = sourceText(input);

  if (
    host.includes("github.com")
    || host.includes("gitlab.com")
    || host.includes("bitbucket.org")
    || path.endsWith(".git")
  ) {
    return "github-repo";
  }

  if (
    host.includes("arxiv.org")
    || host.includes("openreview.net")
    || host.includes("acm.org")
    || host.includes("doi.org")
    || /\b(paper|preprint|research|study|benchmark)\b/.test(text)
  ) {
    return "paper";
  }

  if (
    host.startsWith("docs.")
    || /\/(docs|reference|api|manual|guide|sdk)(\/|$)/.test(path)
    || /\b(api|reference|documentation|manual|guide|sdk)\b/.test(text)
  ) {
    return "product-doc";
  }

  if (/\b(theorem|axiom|lemma|formal|proof system|calculus|model theory)\b/.test(text)) {
    return "theory";
  }

  if (
    /\b(workflow|runbook|playbook|protocol|process|cadence|checklist|handoff|review loop)\b/.test(
      text,
    )
  ) {
    return "workflow-writeup";
  }

  if (
    host.includes("app.")
    || host.includes("service.")
    || (Boolean(host) && /\b(platform|service|saas|cloud)\b/.test(text))
  ) {
    return "external-system";
  }

  return "technical-essay";
}
