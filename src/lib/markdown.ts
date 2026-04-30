import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import mk from "@traptitech/markdown-it-katex";
import { createHighlighter, type Highlighter } from "shiki";
import DOMPurify from "dompurify";

let highlighter: Highlighter | null = null;
let initPromise: Promise<void> | null = null;

export async function initMarkdown() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    highlighter = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "rust",
        "json",
        "bash",
        "yaml",
        "toml",
        "html",
        "css",
        "vue",
        "markdown",
        "c",
        "cpp",
        "csharp",
        "go",
        "java",
        "kotlin",
        "php",
        "ruby",
        "sql",
        "shell",
        "dockerfile",
        "diff",
        "makefile",
        "latex",
      ],
    });
  })();

  return initPromise;
}

function normalizeLang(lang: string): string {
  const trimmed = (lang ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : "text";
}

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m] || m,
  );
}

export async function highlight(str: string, lang: string): Promise<string> {
  await initMarkdown();
  const normalizedLang = normalizeLang(lang);
  if (
    highlighter &&
    highlighter.getLoadedLanguages().includes(normalizedLang)
  ) {
    try {
      return highlighter.codeToHtml(str, {
        lang: normalizedLang,
        theme: "github-dark",
      });
    } catch (err) {
      console.error("Shiki highlight error:", err);
    }
  }
  return `<pre class="shiki"><code>${escapeHtml(str)}</code></pre>`;
}

const md: MarkdownIt = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    const normalizedLang = normalizeLang(lang);
    if (!highlighter) {
      return `<pre class="shiki"><code>${escapeHtml(str)}</code></pre>`;
    }
    if (highlighter.getLoadedLanguages().includes(normalizedLang)) {
      try {
        return highlighter.codeToHtml(str, {
          lang: normalizedLang,
          theme: "github-dark",
        });
      } catch (err) {
        console.error(err);
      }
    }
    return `<pre class="shiki"><code>${escapeHtml(str)}</code></pre>`;
  },
});

// Table scroll wrapper — wraps <table> in overflow-x: auto container
const defaultTableOpen = md.renderer.rules.table_open;
md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
  const base = defaultTableOpen
    ? defaultTableOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
  return `<div class="table-scroll-wrapper">${base}`;
};
const defaultTableClose = md.renderer.rules.table_close;
md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
  const base = defaultTableClose
    ? defaultTableClose(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
  return `${base}</div>`;
};

md.use(footnote);
md.use(mk, { throwOnError: false, errorColor: "#ef4444" });

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(md.render(content));
}

export function renderInline(content: string): string {
  return md.renderInline(content);
}
