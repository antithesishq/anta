import { useEffect, useRef, useState } from 'preact/hooks'
import { debounce } from 'es-toolkit/function'
import { Button, Dialog, Icon, Input, Loader, Text, Title } from '@antadesign/anta'
import { loadSearchIndex, searchDocumentation, type SearchResult } from '../../lib/search/client'
import { AI_ANSWER_TIMEOUT_MS, AI_QUERY_MAX_LENGTH, requestSearchAnswer, type SearchAnswer } from '../../lib/search/answer'
import styles from './SearchDialog.module.css'

const EMPTY_RESULTS: SearchResult[] = []
type SearchState = {
  query: string
  results: SearchResult[]
  status: 'ready' | 'error'
  answerStatus?: 'loading' | 'streaming' | 'ready' | 'error'
  answer?: SearchAnswer
}

function AnswerMarkdown({ source }: { source: string }) {
  const [html, setHtml] = useState<string>()
  useEffect(() => {
    let active = true
    void import('../../lib/search/markdown').then(({ renderAnswerMarkdown }) => (
      renderAnswerMarkdown(source)
    )).then((next) => {
      if (active) setHtml(next)
    }, () => {
      if (active) setHtml(undefined)
    })
    return () => { active = false }
  }, [source])
  return html === undefined
    ? <div className={`${styles.answerText} ${styles.answerPlain}`}>{source}</div>
    : <div className={styles.answerText} data-docs-markdown dangerouslySetInnerHTML={{ __html: html }} />
}

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
  const [search, setSearch] = useState<SearchState>()
  const lastAnswer = useRef<{ query: string; answer: SearchAnswer }>()
  const answerRequest = useRef<AbortController>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [selected, setSelected] = useState(0)
  // A resting pointer cannot override keyboard selection.
  const [pointerActive, setPointerActive] = useState(false)
  const term = query.trim()
  const currentSearch = search?.query === term ? search : undefined
  const results = term ? search?.results ?? EMPTY_RESULTS : EMPTY_RESULTS
  const resultQuery = search?.query ?? term
  const searching = status === 'loading' || (status === 'ready' && Boolean(term) && !currentSearch)

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
    // Re-ranked results start at the top.
    setSelected(0)
    setPointerActive(false)
    if (!term) setSearch(undefined)
    if (!open || !term || status !== 'ready') return

    let active = true
    const runSearch = debounce(() => {
      void searchDocumentation(term).then((next) => {
        if (!active) return
        const ready: SearchState = { query: term, results: next, status: 'ready' }
        if (!next.length && lastAnswer.current?.query === term) {
          setSearch({ ...ready, answerStatus: 'ready', answer: lastAnswer.current.answer })
          return
        }
        setSearch(ready)
      }, () => {
        if (active) setSearch({ query: term, results: EMPTY_RESULTS, status: 'error' })
      })
    }, 250)
    if (search?.query !== term || search.status === 'error') runSearch()
    return () => {
      active = false
      runSearch.cancel()
      if (answerRequest.current) {
        answerRequest.current.abort()
        answerRequest.current = undefined
        setSearch((current) => current && ({
          ...current,
          answerStatus: current.answer ? 'error' : undefined,
        }))
      }
    }
  }, [term, status, open])

  const askAI = async () => {
    if (!open || !term || term.length > AI_QUERY_MAX_LENGTH
      || currentSearch?.status !== 'ready' || results.length || answerRequest.current) return

    const controller = new AbortController()
    answerRequest.current = controller
    const ready = currentSearch
    setSearch({ ...ready, answer: undefined, answerStatus: 'loading' })
    const timeout = setTimeout(() => controller.abort(), AI_ANSWER_TIMEOUT_MS + 1_000)
    let latest: SearchAnswer | undefined
    let repaint: ReturnType<typeof setTimeout> | undefined
    try {
      const answer = await requestSearchAnswer(term, controller.signal, (progress) => {
        latest = progress
        if (repaint !== undefined) return
        repaint = setTimeout(() => {
          repaint = undefined
          if (answerRequest.current === controller) setSearch({ ...ready, answerStatus: 'streaming', answer: latest })
        }, 50)
      })
      if (answerRequest.current !== controller) return
      lastAnswer.current = { query: term, answer }
      setSearch({ ...ready, answerStatus: 'ready', answer })
    } catch {
      if (answerRequest.current === controller) setSearch({ ...ready, answerStatus: 'error', answer: latest })
    } finally {
      clearTimeout(timeout)
      clearTimeout(repaint)
      if (answerRequest.current === controller) answerRequest.current = undefined
    }
  }

  const moveSelection = (amount: number) => {
    if (!results.length) return
    setPointerActive(false)
    setSelected((current) => (current + amount + results.length) % results.length)
  }

  return (
    <Dialog
      className={styles.dialog}
      header={
        <div className={styles.header}>
          <span className={styles.srOnly}>Search documentation</span>
          <Input
            id="docs-search-input"
            type="search"
            autoFocus
            placeholder="Search or ask"
            leading={searching ? <Loader size={16} label="Searching documentation" /> : <Icon shape="search" size={16} />}
            value={query}
            onInput={(event) => setQuery((event.target as { value: string }).value)}
            onKeyDown={(event) => {
              if ((event.target as Element).closest('a-button')) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveSelection(1)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveSelection(-1)
              } else if (event.key === 'Enter') {
                if ((event as unknown as KeyboardEvent).isComposing) return
                event.preventDefault()
                event.stopPropagation()
                if (event.repeat) return
                const result = currentSearch?.results[selected]
                if (result) {
                  location.href = resultHref(result, term)
                } else if (currentSearch?.answerStatus !== 'ready') {
                  void askAI()
                }
              }
            }}
            aria-label="Search documentation"
            aria-controls="docs-search-results"
            aria-expanded={query.trim() ? 'true' : 'false'}
            aria-busy={searching ? 'true' : undefined}
          />
        </div>
      }
      closable={false}
      open={open}
      position="top"
      onStateChange={(_event, { next }) => setOpen(next)}
    >
      <div className={styles.body}>
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
                  href={resultHref(result, resultQuery)}
                  key={result.id}
                  // Ignore a resting pointer after the results re-render.
                  onPointerMove={() => {
                    setPointerActive(true)
                    setSelected(index)
                  }}
                  onClick={() => {
                    document.dispatchEvent(new CustomEvent('anta-search-navigate', {
                      detail: { result, query: resultQuery },
                    }))
                    setOpen(false)
                  }}
                >
                  <Text className={styles.path} priority="tertiary" size="small">
                    {icon && <Icon shape={icon} size={14} />}
                    {pathLabel(result.route)}
                  </Text>
                  <Title level={resultTitleLevel(result)}>
                    {markTerms(result.heading || result.title, resultQuery)}
                  </Title>
                  {result.text !== result.heading && (
                    <Text className={styles.snippet} size="small">{markTerms(result.text, resultQuery)}</Text>
                  )}
                </a>
              )
            }) : !currentSearch ? null : currentSearch.status === 'error' ? (
              <p className={styles.status}>Search is unavailable. Try another query or reload the page.</p>
            ) : (
              <div className={styles.fallback}>
                {!currentSearch.answer && currentSearch.answerStatus !== 'loading' && (
                  <button
                    type="button"
                    className={`${styles.result} ${styles.aiResult}`}
                    data-selected="true"
                    disabled={term.length > AI_QUERY_MAX_LENGTH}
                    onClick={() => { void askAI() }}
                  >
                    <Text priority="tertiary" size="small">No results for “{term}”.</Text>
                    <strong>Get answer from AI</strong>
                  </button>
                )}
                {currentSearch.answerStatus === 'loading' && (
                  <p className={styles.status}><Loader size={16} label="Preparing AI answer" /> Preparing an AI answer…</p>
                )}
                {currentSearch.answer && (
                  <section
                    className={styles.answer}
                    aria-label="AI answer"
                    aria-busy={currentSearch.answerStatus === 'streaming' ? 'true' : undefined}
                    onClick={(event) => {
                      if ((event.target as Element).closest('a[href]')
                        && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) setOpen(false)
                    }}
                  >
                    <div className={styles.answerHeading}>
                      <Text priority="tertiary" size="small">AI answer</Text>
                      {currentSearch.answerStatus === 'streaming' && <Loader size={12} label="Writing AI answer" />}
                    </div>
                    <AnswerMarkdown source={currentSearch.answer.answer} />
                    {currentSearch.answer.sources.length > 0 && (
                      <div className={styles.sources} aria-label="Sources">
                        <Text priority="tertiary" size="small">Sources</Text>
                        {currentSearch.answer.sources.map((source) => {
                          const route = new URL(source).pathname
                          return <a href={route} key={source}>{pathLabel(route)}</a>
                        })}
                      </div>
                    )}
                  </section>
                )}
                {currentSearch.answerStatus === 'error' && (
                  <div className={styles.emptyRow}>
                    <p className={styles.status}>{currentSearch.answer ? 'The answer was interrupted. Try again.' : 'Couldn’t load an AI answer. Try again.'}</p>
                    {currentSearch.answer && (
                      <Button priority="secondary" size="small" label="Get answer from AI" onClick={() => { void askAI() }} />
                    )}
                  </div>
                )}
                {term.length > AI_QUERY_MAX_LENGTH && (
                  <p className={styles.status}>Use up to {AI_QUERY_MAX_LENGTH} characters for an AI answer.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
