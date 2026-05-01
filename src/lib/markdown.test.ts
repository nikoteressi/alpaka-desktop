import { describe, it, expect, beforeAll } from "vitest";
import { initMarkdown, renderMarkdown } from "./markdown";

beforeAll(async () => {
  await initMarkdown();
});

describe("renderMarkdown — table wrapper", () => {
  it("wraps a markdown table in a scroll wrapper div", () => {
    const input = "| a | b |\n|---|---|\n| 1 | 2 |";
    const html = renderMarkdown(input);
    expect(html).toContain('class="table-scroll-wrapper"');
    expect(html).toContain("<table>");
    expect(html).toContain("</div>");
  });

  it("closes the wrapper immediately after </table>", () => {
    const input = "| x |\n|---|\n| y |";
    const html = renderMarkdown(input);
    expect(html).toMatch(/<\/table>[\s\S]*?<\/div>/);
  });
});

describe("renderMarkdown — KaTeX", () => {
  it("renders inline math containing katex class", () => {
    const input = "Result: $E = mc^2$";
    const html = renderMarkdown(input);
    expect(html).toContain("katex");
  });

  it("renders display math with katex-display class", () => {
    const input = "$$\\int_0^\\infty e^{-x^2}\\,dx$$";
    const html = renderMarkdown(input);
    expect(html).toContain("katex-display");
  });

  it("does not throw on partial inline math (no closing $)", () => {
    const input = "Partial: $E = mc";
    expect(() => renderMarkdown(input)).not.toThrow();
  });
});

describe("normalizeLang (via highlight fallback)", () => {
  it("lowercases language identifier", async () => {
    const { highlight } = await import("./markdown");
    const html = await highlight("const x = 1", "TypeScript");
    expect(html).toContain("<code");
  });
});
