import { getSearchResult, type SearchResult } from './client'
import Mark from 'mark.js/dist/mark.es6.min.js'

type PendingNavigation = {
  result: SearchResult
  query: string
}

function normalizedText(element: Element) {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function findIndexedBlock(content: HTMLElement, result: SearchResult | undefined) {
  if (!result) return null
  const candidates = content.querySelectorAll(result.kind)
  return [...candidates].find((candidate) => normalizedText(candidate) === result.text) as HTMLElement | undefined
}

function unfoldCodeAncestors(target: HTMLElement) {
  const frames: HTMLElement[] = []
  for (
    let frame = target.closest<HTMLElement>('.expressive-code .frame[data-folded]');
    frame;
    frame = frame.parentElement?.closest<HTMLElement>('.expressive-code .frame[data-folded]') ?? null
  ) {
    frame.removeAttribute('data-folded')
    frame.querySelector<HTMLElement>(':scope > .header')?.setAttribute('aria-expanded', 'true')
    frames.push(frame)
  }
  return frames
}

let run = 0
let pendingNavigation: PendingNavigation | undefined

export function highlightSearchTarget() {
  const url = location.href
  const params = new URLSearchParams(location.search)
  const searchId = params.get('search')
  const query = params.get('q')
  if (!searchId || !query) return

  const currentRun = ++run
  void (async () => {
    const content = document.querySelector<HTMLElement>('main.content')
    if (!content) return

    const pending = pendingNavigation?.result.id === searchId && pendingNavigation.query === query
      ? pendingNavigation.result
      : undefined
    const indexedResult = pending ?? await getSearchResult(searchId).catch(() => undefined)
    if (currentRun !== run || location.href !== url) return

    // Production pages have post-build search ids. Astro dev deliberately
    // serves source HTML, so it resolves the same indexed block by its text.
    const matchedBlock = document.querySelector(`[data-search-id="${CSS.escape(searchId)}"]`) as HTMLElement | null
      ?? findIndexedBlock(content, indexedResult)
    const target = matchedBlock ?? content

    for (let details = target.closest('details'); details; details = details.parentElement?.closest('details') ?? null) {
      details.open = true
    }
    const unfoldedFrames = unfoldCodeAncestors(target)

    // Astro attempts its hash scroll before this dev page has generated search
    // ids. Wait for a folded code block's expand transition before centering.
    const scrollTarget = () => requestAnimationFrame(() => {
      if (currentRun !== run || location.href !== url) return
      target.scrollIntoView({ block: 'center' })
    })
    if (!unfoldedFrames.length) {
      scrollTarget()
    } else {
      let scrolled = false
      const finishScrolling = () => {
        if (scrolled) return
        scrolled = true
        for (const frame of unfoldedFrames) frame.removeEventListener('transitionend', onTransitionEnd)
        scrollTarget()
      }
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target instanceof HTMLElement && unfoldedFrames.includes(event.target) && event.propertyName === 'grid-template-rows') {
          finishScrolling()
        }
      }
      for (const frame of unfoldedFrames) frame.addEventListener('transitionend', onTransitionEnd)
      window.setTimeout(finishScrolling, 260)
    }

    const marker = new Mark(target)
    marker.unmark({
      done: () => marker.mark(query, {
        className: 'search-highlight',
        separateWordSearch: true,
        acrossElements: true,
        ignoreJoiners: true,
      }),
    })
  })()
}

export function startSearchHighlighting() {
  document.addEventListener('anta-search-navigate', (event) => {
    pendingNavigation = (event as CustomEvent<PendingNavigation>).detail
  })
  document.addEventListener('astro:page-load', highlightSearchTarget)
  highlightSearchTarget()
}
