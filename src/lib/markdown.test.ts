import { describe, it, expect, beforeAll } from "vitest";
import { initMarkdown, renderMarkdown, renderInline } from "./markdown";

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

describe("renderInline", () => {
  it("renders inline markdown without wrapping paragraph tags", () => {
    const html = renderInline("**bold** text");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<p>");
  });
});

describe("citation pill", () => {
  it("renders [1] citation markers as citation-pill spans", () => {
    const html = renderMarkdown("See [1] for details.");
    expect(html).toContain('class="citation-pill"');
    expect(html).toContain("1");
  });

  it("escapes HTML in citation content", () => {
    const html = renderMarkdown("Ref [<script>].");
    // The pill should not contain a bare <script> tag
    expect(html).not.toContain("<script>");
  });
});
