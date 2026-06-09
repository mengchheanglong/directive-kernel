import fs from "node:fs";
import path from "node:path";

export type GlossaryTerm = {
  term: string;
  definition: string;
  definedIn: "GLOSSARY.md";
};

/**
 * Parse glossary terms from GLOSSARY.md markdown.
 * Only entries from the `## Terms` section are parsed.
 * Each entry starts with `- **Term**:` and may continue on indented lines.
 */
export function parseGlossaryMarkdown(markdown: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  const lines = markdown.split(/\r?\n/);

  let inTermsSection = false;
  let currentTerm: GlossaryTerm | null = null;

  for (const line of lines) {
    // Detect section boundaries
    if (line.startsWith("## ")) {
      inTermsSection = line === "## Terms";
      if (currentTerm && currentTerm.definition) {
        terms.push(currentTerm);
      }
      currentTerm = null;
      continue;
    }

    if (!inTermsSection) continue;

    // Stop at next heading
    if (line.startsWith("#")) {
      if (currentTerm && currentTerm.definition) {
        terms.push(currentTerm);
      }
      currentTerm = null;
      break;
    }

    // Parse entry start: "- **Term**: Definition" or "- **Term** - Definition"
    const startMatch = line.match(/^- \*\*(.+?)\*\*: (.+)$/) ?? line.match(/^- \*\*(.+?)\*\* - (.+)$/);
    if (startMatch) {
      if (currentTerm && currentTerm.definition) {
        terms.push(currentTerm);
      }
      const term = startMatch[1].trim();
      const definition = startMatch[2].trim();
      if (term && definition) {
        currentTerm = { term, definition, definedIn: "GLOSSARY.md" };
      }
      continue;
    }

    // Accumulate continuation lines (indented under a bullet)
    if (currentTerm && line.startsWith("  ")) {
      const continuation = line.trim();
      if (continuation) {
        currentTerm.definition += ` ${continuation}`;
      }
      continue;
    }

    // Empty line or non-matching line ends the current term
    if (currentTerm) {
      if (currentTerm.definition) {
        terms.push(currentTerm);
      }
      currentTerm = null;
    }
  }

  // Flush final term
  if (currentTerm && currentTerm.definition) {
    terms.push(currentTerm);
  }

  // Sort case-insensitively by term
  terms.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));

  return terms;
}

/**
 * Read and parse glossary terms from the GLOSSARY.md at the repo root.
 */
export function readGlossaryTerms(): GlossaryTerm[] {
  const glossaryPath = path.resolve(process.cwd(), "GLOSSARY.md");
  const markdown = fs.readFileSync(glossaryPath, "utf8");
  return parseGlossaryMarkdown(markdown);
}
