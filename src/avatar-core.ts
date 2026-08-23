/**
 * avatar-core — pure, framework-free generation for the `<Avatar>` userpic.
 *
 * No DOM, no React. An alphanumeric seed string is hashed to drive a
 * deterministic PRNG, which samples each enabled generation dimension within its
 * configured space. The result is a renderer-agnostic description (colors +
 * geometry, or an initials fallback) that `avatarToSvg` turns into SVG markup.
 * `<a-avatar>` uses it to render inside its shadow root; a non-React consumer can
 * call the same functions. Published as `@antadesign/anta` named exports.
 *
 * Same `(config, seed)` always yields the same avatar, so a user's picture is
 * stable and different users are visually distinguishable.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG — a string hash (xmur3) feeding mulberry32. No RNG utility exists
// elsewhere in the package, so these are self-contained.
// ---------------------------------------------------------------------------

/** Hash an arbitrary string to a 32-bit unsigned integer (xmur3 finalizer). */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

/** A deterministic `() => [0, 1)` generator seeded by a 32-bit integer. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Build a PRNG straight from a seed string. */
export const rngFromSeed = (seed: string): (() => number) => mulberry32(hashSeed(seed))

// ---------------------------------------------------------------------------
// Initials
// ---------------------------------------------------------------------------

/**
 * Up to `max` letters for the initials fallback: the first letter of each of the
 * first `max` whitespace-separated words, uppercased. `"Vlad Korobov"` → `"VK"`.
 */
export function getInitials(name: string | undefined | null, max = 3): string {
  if (!name) return ''
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => [...w][0]!.toUpperCase())
    .join('')
}

// ---------------------------------------------------------------------------
// OKLCH gamut math (ported from site/src/components/ColorPicker.tsx) so sampled
// colors stay inside sRGB — the browser would otherwise clip them unpredictably.
// ---------------------------------------------------------------------------

type Triple = [number, number, number]
const C_CEIL = 0.4

