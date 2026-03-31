import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import { getHighlighter } from 'shiki'

let highlighter: any = null

// Initialize Shiki asynchronously with an expanded set of languages
export async function initMarkdown() {
  if (!highlighter) {
    highlighter = await getHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'javascript', 'typescript', 'python', 'rust', 'json', 'bash', 'yaml', 
        'toml', 'html', 'css', 'vue', 'markdown', 'c', 'cpp', 'csharp', 
        'go', 'java', 'kotlin', 'php', 'ruby', 'sql', 'shell', 'dockerfile',
        'diff', 'makefile', 'latex'
      ]
    })
  }
}

export async function highlight(str: string, lang: string): Promise<string> {
  await initMarkdown()
  
  // Normalize language name
  const normalizedLang = lang ? lang.toLowerCase() : 'text'
  
  if (highlighter && highlighter.getLanguages().includes(normalizedLang)) {
    try {
      return highlighter.codeToHtml(str, { lang: normalizedLang, theme: 'github-dark' })
    } catch (err) {
      console.error('Shiki highlight error:', err)
    }
  }
  return `<pre class="shiki"><code>${escapeHtml(str)}</code></pre>`
}

// Helper to escape HTML safely
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m] || m))
}

const md: MarkdownIt = new MarkdownIt({
  html: false, // Security: disable raw HTML
  breaks: true, // Use soft line breaks as hard breaks
  linkify: true, // Autoconvert URL-like text to links
  highlight: (str, lang) => {
    // Synchronous fallback/placeholder if highlighter isn't ready
    const normalizedLang = lang ? lang.toLowerCase() : 'text'
    if (highlighter && highlighter.getLanguages().includes(normalizedLang)) {
      try {
        return highlighter.codeToHtml(str, { lang: normalizedLang, theme: 'github-dark' })
      } catch (err) {
        console.error(err)
      }
    }
    return `<pre class="shiki"><code>${escapeHtml(str)}</code></pre>`
  }
})

md.use(footnote)

export function renderMarkdown(content: string): string {
  return md.render(content)
}

export function renderInline(content: string): string {
  return md.renderInline(content)
}
