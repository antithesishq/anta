import { useEffect, useState } from 'preact/hooks'
import { Dialog, Icon, Input, Loader, Text, Title } from '@antadesign/anta'
import { loadSearchIndex, searchDocumentation, type SearchResult } from '../../lib/search/client'
import styles from './SearchDialog.module.css'

const EMPTY_RESULTS: SearchResult[] = []

function markTerms(text: string, query: string) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))]
  if (!terms.length) return text

  const matcher = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.split(matcher).map((part, index) => (
    index % 2 ? <mark key={index}>{part}</mark> : part
  ))
}

function pathLabel(route: string) {
  const segments = route.split('/').filter(Boolean)
  return segments.length ? segments.join(' / ') : 'Overview'
}

type IconShape = Parameters<typeof Icon>[0]['shape']
type TitleLevel = 1 | 2 | 3 | 4 | 5 | 6

function normalizedRoute(route: string) {
  return route.replace(/\/+$/, '') || '/'
}

function sidebarIcon(route: string): IconShape | undefined {
  if (typeof document === 'undefined') return undefined

  const targetRoute = normalizedRoute(route)
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar menu a[href]'))
    .find((item) => normalizedRoute(item.pathname) === targetRoute)
  const shape = link?.querySelector('a-icon[shape]')?.getAttribute('shape')

  return shape as IconShape | undefined
}

function resultTitleLevel(result: SearchResult): TitleLevel {
  return /^h[1-6]$/.test(result.kind) && result.level >= 1 && result.level <= 6
    ? result.level as TitleLevel
    : 5
}

function resultHref(result: SearchResult, query: string) {
  const params = new URLSearchParams({ search: result.id, q: query })
  return `${result.route}?${params}#${result.anchor}`
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return element?.matches('input, textarea, select, a-input, [contenteditable="true"]')
    || Boolean(element?.closest('a-input, [contenteditable="true"]'))
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [selected, setSelected] = useState(0)
  // Whether the pointer is driving the selection. Typing and arrow keys turn it
  // off, a real `pointermove` over a result turns it back on. It gates both the
  // hover highlight (see the module CSS) and pointer-driven selection, so a cursor
  // resting over the list can't claim the highlight from the top result.
  const [pointerActive, setPointerActive] = useState(false)

  const ensureIndex = () => {
    setStatus((current) => current === 'ready' ? current : 'loading')
    return loadSearchIndex().then(
      () => setStatus('ready'),
      () => setStatus('error'),
    )
  }

  useEffect(() => {
    const start = () => { void ensureIndex() }
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleId = windowWithIdle.requestIdleCallback?.(start, { timeout: 2_000 })
    const timeoutId = idleId == null ? window.setTimeout(start, 250) : undefined

    return () => {
      if (idleId != null) windowWithIdle.cancelIdleCallback?.(idleId)
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const showSearch = () => setOpen(true)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault()
        showSearch()
      }
    }

    document.addEventListener('anta-search-open', showSearch)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('anta-search-open', showSearch)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void ensureIndex()
  }, [open])

  useEffect(() => {
    const term = query.trim()
    // Every keystroke re-ranks the list, so the top result takes the selection back
    // even if the cursor happens to rest over a different row.
    setSelected(0)
    setPointerActive(false)
    if (!term || status !== 'ready') {
      setResults(EMPTY_RESULTS)
      return
    }

    let active = true
    void searchDocumentation(term).then((next) => {
      if (active) setResults(next)
    }, () => {
      if (active) setResults(EMPTY_RESULTS)
    })
    return () => { active = false }
  }, [query, status])

  const moveSelection = (amount: number) => {
    if (!results.length) return
    setPointerActive(false)
    setSelected((current) => (current + amount + results.length) % results.length)
  }

  return (
    <Dialog
      className={styles.dialog}
      header="Search documentation"
      open={open}
      position="top"
      onStateChange={(_event, { next }) => setOpen(next)}
    >
      <div className={styles.body}>
        <Input
          id="docs-search-input"
          type="search"
          autoFocus
          placeholder={status === 'loading' ? 'Loading search…' : 'Search documentation'}
          value={query}
          onInput={(event) => setQuery((event.target as { value: string }).value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              moveSelection(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              moveSelection(-1)
            } else if (event.key === 'Enter' && results[selected]) {
              event.preventDefault()
              location.href = resultHref(results[selected], query.trim())
            }
          }}
          aria-label="Search documentation"
          aria-controls="docs-search-results"
          aria-expanded={query.trim() ? 'true' : 'false'}
        />

        {status === 'loading' && (
          <p className={styles.status}><Loader size={16} label="Loading search index" /> Loading search index</p>
        )}
        {status === 'error' && <p className={styles.status}>Search is unavailable. Try reloading the page.</p>}

        {query.trim() && status === 'ready' && (
          <div
            id="docs-search-results"
            className={styles.results}
            data-pointer={pointerActive ? 'active' : undefined}
            aria-live="polite"
          >
            {results.length ? results.map((result, index) => {
              const icon = sidebarIcon(result.route)
              return (
                <a
                  className={styles.result}
                  data-selected={selected === index ? 'true' : undefined}
                  href={resultHref(result, query.trim())}
                  key={result.id}
                  // `pointermove`, not `mouseenter`: re-rendering the list under a
                  // resting cursor fires the boundary events (mouseover/enter) with
                  // no pointer movement at all, which is what let a middle row steal
                  // the selection mid-search. A move event only fires when the
                  // pointer actually moves. Both setters no-op when the value is
                  // unchanged, so hovering one row doesn't re-render per event.
                  onPointerMove={() => {
                    setPointerActive(true)
                    setSelected(index)
                  }}
                  onClick={() => {
                    document.dispatchEvent(new CustomEvent('anta-search-navigate', {
                      detail: { result, query: query.trim() },
                    }))
                    setOpen(false)
                  }}
                >
                  <Text className={styles.path} priority="tertiary" size="small">
                    {icon && <Icon shape={icon} size={14} />}
                    {pathLabel(result.route)}
                  </Text>
                  <Title level={resultTitleLevel(result)}>
                    {markTerms(result.heading || result.title, query)}
                  </Title>
                  {result.text !== result.heading && (
                    <Text className={styles.snippet} size="small">{markTerms(result.text, query)}</Text>
                  )}
                </a>
              )
            }) : <p className={styles.empty}>No results for “{query.trim()}”.</p>}
          </div>
        )}
      </div>
    </Dialog>
  )
}
