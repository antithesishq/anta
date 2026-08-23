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
 * Shadow structure — the picture is the box, with no wrapper around it:
 *
 *   :host
 *     <svg> | <img>   ← the generated figure or the image, part="frame"
 *     .badge          ← the optional corner badge, part="badge"
 *
 * The picture carries the frame's radius and the badge cutout; the host stays
 * unclipped so the badge can sit at the very corner.
 */
export class AAvatarElement extends HTMLElementBase {
  static observedAttributes = ['seed', 'name', 'src', 'size', 'badge', 'config']

  #badge: HTMLSpanElement
  #picture?: Element

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.#badge = document.createElement('span')
    this.#badge.className = 'badge'
    this.#badge.setAttribute('part', 'badge')
    this.#badge.style.display = 'none'

    shadow.append(style, this.#badge)
  }

  /** Swap in the picture, keeping it between the style and the indicator. */
  #setPicture(node: Element) {
    if (this.#picture) this.#picture.replaceWith(node)
    else this.#badge.before(node)
    this.#picture = node
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
    // The badge's color comes from the host CSS (its tone); the element only
    // decides whether it shows.
    const badge = this.getAttribute('badge')
    this.#badge.style.display = badge && badge !== 'none' ? '' : 'none'

    const name = this.getAttribute('name') ?? undefined
    const src = this.getAttribute('src')

    if (src) {
      const img = document.createElement('img')
      img.setAttribute('part', 'frame image')
      img.src = src
      img.alt = name ?? ''
      img.loading = 'lazy'
      this.#setPicture(img)
      return
    }

    const seed = this.getAttribute('seed') ?? name ?? ''
    const resolved = resolveAvatar(this.#parseConfig(), seed)
    // Parse through a template so the shadow root's own children survive; the
    // generated markup is ours, and `avatar-core` escapes the name it embeds.
    const tpl = document.createElement('template')
    tpl.innerHTML = avatarToSvg(resolved, { initials: getInitials(name), title: name })
    const svg = tpl.content.firstElementChild
    if (svg) {
      svg.setAttribute('part', 'frame')
      this.#setPicture(svg)
    }
  }
}

// Shadow styles, injected verbatim into every <a-avatar> shadow root — kept
// COMMENT-FREE (it ships and re-injects per instance; see AGENTS.md). The host
// box, tokens, size variants, dark mode, and the pre-upgrade skeleton live in
// the external a-avatar.css; this only lays out the shadow-internal nodes.
const SHADOW_STYLE = `
  :host { display: inline-block; position: relative; vertical-align: middle; }
  svg, img {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    border-radius: var(--avatar-radius);
    background: var(--avatar-placeholder-bg);
    mask-image: var(--avatar-badge-mask);
  }
  img { object-fit: cover; }
  .badge {
    position: absolute;
    right: var(--avatar-badge-inset);
    bottom: var(--avatar-badge-inset);
    inline-size: var(--avatar-badge-size);
    block-size: var(--avatar-badge-size);
    border-radius: 50%;
    background: var(--avatar-badge-color);
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
