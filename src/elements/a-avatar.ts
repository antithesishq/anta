import { HTMLElementBase } from '../anta_helpers'
import { resolveAvatar, avatarToSvg, getInitials, DEFAULT_CONFIG, type AvatarGenConfig } from '../avatar-core'
import './a-avatar.css'

/**
 * `<a-avatar>` — a userpic container. It shows one of three things, in priority
 * order: the `src` image, a seed-generated figure, or initials from `name`.
 *
 * Generation runs in `avatar-core` (pure) and is drawn into the shadow root as
 * SVG. `seed` (falling back to `name`) drives the deterministic result; the
 * brand constraints ride on the `config` attribute as a JSON string, so the
 * element stays declarative — it works from server-rendered HTML and hand-
 * authored markup, not only through the wrapper. With no `config`,
 * `DEFAULT_CONFIG` produces a varied figure; a config whose head and body shapes
 * are both `off` renders initials.
 *
 * Shadow structure (the host is the box; the content is clipped to the container
 * shape by `.content { overflow: hidden }`):
 *
 *   :host
 *     .content   ← the image / generated SVG, part="frame"
 *     .status    ← the optional corner indicator, part="status"
 */
export class AAvatarElement extends HTMLElementBase {
  static observedAttributes = ['seed', 'name', 'src', 'size', 'status', 'config']

  #content: HTMLDivElement
  #status: HTMLSpanElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.#content = document.createElement('div')
    this.#content.className = 'content'
    this.#content.setAttribute('part', 'frame')

    this.#status = document.createElement('span')
    this.#status.className = 'status'
    this.#status.setAttribute('part', 'status')
    this.#status.style.display = 'none'

    shadow.append(style, this.#content, this.#status)
  }

  connectedCallback() {
    this.#render()
  }

  attributeChangedCallback() {
    this.#render()
  }

  /** Parse the `config` JSON attribute; fall back to the varied default. */
  #parseConfig(): AvatarGenConfig {
    const raw = this.getAttribute('config')
    if (!raw) return DEFAULT_CONFIG
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  }

  #render() {
    // The dot's color comes from the host CSS (the status tone); the element
    // only decides whether it shows.
    const status = this.getAttribute('status')
    this.#status.style.display = status && status !== 'none' ? '' : 'none'

    const name = this.getAttribute('name') ?? undefined
    const src = this.getAttribute('src')

    if (src) {
      const img = document.createElement('img')
      img.setAttribute('part', 'image')
      img.src = src
      img.alt = name ?? ''
      img.loading = 'lazy'
      this.#content.replaceChildren(img)
      return
    }

    const seed = this.getAttribute('seed') ?? name ?? ''
    const resolved = resolveAvatar(this.#parseConfig(), seed)
    this.#content.innerHTML = avatarToSvg(resolved, { initials: getInitials(name), title: name })
  }
}

// Shadow styles, injected verbatim into every <a-avatar> shadow root — kept
// COMMENT-FREE (it ships and re-injects per instance; see AGENTS.md). The host
// box, tokens, size variants, dark mode, and the pre-upgrade skeleton live in
// the external a-avatar.css; this only lays out the shadow-internal nodes.
const SHADOW_STYLE = `
  :host { display: inline-block; position: relative; vertical-align: middle; }
  .content {
    inline-size: 100%;
    block-size: 100%;
    border-radius: var(--avatar-radius);
    overflow: hidden;
    background: var(--avatar-placeholder-bg);
  }
  .content svg, .content img { display: block; inline-size: 100%; block-size: 100%; }
  .content img { object-fit: cover; }
  .status {
    position: absolute;
    right: 0;
    bottom: 0;
    inline-size: var(--avatar-status-size);
    block-size: var(--avatar-status-size);
    border-radius: 50%;
    background: var(--avatar-status-color);
    box-shadow: 0 0 0 var(--avatar-status-ring-width) var(--avatar-status-ring);
  }
`

export function register_a_avatar() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-avatar')) {
    customElements.define('a-avatar', AAvatarElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_avatar()
