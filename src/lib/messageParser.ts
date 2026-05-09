import type { MessagePart } from "../types/chat";

// Matches fully-closed blocks (strict — code fence requires closing ```)
const STRICT_PATTERN = String.raw`\`\`\`(\w+)?\n(.*?)\`\`\``;
const TAIL_PATTERN = String.raw`\`\`\`(\w+)?\n(.*?)(?:\`\`\`|$)`;

function parseCode(match: RegExpExecArray): MessagePart {
  return {
    type: "code",
    language: match[1] || "text",
    content: match[2] || "",
  };
}

function pushMarkdown(
  parts: MessagePart[],
  text: string,
  renderMarkdown: (s: string) => string,
) {
  if (!text.trim()) return;
  parts.push({
    type: "markdown",
    content: text,
    rendered: renderMarkdown(text),
  });
}

export function parseBlockMatch(match: RegExpExecArray): MessagePart | null {
  if (match[0].startsWith("```")) return parseCode(match);
  return null;
}

export function parseMessageParts(
  content: string,
  opts: {
    renderMarkdown: (s: string) => string;
    isUserMessage?: boolean;
    allowOpenFence?: boolean;
  },
): MessagePart[] {
  if (!content && !opts.isUserMessage) return [];
  if (opts.isUserMessage) {
    return [{ type: "markdown", content, rendered: content }];
  }

  const parts: MessagePart[] = [];
  const pattern = opts.allowOpenFence ? TAIL_PATTERN : STRICT_PATTERN;
  const regex = new RegExp(pattern, "gis");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      pushMarkdown(
        parts,
        content.slice(lastIndex, match.index),
        opts.renderMarkdown,
      );
    }
    const part = parseBlockMatch(match);
    if (part) parts.push(part);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    pushMarkdown(parts, content.slice(lastIndex), opts.renderMarkdown);
  }

  return parts;
}
