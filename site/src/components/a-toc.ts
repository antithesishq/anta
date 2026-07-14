/**
 * `<a-toc>` — site-local "On this page" table of contents.
 *
 * Scans the current page's `<main>` for headings (`h1`–`h6` that carry an
 * `id`, which `rehype-slug` adds to every heading) and renders a nested,
 * indented `<nav>` of links entirely in shadow DOM. Clicking a link
 * smooth-scrolls to the section (native fragment navigation + the page's
 * `scroll-behavior: smooth` / `scroll-padding-top`); an IntersectionObserver
 * marks the link for the section currently in view with `aria-current="true"`.
 *
 * This is NOT part of the published `@antadesign/anta` package — it lives in
 * the docs site only. It styles itself purely from Anta's global design
 * tokens (`--text-*`, `--bg-*`, …), which are inherited CSS custom properties
 * and so cross the shadow boundary; it needs no Anta element CSS.
 */

/** Heading levels to include and the selector used to find them. The page
 *  title (h1) is excluded — the TOC starts at h2. A `max-level` attribute caps
 *  the deepest level shown (e.g. `max-level="2"` lists only h2s). */
const HEADING_SELECTOR = ':is(h2,h3,h4,h5,h6)[id]'
/** Indentation step per nesting level, in px. */
const INDENT_STEP = 12
/** Don't render a TOC for pages with fewer than this many headings. */
const MIN_HEADINGS = 2

type Entry = { id: string; text: string; level: number }

