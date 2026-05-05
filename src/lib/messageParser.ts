export type MessagePart = {
  type: "markdown" | "code" | "think" | "tool";
  content: string;
  language?: string;
  rendered?: string;
  toolName?: string;
  toolQuery?: string;
};

// Matches fully-closed blocks (strict — code fence requires closing ```)
const STRICT_PATTERN = String.raw`\`\`\`(\w+)?\n(.*?)\`\`\`|<think.*?<\/think>|<tool_call\b[^>]*>.*?<\/tool_call>`;
// Matches blocks where a trailing code fence is optional (for streaming tails)
const TAIL_PATTERN = String.raw`\`\`\`(\w+)?\n(.*?)(?:\`\`\`|$)|<think.*?<\/think>|<tool_call\b[^>]*>.*?<\/tool_call>`;

function parseThink(matchText: string): MessagePart {
  const startTagMatch = matchText.match(/^<think([^>]*)>/i);
  const startTag = startTagMatch ? startTagMatch[1] : "";
  const timeMatch = startTag.match(/time=["']?([\d.]+)["']?/i);
  const contentMatch = matchText.match(/^<think[^>]*>(.*)<\/think>$/is);
  return {
    type: "think",
    content: contentMatch ? contentMatch[1].trim() : matchText.replace(/^<think[^>]*>/i, "").trim(),
    language: timeMatch ? timeMatch[1] : undefined,
  };
}

function parseToolCall(matchText: string): MessagePart {
  const nameM = matchText.match(/\bname="([^"]*)"/i);
  const queryM = matchText.match(/\bquery="([^"]*)"/i);
  const openEnd = matchText.indexOf(">");
  const closeStart = matchText.lastIndexOf("</tool_call>");
  return {
    type: "tool",
    toolName: nameM?.[1],
    toolQuery: queryM?.[1],
    content:
      openEnd >= 0 && closeStart > openEnd
        ? matchText.slice(openEnd + 1, closeStart)
        : "",
  };
}

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
  parts.push({ type: "markdown", content: text, rendered: renderMarkdown(text) });
}

export function parseBlockMatch(match: RegExpExecArray): MessagePart | null {
  const matchText = match[0];
  if (matchText.toLowerCase().startsWith("<think")) return parseThink(matchText);
  if (matchText.toLowerCase().startsWith("<tool_call")) return parseToolCall(matchText);
  if (matchText.startsWith("```")) return parseCode(match);
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
      pushMarkdown(parts, content.slice(lastIndex, match.index), opts.renderMarkdown);
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
