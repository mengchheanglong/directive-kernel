import { describe, expect, it } from "vitest";
import { parseGlossaryMarkdown } from "../../hosts/web-host/glossary.ts";

describe("parseGlossaryMarkdown", () => {
  const fixture = `# Glossary

Intro text.

## Not Terms

- **Ignored**: Should not be parsed.

## Terms

- **Directive root**: The on-disk workspace folder a kernel host reads
  and writes.
- **Mission**: The top-level intent that frames a kernel run.
- **Adopter**: A consuming project that embeds or calls the kernel.

## Another Section

- **Also Ignored**: Should not be parsed.
`;

  it("parses terms from the ## Terms section", () => {
    const terms = parseGlossaryMarkdown(fixture);

    expect(terms.length).toBe(3);
    expect(terms.map((t) => t.term)).toContain("Adopter");
    expect(terms.map((t) => t.term)).toContain("Directive root");
    expect(terms.map((t) => t.term)).toContain("Mission");
  });

  it("ignores terms outside the ## Terms section", () => {
    const terms = parseGlossaryMarkdown(fixture);

    const termNames = terms.map((t) => t.term);
    expect(termNames).not.toContain("Ignored");
    expect(termNames).not.toContain("Also Ignored");
  });

  it("sorts terms case-insensitively by term", () => {
    const terms = parseGlossaryMarkdown(fixture);

    const termNames = terms.map((t) => t.term);
    expect(termNames).toEqual(["Adopter", "Directive root", "Mission"]);
  });

  it("returns each term with definedIn 'GLOSSARY.md'", () => {
    const terms = parseGlossaryMarkdown(fixture);

    for (const term of terms) {
      expect(term.definedIn).toBe("GLOSSARY.md");
    }
  });

  it("returns empty array for input without ## Terms section", () => {
    const terms = parseGlossaryMarkdown("# No Terms\n\n- **X**: Y");
    expect(terms).toEqual([]);
  });

  it("includes continuation lines in the definition", () => {
    const terms = parseGlossaryMarkdown(fixture);

    const directiveRoot = terms.find((t) => t.term === "Directive root");
    expect(directiveRoot).toBeDefined();
    expect(directiveRoot!.definition).toContain(
      "The on-disk workspace folder a kernel host reads",
    );
    expect(directiveRoot!.definition).toContain("and writes.");
  });

  it("supports the dash-separated form - **Term** - Definition", () => {
    const terms = parseGlossaryMarkdown(
      `## Terms\n- **Source** - A consumed input to the kernel.\n`,
    );

    expect(terms.length).toBe(1);
    expect(terms[0].term).toBe("Source");
    expect(terms[0].definition).toBe("A consumed input to the kernel.");
  });
});