function oklchToLinear(L: number, C: number, H: number): Triple {
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

function inGamut(L: number, C: number, H: number): boolean {
  const [r, g, b] = oklchToLinear(L, C, H)
  const e = 0.0008
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e
}

/** Largest in-sRGB chroma at this lightness and hue (binary search). */
export function maxChroma(L: number, H: number): number {
  let lo = 0
  let hi = C_CEIL
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2
    if (inGamut(L, m, H)) lo = m
    else hi = m
  }
  return lo
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

/** `oklch(L C H)` with chroma clamped into sRGB. */
export function oklchString(L: number, C: number, H: number): string {
  const c = Math.min(C, maxChroma(L, H))
  return `oklch(${round(L)} ${round(c)} ${round(((H % 360) + 360) % 360, 1)})`
}

/** Approximate OKLCH lightness of a CSS color — reads the `L` from an
 *  `oklch(L C H)` string, or estimates it from a `#rgb` / `#rrggbb` hex; falls
 *  back to a mid value for anything else. Used only to pick readable initials. */
export function colorLightness(color: string): number {
  const c = color.trim()
  const ok = /^oklch\(\s*([\d.]+)/i.exec(c)
  if (ok) return Math.max(0, Math.min(1, parseFloat(ok[1])))
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    // Perceptual-ish luminance, close enough to OKLCH L for a light/dark choice.
    return 0.299 * r + 0.587 * g + 0.114 * b
  }
  return 0.6
}

// ---------------------------------------------------------------------------
// Generation config
// ---------------------------------------------------------------------------

/** How a dimension varies with the seed.
 *  - `off` — excluded; the dimension holds its neutral default.
 *  - `any` — varies across its full natural range.
 *  - `range` — varies within an explicit `[min, max]`.
 *  - `list` — picks one value at random from an explicit set. */
export type DimMode = 'off' | 'any' | 'range' | 'list'

/** A numeric dimension (scale, angle, corner radius). */
export interface ScalarDim {
  mode?: DimMode
  /** RANGE bounds (defaults to the dimension's natural range when omitted). */
  min?: number
  max?: number
  /** LIST of allowed values the seed picks from. */
  values?: number[]
}

/** The figure's x/y offset from center (viewBox units, −50…50). */
export interface Vec2Dim {
  mode?: DimMode
  /** RANGE bounds per axis. */
  x?: [number, number]
  y?: [number, number]
  /** LIST of allowed `[x, y]` points. */
  values?: [number, number][]
}

/**
 * A color dimension. RANGE caps OKLCH `l`/`c`/`h` (chroma clamped in-gamut);
 * LIST passes an explicit palette (a brand scheme) the seed picks from.
 */
export interface ColorDim {
  mode?: DimMode
  /** RANGE OKLCH bounds `[min, max]` (defaults to the natural range). */
  l?: [number, number]
  c?: [number, number]
  h?: [number, number]
  /** LIST of CSS colors the seed picks from (a palette / scheme). */
  values?: string[]
}

/** Full generation config. Every field is optional; `DEFAULT_CONFIG` fills gaps. */
export interface AvatarGenConfig {
  bgColor?: ColorDim
  headColor?: ColorDim
  bodyColor?: ColorDim
  figureScale?: ScalarDim
  figureTranslate?: Vec2Dim
  figureAngle?: ScalarDim
  headAngle?: ScalarDim
  bodyAngle?: ScalarDim
  /** Space between head and body, as a fraction of head height (0 to 1). */
  figureGap?: ScalarDim
  /** Head top corner radius. 0 is a square corner and 1 is fully round; above 1
   *  the head elongates upward into an oval. */
  headRadiusTop?: ScalarDim
  /** Head bottom corner radius, on the same 0-to-1-and-beyond scale. The bottom
   *  is never rounded less than the top — a head reads with its jaw at least as
   *  round as its crown — so a smaller value here is raised to match the top. */
  headRadiusBottom?: ScalarDim
  /** Shoulder corner radius, 0 (square) to 1 (fully round). */
  bodyBorderRadius?: ScalarDim
  /** Derive `headColor` and `bodyColor` hue from the background so the parts
   *  stay coordinated with the background. */
  harmony?: boolean
}

/**
 * Natural range and neutral (OFF) default for each numeric dimension.
 *
 * `bias` skews the ANY distribution inside the range: an exponent below 1 pulls
 * samples toward the top of it. The head radii use it because a head reads
 * better round than square, so they average close to a circle while still
 * reaching squarer shapes. RANGE stays uniform — an explicit range means
 * exactly what it says.
 */
const NATURAL = {
  figureScale: { range: [0.76, 1.2] as const, off: 1 },
  figureAngle: { range: [-15, 15] as const, off: 0 },
  headAngle: { range: [-20, 20] as const, off: 0 },
  bodyAngle: { range: [-16, 16] as const, off: 0 },
  figureGap: { range: [0.12, 0.42] as const, off: 0.25 },
  headRadiusTop: { range: [0.35, 1.25] as const, off: 1, bias: 0.6 },
  headRadiusBottom: { range: [0.45, 1.5] as const, off: 1, bias: 0.6 },
  bodyBorderRadius: { range: [0.25, 1] as const, off: 1 },
}

/** One numeric dimension's distribution. */
type ScalarMeta = { range: readonly [number, number]; off: number; bias?: number }
const TRANSLATE_NATURAL: { x: [number, number]; y: [number, number]; off: [number, number] } = {
  x: [-15, 15],
  y: [-14, 4],
  off: [0, 0],
}

/** Natural OKLCH ranges and neutral (OFF) default for each color dimension.
 *  Muted, mid-tone background; lighter, low-chroma head and body — the earthy
 *  register of the reference sheet, on-brand-neutral until an app narrows it. */
const COLOR_NATURAL: Record<'bgColor' | 'headColor' | 'bodyColor', { l: [number, number]; c: [number, number]; h: [number, number]; off: string }> = {
  bgColor: { l: [0.5, 0.82], c: [0.02, 0.12], h: [0, 360], off: 'oklch(0.7 0 0)' },
  headColor: { l: [0.78, 0.96], c: [0.015, 0.075], h: [0, 360], off: 'oklch(0.9 0 0)' },
  bodyColor: { l: [0.68, 0.9], c: [0.015, 0.09], h: [0, 360], off: 'oklch(0.88 0 0)' },
}

/** A config that produces a pleasant, fully-varied figure avatar. */
export const DEFAULT_CONFIG: Required<Omit<AvatarGenConfig, 'harmony'>> & { harmony: boolean } = {
  bgColor: { mode: 'any' },
  headColor: { mode: 'any' },
  bodyColor: { mode: 'any' },
  figureScale: { mode: 'any' },
  figureTranslate: { mode: 'any' },
  figureAngle: { mode: 'any' },
  headAngle: { mode: 'any' },
  bodyAngle: { mode: 'any' },
  figureGap: { mode: 'any' },
  headRadiusTop: { mode: 'any' },
  headRadiusBottom: { mode: 'any' },
  bodyBorderRadius: { mode: 'any' },
  harmony: true,
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

const lerp = (t: number, a: number, b: number) => a + (b - a) * t
const pickOf = <T>(t: number, arr: T[]): T => arr[Math.min(arr.length - 1, Math.floor(t * arr.length))]

/** Resolve a numeric dimension to a value for this draw. */
function sampleScalar(rng: () => number, dim: ScalarDim | undefined, meta: ScalarMeta): number {
  const mode = dim?.mode ?? 'any'
  if (mode === 'off') return meta.off
  if (mode === 'list' && dim?.values?.length) return pickOf(rng(), dim.values)
  if (mode === 'range') return lerp(rng(), dim?.min ?? meta.range[0], dim?.max ?? meta.range[1])
  return lerp(meta.bias ? rng() ** meta.bias : rng(), meta.range[0], meta.range[1])
}

function sampleVec2(rng: () => number, dim: Vec2Dim | undefined): [number, number] {
  const mode = dim?.mode ?? 'off'
  if (mode === 'off') return TRANSLATE_NATURAL.off
  if (mode === 'list' && dim?.values?.length) return pickOf(rng(), dim.values)
  const xr = mode === 'range' ? dim?.x ?? TRANSLATE_NATURAL.x : TRANSLATE_NATURAL.x
  const yr = mode === 'range' ? dim?.y ?? TRANSLATE_NATURAL.y : TRANSLATE_NATURAL.y
  return [lerp(rng(), xr[0], xr[1]), lerp(rng(), yr[0], yr[1])]
}

/** Resolve a color dimension to a CSS color string (and its lightness). */
function sampleColor(
  rng: () => number,
  dim: ColorDim | undefined,
  natural: { l: [number, number]; c: [number, number]; h: [number, number]; off: string },
  forcedHue?: number,
): { color: string; l: number } {
  const mode = dim?.mode ?? 'any'
  if (mode === 'off') return { color: natural.off, l: colorLightness(natural.off) }
  if (mode === 'list' && dim?.values?.length) {
    const color = pickOf(rng(), dim.values)
    return { color, l: colorLightness(color) }
  }
  const lr = mode === 'range' ? dim?.l ?? natural.l : natural.l
  const cr = mode === 'range' ? dim?.c ?? natural.c : natural.c
  const hr = mode === 'range' ? dim?.h ?? natural.h : natural.h
  const l = lerp(rng(), lr[0], lr[1])
  const c = lerp(rng(), cr[0], cr[1])
  const h = forcedHue ?? lerp(rng(), hr[0], hr[1])
  return { color: oklchString(l, c, h), l }
}

// ---------------------------------------------------------------------------
// Geometry constants (viewBox 0 0 100 100, head centered at 50,50 when
// figureTranslate is 0 — the anchor the spec defines).
// ---------------------------------------------------------------------------

/** The square frame's side, in viewBox units. */
const FRAME = 100
const CENTER = FRAME / 2
const HEAD_SIZE = 40
const BODY_W = 74

export interface ResolvedHead {
  color: string
  /** Top corner radius in user units. At `HEAD_SIZE / 2` the top is a
   *  semicircle; equal to `radiusBottom` at that value the head is a circle. */
  radiusTop: number
  /** Bottom corner radius in user units. */
  radiusBottom: number
  /** How far the head's top edge extends past the base box, in user units. A
   *  radius above 1 spends the excess here, elongating the head into an oval. */
  extendTop: number
  /** How far the head's bottom edge extends past the base box. */
  extendBottom: number
  angle: number
}
export interface ResolvedBody {
  color: string
  /** Corner radius in user units (half the body's width is fully round). */
  radius: number
  /** Body height in user units — one frame height as *rendered*, so the
   *  silhouette always runs past the bottom edge however far down its top starts
   *  (a wide gap, an elongated head) and however much the figure shrinks. */
  height: number
  angle: number
}

/** Renderer-agnostic description of one avatar. */
export interface ResolvedAvatar {
  /** Ink for the initials fallback: the background's own hue at a text-like
   *  lightness, so the letters read as tinted ink on the generated color. It is
   *  derived from the background rather than a theme text token because the
   *  background does not follow the theme — a theme token would go light-on-light
   *  in dark mode. */
  initialsColor: string
  /** `true` for a generated head + shoulders figure; `false` for the initials
   *  fallback (no figure shape was configured). */
  figure: boolean
  bg: string
  bgLightness: number
  scale: number
  translate: [number, number]
  angle: number
  /** Space between head and body in user units. */
  gap: number
  head: ResolvedHead
  body: ResolvedBody
}

/** The shape dimensions — all OFF means nothing shape-like was chosen, so the
 *  avatar falls back to initials. */
const SHAPE_DIMS = ['headRadiusTop', 'headRadiusBottom', 'bodyBorderRadius'] as const

/** A figure is drawn when at least one shape dimension is enabled. */
export function hasFigure(config: AvatarGenConfig): boolean {
  return SHAPE_DIMS.some((k) => (config[k]?.mode ?? DEFAULT_CONFIG[k].mode) !== 'off')
}

/**
 * Resolve a config + seed to a concrete avatar. Deterministic: the same inputs
 * always return the same result. Dimensions are sampled in a fixed order so a
 * config change to one dimension does not shuffle the others.
 */
export function resolveAvatar(config: AvatarGenConfig, seed: string): ResolvedAvatar {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const rng = rngFromSeed(seed)

  const bg = sampleColor(rng, cfg.bgColor, COLOR_NATURAL.bgColor)
  const bgHue = readHue(bg.color)
  const head = sampleColor(rng, cfg.headColor, COLOR_NATURAL.headColor, cfg.harmony ? bgHue : undefined)
  const body = sampleColor(rng, cfg.bodyColor, COLOR_NATURAL.bodyColor, cfg.harmony ? bgHue : undefined)

  const scale = sampleScalar(rng, cfg.figureScale, NATURAL.figureScale)
  const translate = sampleVec2(rng, cfg.figureTranslate)
  const angle = sampleScalar(rng, cfg.figureAngle, NATURAL.figureAngle)
  const headAngle = sampleScalar(rng, cfg.headAngle, NATURAL.headAngle)
  const bodyAngle = sampleScalar(rng, cfg.bodyAngle, NATURAL.bodyAngle)
  const gapFrac = sampleScalar(rng, cfg.figureGap, NATURAL.figureGap)
  const headTop = sampleScalar(rng, cfg.headRadiusTop, NATURAL.headRadiusTop)
  const headBottom = sampleScalar(rng, cfg.headRadiusBottom, NATURAL.headRadiusBottom)
  const bodyRadiusFrac = sampleScalar(rng, cfg.bodyBorderRadius, NATURAL.bodyBorderRadius)

  // Radii are fractions of "fully round": half the head's side, and half the
  // body's short side. So 1 is a circle (head) or a stadium (body), 0 is square.
  const headUnit = HEAD_SIZE / 2
  const bodyUnit = BODY_W / 2 // fully round shoulders are a half-width semicircle

  // The body is one frame height as rendered: dividing by the figure's scale
  // keeps it frame-tall after the group transform shrinks it, so a small scale
  // can't lift its bottom edge inside the frame and cut the silhouette short.
  const bodyHeight = FRAME / Math.min(1, scale)

  // A head is never rounded less at the bottom than at the top: a rounder crown
  // over a squarer jaw reads mechanical, so raise the bottom to meet the top.
  const topFrac = headTop
  const bottomFrac = Math.max(headTop, headBottom)

  // Up to 1 the fraction rounds the corners; the excess above 1 elongates that
  // half of the head away from center, turning a circle into an oval.
  const cornerTop = Math.min(topFrac, 1) * headUnit
  const cornerBottom = Math.min(bottomFrac, 1) * headUnit
  const extendTop = Math.max(0, topFrac - 1) * headUnit
  const extendBottom = Math.max(0, bottomFrac - 1) * headUnit

  return {
    figure: hasFigure(config),
    bg: bg.color,
    bgLightness: bg.l,
    initialsColor: initialsInk(bg.color, bg.l),
    scale,
    translate,
    angle,
    // The gap tracks the head's rendered height, so an elongated head keeps the
    // same proportional distance from the shoulders.
    gap: gapFrac * (HEAD_SIZE + extendTop + extendBottom),
    head: {
      color: head.color,
      radiusTop: cornerTop,
      radiusBottom: cornerBottom,
      extendTop,
      extendBottom,
      angle: headAngle,
    },
    body: { color: body.color, radius: bodyRadiusFrac * bodyUnit, height: bodyHeight, angle: bodyAngle },
  }
}

/**
 * Ink for the initials: the background's hue at a text-like lightness — dark ink
 * on a light background, light ink on a dark one — with chroma held low so the
 * letters read as ink rather than a second fill. A background whose hue can't be
 * read (a hex from a palette) gets neutral ink.
 */
function initialsInk(bg: string, bgL: number): string {
  const tinted = /^oklch\(/i.test(bg.trim())
  const hue = tinted ? readHue(bg) : 0
  return bgL > 0.5 ? oklchString(0.35, tinted ? 0.06 : 0, hue) : oklchString(0.95, tinted ? 0.04 : 0, hue)
}

/** Read a hue from an `oklch(L C H)` string; 0 if absent (used for harmony). */
function readHue(color: string): number {
  const m = /^oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/i.exec(color.trim())
  return m ? parseFloat(m[1]) : 0
}

// ---------------------------------------------------------------------------
// SVG rendering (the only renderer today; geometry above stays renderer-agnostic
// so a canvas renderer can consume the same ResolvedAvatar later).
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface SvgOptions {
  /** Initials to draw when `resolved.figure` is false. */
  initials?: string
  /** Accessible title placed in the SVG. */
  title?: string
}

/** Build SVG markup for a resolved avatar. Fills a 0–100 square; the host clips
 *  it to the container shape (round or rounded-square) via `overflow: hidden`. */
export function avatarToSvg(resolved: ResolvedAvatar, opts: SvgOptions = {}): string {
  // Colors reach the markup as attribute values. They come from the app's config
  // (a palette) or from `oklchString`, so escaping is defense in depth.
  const bg = esc(resolved.bg)
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : ''
  const bgRect = `<rect x="0" y="0" width="${FRAME}" height="${FRAME}" fill="${bg}"/>`

  if (!resolved.figure) {
    const text = opts.initials
      ? `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="var(--avatar-font, system-ui, sans-serif)" font-weight="500" ` +
        `font-size="${initialsFontSize(opts.initials.length)}" ` +
        `fill="var(--avatar-initials-color, ${esc(resolved.initialsColor)})"` +
        `>${esc(opts.initials)}</text>`
      : ''
    return svgWrap(title + bgRect + text)
  }

  const [tx, ty] = resolved.translate
  const group =
    `translate(${round(tx, 2)} ${round(ty, 2)}) ` +
    `rotate(${round(resolved.angle, 2)} 50 50) ` +
    `translate(50 50) scale(${round(resolved.scale, 3)}) translate(-50 -50)`

  const { extendTop, extendBottom } = resolved.head
  const headTopEdge = CENTER - HEAD_SIZE / 2 - extendTop
  const headHeight = HEAD_SIZE + extendTop + extendBottom
  const headPath = roundedRectPath(
    CENTER - HEAD_SIZE / 2,
    headTopEdge,
    HEAD_SIZE,
    headHeight,
    resolved.head.radiusTop,
    resolved.head.radiusBottom,
  )
  const headShape =
    `<g transform="rotate(${round(resolved.head.angle, 2)} 50 50)">` +
    `<path d="${headPath}" fill="${esc(resolved.head.color)}"/></g>`

  const bodyTop = headTopEdge + headHeight + resolved.gap
  const bodyPath = roundedRectPath(CENTER - BODY_W / 2, bodyTop, BODY_W, resolved.body.height, resolved.body.radius, resolved.body.radius)
  const bodyShape =
    `<g transform="rotate(${round(resolved.body.angle, 2)} 50 ${round(bodyTop, 2)})">` +
    `<path d="${bodyPath}" fill="${esc(resolved.body.color)}"/></g>`

  return svgWrap(`${title}${bgRect}<g transform="${group}">${bodyShape}${headShape}</g>`)
}

/**
 * Rounded-rect path with independent top and bottom corner radii. Equal radii at
 * half the side make a circle (square box) or a stadium (oblong box); differing
 * ones make an egg. A radius of 0 degrades to a sharp corner.
 */
function roundedRectPath(x: number, y: number, w: number, h: number, rTop: number, rBottom: number): string {
  let t = Math.max(0, Math.min(rTop, w / 2))
  let b = Math.max(0, Math.min(rBottom, w / 2))
  // Two radii share the box height — scale them together rather than clipping
  // one, so a tall-radius pair stays symmetric instead of lopsided.
  const sum = t + b
  if (sum > h && sum > 0) {
    const k = h / sum
    t *= k
    b *= k
  }
  const n = (v: number) => round(v, 2)
  const arc = (r: number, ex: number, ey: number) => `A${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}`
  return [
    `M${n(x + t)} ${n(y)}`,
    `H${n(x + w - t)}`,
    t ? arc(t, x + w, y + t) : '',
    `V${n(y + h - b)}`,
    b ? arc(b, x + w - b, y + h) : '',
    `H${n(x + b)}`,
    b ? arc(b, x, y + h - b) : '',
    `V${n(y + t)}`,
    t ? arc(t, x + t, y) : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}

const svgWrap = (inner: string) =>
  `<svg viewBox="0 0 ${FRAME} ${FRAME}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" ` +
  `xmlns="http://www.w3.org/2000/svg" role="presentation">${inner}</svg>`

/** Shrink the initials to keep 1–3 letters inside the frame. */
const initialsFontSize = (len: number) => (len >= 3 ? 30 : len === 2 ? 38 : 46)
