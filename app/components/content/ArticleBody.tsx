import { renderMarkdown } from '../../lib/content/markdown'

/** The text of an entry. The HTML comes from our own Markdown files through a renderer that
 * escapes raw HTML and blocks unsafe links (see lib/content/markdown.ts), never from visitors. */
export default function ArticleBody({ markdown, lang }: { markdown: string; lang: string }) {
  return <div lang={lang} className="article" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
}
