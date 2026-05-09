import { describe, it, expect, vi } from "vitest";

vi.mock("./markdown", () => ({
  renderMarkdown: (s: string) => `<p>${s}</p>`,
}));

import { parseMessageParts, parseBlockMatch } from "./messageParser";

const rm = (s: string) => `<p>${s}</p>`;

describe("parseMessageParts", () => {
  it("returns single markdown part for plain text", () => {
    const parts = parseMessageParts("Hello world", { renderMarkdown: rm });
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("markdown");
    expect(parts[0].rendered).toBe("<p>Hello world</p>");
  });

  it("returns empty array for empty non-user content", () => {
    const parts = parseMessageParts("", { renderMarkdown: rm });
    expect(parts).toHaveLength(0);
  });

  it("user message returns single markdown passthrough", () => {
    const parts = parseMessageParts("Hi there", {
      renderMarkdown: rm,
      isUserMessage: true,
    });
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("markdown");
    expect(parts[0].content).toBe("Hi there");
  });

  it("extracts fenced code block", () => {
    const content = "Before\n```python\nprint('hi')\n```\nAfter";
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const code = parts.find((p) => p.type === "code");
    expect(code).toBeDefined();
    expect(code?.language).toBe("python");
    expect(code?.content).toContain("print('hi')");
  });

  it("extracts think block with time attribute", () => {
    const content = '<think time="2.5">inner reasoning</think>';
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const think = parts.find((p) => p.type === "think");
    expect(think).toBeDefined();
    expect(think?.thinkDuration).toBe(2.5);
    expect(think?.content).toBe("inner reasoning");
  });

  it("extracts think block without time attribute", () => {
    const content = "<think>some thought</think>";
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const think = parts.find((p) => p.type === "think");
    expect(think).toBeDefined();
    expect(think?.thinkDuration).toBeUndefined();
    expect(think?.content).toBe("some thought");
  });

  it("extracts tool_call block with name and query", () => {
    const content =
      '<tool_call name="web_search" query="cats">result text</tool_call>';
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const tool = parts.find((p) => p.type === "tool");
    expect(tool).toBeDefined();
    expect(tool?.toolName).toBe("web_search");
    expect(tool?.toolQuery).toBe("cats");
    expect(tool?.content).toBe("result text");
  });

  it("handles mixed content with text before and after code block", () => {
    const content = "Intro text\n```ts\nconst x = 1;\n```\nOutro text";
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const types = parts.map((p) => p.type);
    expect(types).toContain("markdown");
    expect(types).toContain("code");
  });

  it("allowOpenFence closes hanging code fence at end of string", () => {
    const content = "Text\n```js\nconst x = 1;";
    const parts = parseMessageParts(content, {
      renderMarkdown: rm,
      allowOpenFence: true,
    });
    const code = parts.find((p) => p.type === "code");
    expect(code).toBeDefined();
    expect(code?.language).toBe("js");
  });

  it("strict mode does NOT match hanging code fence", () => {
    const content = "Text\n```js\nconst x = 1;";
    const parts = parseMessageParts(content, { renderMarkdown: rm });
    const code = parts.find((p) => p.type === "code");
    expect(code).toBeUndefined();
  });
});

describe("parseBlockMatch", () => {
  it("returns null for non-matching input", () => {
    const regex = /plain text/g;
    const match = regex.exec("plain text")!;
    const result = parseBlockMatch(match as unknown as RegExpExecArray);
    expect(result).toBeNull();
  });
});