export class ATocElement extends HTMLElement {
  private headings: HTMLElement[] = []
  private links = new Map<string, HTMLAnchorElement>()
  private visible = new Map<string, boolean>()
  private observer: IntersectionObserver | null = null
  private activeId: string | null = null
  private track: HTMLElement | null = null
  private thumb: HTMLElement | null = null
  private rafId = 0
  private onScroll = () => {
    if (this.rafId) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.updateScrollbar()
    })
  }

  connectedCallback() {
    // Build on the next frame, not requestIdleCallback: the headings (and their
    // rehype-slug ids) are already in the server-rendered HTML by the time this
    // upgrades, so waiting for idle only left the reserved-width rail blank for
    // a beat after load. rAF runs after the current layout pass and before
    // paint, so the TOC fills in right away; scroll positions self-correct on
    // the scroll / resize listeners build() attaches.
    requestAnimationFrame(() => this.build())
  }

  disconnectedCallback() {
    this.observer?.disconnect()
    this.observer = null
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('resize', this.onScroll)
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }

  private build() {
    const root = document.querySelector('main')
    if (!root) return

    // `max-level` caps the deepest heading shown (default 6 = all). e.g. the
    // Changelog sets `max-level="2"` so the TOC lists version headings only,
    // not every Added / Fixed / Changed subsection under them.
    const maxLevel = Number(this.getAttribute('max-level')) || 6

    this.headings = Array.from(
      root.querySelectorAll<HTMLElement>(HEADING_SELECTOR),
    ).filter((h) => h.textContent?.trim() && Number(h.tagName[1]) <= maxLevel)

    if (this.headings.length < MIN_HEADINGS) return

    const entries: Entry[] = this.headings.map((h) => ({
      id: h.id,
      text: h.textContent!.trim(),
      level: Number(h.tagName[1]),
    }))
    const minLevel = Math.min(...entries.map((e) => e.level))

    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    shadow.replaceChildren()

    const style = document.createElement('style')
    style.textContent = this.css()
    shadow.append(style)

    const nav = document.createElement('nav')
    nav.setAttribute('aria-label', 'On this page')

    const heading = document.createElement('a')
    heading.className = 'toc-title'
    heading.href = '#'
    heading.textContent = 'On this page'
    heading.addEventListener('click', (e) => {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // Drop the fragment so the URL reflects "top of page".
      history.replaceState(null, '', location.pathname + location.search)
      this.setActive('')
    })
    nav.append(heading)

    // Scroll-progress rail: a faint full-height track whose length maps to
    // the whole page, with a brighter thumb representing the current viewport.
    const wrap = document.createElement('div')
    wrap.className = 'list-wrap'
    const track = document.createElement('div')
    track.className = 'scroll-track'
    this.track = track
    this.thumb = document.createElement('div')
    this.thumb.className = 'scroll-thumb'
    track.append(this.thumb)
    wrap.append(track)

    const list = document.createElement('ul')
    this.links.clear()
    for (const entry of entries) {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.href = `#${encodeURIComponent(entry.id)}`
      a.textContent = entry.text
      a.style.setProperty('--_depth', String(entry.level - minLevel))
      // Reflect the active link immediately on click; the observer would
      // otherwise lag the smooth-scroll by a frame or two.
      a.addEventListener('click', () => this.setActive(entry.id))
      li.append(a)
      list.append(li)
      this.links.set(entry.id, a)
    }
    wrap.append(list)
    nav.append(wrap)
    shadow.append(nav)

    this.observe()

    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('resize', this.onScroll, { passive: true })
    this.updateScrollbar()

    // The whole TOC is built at once a frame after upgrade, so it would
    // otherwise pop in from blank. `nav` starts at opacity 0 (see css()); flip
    // it on the next frame so the change animates instead of snapping.
    requestAnimationFrame(() => nav.classList.add('ready'))
  }

  /** Position the thumb against the *headings'* positions rather than a flat
   *  page fraction, so the thumb parks next to the current section's TOC entry
   *  and glides between entries as you scroll — a deliberately non-linear map.
   *
   *  We build a piecewise-linear function from a document Y coordinate to a
   *  track position, with a knot at every heading: `headingAbsTop → linkTop`.
   *  Synthetic endpoints (page top → track top, page bottom → track bottom)
   *  anchor the extremes. The thumb then maps the viewport's top edge (the
   *  scroll-spy trip line, so a clicked heading lands its link exactly) and
   *  bottom edge through that function. */
  private updateScrollbar() {
    if (!this.thumb || !this.track || this.headings.length === 0) return
    const de = document.documentElement
    const sh = de.scrollHeight
    const sy = window.scrollY
    const trackH = this.track.clientHeight
    if (sh <= 0 || trackH <= 0) return

    const offset = parseInt(getComputedStyle(de).scrollPaddingTop, 10) || 16

    // Knots: ascending document Y → track position (px from track top).
    const docY: number[] = [0]
    const pos: number[] = [0]
    for (const h of this.headings) {
      const link = this.links.get(h.id)
      if (!link) continue
      docY.push(h.getBoundingClientRect().top + sy)
      pos.push(link.offsetTop)
    }
    docY.push(sh)
    pos.push(trackH)

    const map = (y: number): number => {
      if (y <= docY[0]) return pos[0]
      for (let i = 1; i < docY.length; i++) {
        if (y <= docY[i]) {
          const span = docY[i] - docY[i - 1] || 1
          return pos[i - 1] + ((y - docY[i - 1]) / span) * (pos[i] - pos[i - 1])
        }
      }
      return pos[pos.length - 1]
    }

    const top = map(sy + offset)
    const bottom = map(sy + window.innerHeight)
    this.thumb.style.setProperty('--_thumb-top', `${top}px`)
    this.thumb.style.setProperty('--_thumb-height', `${Math.max(16, bottom - top)}px`)
  }

  private observe() {
    this.observer?.disconnect()

    // Trip line just below the sticky-header offset; a heading counts as
    // "in view" only while it sits in the top slice of the viewport.
    const top =
      parseInt(getComputedStyle(document.documentElement).scrollPaddingTop, 10) || 16
    this.observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          this.visible.set((r.target as HTMLElement).id, r.isIntersecting)
        }
        this.updateActive()
      },
      { rootMargin: `-${top}px 0px -70% 0px`, threshold: 0 },
    )
    for (const h of this.headings) this.observer.observe(h)
    this.updateActive()
  }

  /** Pick the active heading: the first heading currently in the trip-line
   *  band, or — when none is (a long section with no heading in the band) —
   *  the last heading whose top has scrolled above the band. */
  private updateActive() {
    let active: string | null = null
    for (const h of this.headings) {
      if (this.visible.get(h.id)) {
        active = h.id
        break
      }
    }
    if (!active) {
      const fold = Math.max(80, window.innerHeight * 0.3)
      for (const h of this.headings) {
        if (h.getBoundingClientRect().top <= fold) active = h.id
      }
    }
    if (active) this.setActive(active)
  }

  private setActive(id: string) {
    if (id === this.activeId) return
    if (this.activeId) this.links.get(this.activeId)?.removeAttribute('aria-current')
    this.links.get(id)?.setAttribute('aria-current', 'true')
    this.activeId = id
  }

  private css() {
    return `
      :host {
        display: block;
        font-size: 13px;
        line-height: 1.4;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        opacity: 0;
        transition: opacity 300ms ease-out;
      }
      nav.ready {
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        nav { transition: none; }
      }
      .toc-title {
        display: block;
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-3-brand);
        text-decoration: none;
        cursor: pointer;
        transition: color 160ms ease-out;
      }
      .toc-title:hover,
      .toc-title:focus-visible {
        color: var(--text-1-brand);
        outline: none;
      }
      .list-wrap {
        position: relative;
        padding-inline-start: 14px;
      }
      .scroll-track {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 2px;
        width: 2px;
        background: var(--border-5);
        border-radius: 1px;
      }
      .scroll-thumb {
        position: absolute;
        inset-inline-start: 0;
        width: 2px;
        top: var(--_thumb-top, 0);
        height: var(--_thumb-height, 100%);
        background: linear-gradient(to bottom, var(--border-1), var(--border-5));
        border-radius: 1px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      a {
        display: block;
        padding: 4px 0 4px calc(var(--_depth, 0) * ${INDENT_STEP}px);
        color: var(--text-3);
        text-decoration: none;
        letter-spacing: 0.03ch;
        transition: color 160ms ease-out;
        overflow-wrap: anywhere;
      }
      a:hover,
      a:focus-visible {
        color: var(--text-1);
        outline: none;
        text-decoration: underline dotted;
        text-decoration-color: color-mix(in srgb, currentColor 75%, transparent);
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }
      a[aria-current="true"] {
        color: var(--text-1);
      }
    `
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('a-toc')) {
  customElements.define('a-toc', ATocElement)
}
