import DOMPurify from 'dompurify'
import { Marked, Renderer } from 'marked'

/** Render model output as inert Markdown. Load this module only after selecting AI. */
export async function renderAnswerMarkdown(source: string): Promise<string> {
  const languages: string[] = []
  const renderer = new Renderer()
  const renderCode = renderer.code.bind(renderer)
  renderer.code = (token) => {
    languages.push(token.lang?.trim().split(/\s+/)[0].toLowerCase() || 'text')
    return renderCode(token)
  }
  renderer.html = () => ''
  renderer.image = () => ''
  const markdown = new Marked({ renderer, gfm: true })
  const fragment = DOMPurify.sanitize(markdown.parse(source, { async: false }), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })

  for (const link of fragment.querySelectorAll('a[href]')) {
    try {
      const url = new URL(link.getAttribute('href')!, 'https://anta.design/')
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        link.removeAttribute('href')
      } else {
        // Documentation links stay on the current site, including local previews.
        link.setAttribute('href', url.origin === 'https://anta.design'
          ? `${url.pathname}${url.search}${url.hash}` : url.href)
      }
    } catch {
      link.removeAttribute('href')
    }
  }

  const blocks = [...fragment.querySelectorAll('pre > code')]
  if (blocks.length) {
    try {
      const { renderAnswerCode } = await import('./code-block')
      await Promise.all(blocks.map(async (block, index) => {
        const template = document.createElement('template')
        // Expressive Code escapes the sanitized code text; model HTML never
        // enters this trusted rendering path.
        template.innerHTML = await renderAnswerCode((block.textContent || '').replace(/\n$/, ''), languages[index])
        block.parentElement!.replaceWith(template.content)
      }))
    } catch {
      // A failed renderer download still leaves readable, escaped code blocks.
    }
  }
  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
}
