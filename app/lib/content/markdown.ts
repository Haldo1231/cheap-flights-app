// Turns the text of an entry (Markdown) into safe HTML. Only Markdown makes markup:
// raw HTML typed into a file is shown as plain text, links may only be web, mail or
// on-site addresses, and pictures are not allowed here (they go in the "photos" list).

import { Marked, type Tokens } from 'marked'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escape(text)
    },
    image({ text }: Tokens.Image) {
      return escape(text)
    },
    heading({ tokens, depth }: Tokens.Heading) {
      const inner = this.parser.parseInline(tokens)
      // Entry titles are the page's h1, so "#" in the text becomes an h2 and so on.
      const level = Math.min(depth + 1, 4)
      const id = slugify(tokens.map((t) => ('text' in t ? String(t.text) : '')).join(' '))
      return `<h${level}${id ? ` id="${id}"` : ''}>${inner}</h${level}>\n`
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens)
      const safe = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)
      if (!safe) return inner
      const external = /^https?:\/\//i.test(href)
      return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`
    },
  },
})

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false })
}
