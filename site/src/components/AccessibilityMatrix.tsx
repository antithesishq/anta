import { useEffect, useMemo, useState } from 'preact/hooks'
import s from './Swatches.module.css'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'critical' | 'warning'
type Mode = 'light' | 'dark'

// ─── Color resolution ─────────────────────────────────────────────────────
// One shared canvas resolves any CSS color (hex, hex+alpha, oklch, color-mix)
// to its sRGB pixel value. Compositing text-over-bg is a 2-step paint:
// fill bg, then fill text on top, then read back the final pixel — alpha is
// handled natively by the canvas, which is exactly what we want for
// transparent text colors.

let _canvas: HTMLCanvasElement | null = null
function ctx() {
  if (!_canvas) {
    _canvas = document.createElement('canvas')
    _canvas.width = 1
    _canvas.height = 1
  }
  return _canvas.getContext('2d', { willReadFrequently: true })!
}

function rgbOf(color: string): [number, number, number] {
  const c = ctx()
  c.clearRect(0, 0, 1, 1)
  c.fillStyle = color
  c.fillRect(0, 0, 1, 1)
  const d = c.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}
function effectiveOver(textColor: string, bgColor: string): [number, number, number] {
  const c = ctx()
  c.clearRect(0, 0, 1, 1)
  c.fillStyle = bgColor
  c.fillRect(0, 0, 1, 1)
  c.fillStyle = textColor
  c.fillRect(0, 0, 1, 1)
  const d = c.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}

// ─── WCAG (relative-luminance ratio) ──────────────────────────────────────
function relLuminance(rgb: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}
function wcagRatio(a: [number, number, number], b: [number, number, number]): number {
  const La = relLuminance(a), Lb = relLuminance(b)
  const hi = Math.max(La, Lb), lo = Math.min(La, Lb)
  return (hi + 0.05) / (lo + 0.05)
}

// ─── APCA (Lc, public W3 working draft, body-text profile) ────────────────
// Constants and structure mirror the public APCA-W3 reference, which is the
// portion of the algorithm that's openly published. The polarity branch
// returns a signed Lc value; we use its magnitude for thresholding.
function apcaLc(textRgb: [number, number, number], bgRgb: [number, number, number]): number {
  const mainTRC = 2.4
  const Rco = 0.2126729, Gco = 0.7151522, Bco = 0.0721750
  const normBG = 0.56, normTXT = 0.57
  const revTXT = 0.62, revBG = 0.65
  const blkThrs = 0.022, blkClmp = 1.414
  const scaleBoW = 1.14, scaleWoB = 1.14
  const loBoWoffset = 0.027, loWoBoffset = 0.027
  const deltaYmin = 0.0005, loClip = 0.1

  const sRGBtoY = (rgb: [number, number, number]) => {
    const r = Math.pow(rgb[0] / 255, mainTRC)
    const g = Math.pow(rgb[1] / 255, mainTRC)
    const b = Math.pow(rgb[2] / 255, mainTRC)
    return Rco * r + Gco * g + Bco * b
  }

  let txtY = sRGBtoY(textRgb)
  let bgY = sRGBtoY(bgRgb)
  if (txtY < blkThrs) txtY += Math.pow(blkThrs - txtY, blkClmp)
  if (bgY < blkThrs) bgY += Math.pow(blkThrs - bgY, blkClmp)
  if (Math.abs(bgY - txtY) < deltaYmin) return 0

  let SAPC: number, lc: number
  if (bgY > txtY) {
    SAPC = (Math.pow(bgY, normBG) - Math.pow(txtY, normTXT)) * scaleBoW
    lc = SAPC < loClip ? 0 : SAPC - loBoWoffset
  } else {
    SAPC = (Math.pow(bgY, revBG) - Math.pow(txtY, revTXT)) * scaleWoB
    lc = SAPC > -loClip ? 0 : SAPC + loWoBoffset
  }
  return lc * 100
}

// ─── Thresholds & recommendations ─────────────────────────────────────────
// WCAG: large = ≥18pt regular OR ≥14pt bold. WCAG defines "bold" as
// ≥700, so only `weight === 'strong'` (600) we treat as bold here too —
// medium (500) is too light to qualify per the spec.
function wcagLarge(sizePx: number, weight: Weight): boolean {
  // 18pt = 24px regular; 14pt = 18.66px bold
  const isBold = weight === 'strong'
  return isBold ? sizePx >= 18.66 : sizePx >= 24
}
function wcagAA(ratio: number, large: boolean) { return ratio >= (large ? 3 : 4.5) }
function wcagAAA(ratio: number, large: boolean) { return ratio >= (large ? 4.5 : 7) }

// APCA Lookup: simplified body-text recommendations from the public APCA
// readability tables. Bold gets a softer requirement (roughly one
// font-size column lighter). Medium is treated like regular for
// thresholding even though APCA's full table has more nuance.
function apcaMin(sizePx: number, weight: Weight): number {
  const bold = weight === 'strong'
  if (sizePx >= 24) return bold ? 30 : 45
  if (sizePx >= 18) return bold ? 45 : 60
  if (sizePx >= 16) return bold ? 60 : 75
  if (sizePx >= 14) return bold ? 75 : 90
  return bold ? 90 : 100
}

// ─── Token data — borrowed from Swatches' TOKENS by tone ──────────────────
// We re-declare a minimal subset (just the bg/text rows we need) so this
// component stays self-contained.
const BG_SECTION = { name: 'bg-section', light: '#ffffff', dark: '#171519' } as const

const BG: Record<Tone, { name: string; light: string; dark: string }[]> = {
  neutral: [
    { name: 'bg-base',    light: '#fbfafb', dark: '#100e11' },
    BG_SECTION,
    { name: 'bg-pane',    light: '#f6f4f6', dark: '#1d1a1e' },
    { name: 'bg-block',   light: '#f1eff1', dark: '#272329' },
    { name: 'bg-spot',    light: '#ece9ec', dark: '#302b31' },
  ],
  brand: [
    { name: 'bg-base-brand',  light: '#fcfcfe', dark: '#0f0c1d' },
    BG_SECTION,
    { name: 'bg-pane-brand',  light: '#f7f6fd', dark: '#16122b' },
    { name: 'bg-block-brand', light: '#efeefc', dark: '#1c1736' },
    { name: 'bg-spot-brand',  light: '#e9e5fa', dark: '#201b3e' },
  ],
  info: [
    { name: 'bg-base-info',  light: '#fbfcfe', dark: '#04111f' },
    BG_SECTION,
    { name: 'bg-pane-info',  light: '#f2f7fd', dark: '#071b2c' },
    { name: 'bg-block-info', light: '#e9f3fb', dark: '#092034' },
    { name: 'bg-spot-info',  light: '#e1eefa', dark: '#0d273e' },
  ],
  success: [
    { name: 'bg-base-success',  light: '#f7fcf9', dark: '#05140a' },
    BG_SECTION,
    { name: 'bg-pane-success',  light: '#ecf9f0', dark: '#081f0f' },
    { name: 'bg-block-success', light: '#e2f5e8', dark: '#0c2814' },
    { name: 'bg-spot-success',  light: '#d9f2e0', dark: '#0d2b16' },
  ],
  critical: [
    { name: 'bg-base-critical',  light: '#fefbfb', dark: '#1f0506' },
    BG_SECTION,
    { name: 'bg-pane-critical',  light: '#fdf2f2', dark: '#33090a' },
    { name: 'bg-block-critical', light: '#fcebeb', dark: '#400d0e' },
    { name: 'bg-spot-critical',  light: '#fae5e5', dark: '#471011' },
  ],
  warning: [
    { name: 'bg-base-warning',  light: '#fefbf6', dark: '#160d04' },
    BG_SECTION,
    { name: 'bg-pane-warning',  light: '#fcf4e8', dark: '#241506' },
    { name: 'bg-block-warning', light: '#fbeeda', dark: '#2b1908' },
    { name: 'bg-spot-warning',  light: '#f9e7cd', dark: '#311d0a' },
  ],
}

const TEXT: Record<Tone, { name: string; light: string; dark: string }[]> = {
  neutral: [
    { name: 'text-1', light: '#050306', dark: '#ece9ec' },
    { name: 'text-2', light: '#302b31', dark: '#c1b9c1' },
    { name: 'text-3', light: '#635b65', dark: '#9f99a1' },
    { name: 'text-4', light: '#878089', dark: '#776e77' },
    { name: 'text-5', light: '#9f99a1', dark: '#635b65' },
  ],
  brand: [
    { name: 'text-1-brand', light: '#2e1e7b',   dark: '#c5baff'   },
    { name: 'text-2-brand', light: '#483493',   dark: '#ada0ee'   },
    { name: 'text-3-brand', light: '#483493cc', dark: '#ada0eecc' },
    { name: 'text-4-brand', light: '#48349399', dark: '#ada0ee99' },
    { name: 'text-5-brand', light: '#48349366', dark: '#ada0ee66' },
  ],
  info: [
    { name: 'text-1-info', light: '#003969',   dark: '#9ed2ff'   },
    { name: 'text-2-info', light: '#1c3ba0',   dark: '#7ebaf2'   },
    { name: 'text-3-info', light: '#1c3ba0cc', dark: '#7ebaf2cc' },
    { name: 'text-4-info', light: '#1c3ba099', dark: '#7ebaf299' },
    { name: 'text-5-info', light: '#1c3ba066', dark: '#7ebaf266' },
  ],
  success: [
    { name: 'text-1-success', light: '#0a3a14',   dark: '#bbe9c7'   },
    { name: 'text-2-success', light: '#15512c',   dark: '#9bd6ad'   },
    { name: 'text-3-success', light: '#15512ccc', dark: '#9bd6adcc' },
    { name: 'text-4-success', light: '#15512c99', dark: '#9bd6ad99' },
    { name: 'text-5-success', light: '#15512c66', dark: '#9bd6ad66' },
  ],
  critical: [
    { name: 'text-1-critical', light: '#5e0a0a',   dark: '#ffc8ca'   },
    { name: 'text-2-critical', light: '#841115',   dark: '#f29ba0'   },
    { name: 'text-3-critical', light: '#841115cc', dark: '#f29ba0cc' },
    { name: 'text-4-critical', light: '#84111599', dark: '#f29ba099' },
    { name: 'text-5-critical', light: '#84111566', dark: '#f29ba066' },
  ],
  warning: [
    { name: 'text-1-warning', light: '#451f00',   dark: '#ffd699'   },
    { name: 'text-2-warning', light: '#693109',   dark: '#f0bb73'   },
    { name: 'text-3-warning', light: '#693109cc', dark: '#f0bb73cc' },
    { name: 'text-4-warning', light: '#69310999', dark: '#f0bb7399' },
    { name: 'text-5-warning', light: '#69310966', dark: '#f0bb7366' },
  ],
}

const SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const
type Size = (typeof SIZES)[number]

type Weight = 'regular' | 'medium' | 'strong'
const WEIGHTS: { id: Weight; label: string }[] = [
  { id: 'regular', label: 'Regular' },
  { id: 'medium',  label: 'Medium'  },
  { id: 'strong',  label: 'Strong'  },
]
function weightCss(w: Weight): number | 'inherit' {
  return w === 'medium' ? 500 : w === 'strong' ? 600 : 'inherit'
}

const TONES: { id: Tone; label: string }[] = [
  { id: 'neutral',  label: 'Neutral'  },
  { id: 'brand',    label: 'Brand'    },
  { id: 'info',     label: 'Info'     },
  { id: 'success',  label: 'Success'  },
  { id: 'critical', label: 'Critical' },
  { id: 'warning',  label: 'Warning'  },
]

type CVD = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
const CVDS: { id: CVD; label: string }[] = [
  { id: 'normal',        label: 'Normal' },
  { id: 'protanopia',    label: 'Protanopia' },
  { id: 'deuteranopia',  label: 'Deuteranopia' },
  { id: 'tritanopia',    label: 'Tritanopia' },
  { id: 'achromatopsia', label: 'Achromatopsia' },
]

type Condition =
  | 'none'
  | 'low-vision'
  | 'cataracts'
  | 'tunnel-vision'
  | 'macular'
  | 'astigmatism'
  | 'diplopia'
  | 'light-sensitivity'
const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'none',              label: 'Normal' },
  { id: 'low-vision',        label: 'Low vision' },
  { id: 'cataracts',         label: 'Cataracts' },
  { id: 'tunnel-vision',     label: 'Tunnel vision' },
  { id: 'macular',           label: 'Macular' },
  { id: 'astigmatism',       label: 'Astigmatism' },
  { id: 'diplopia',          label: 'Diplopia' },
  { id: 'light-sensitivity', label: 'Light sensitivity' },
]

function buildFilter(cvd: CVD, condition: Condition, dark: boolean): string {
  const parts: string[] = []
  if (cvd !== 'normal') parts.push(`url(#a11y-${cvd})`)
  if (condition === 'low-vision') parts.push('blur(1.4px)')
  else if (condition === 'cataracts') parts.push('blur(1px) saturate(0.5) brightness(1.05)')
  else if (condition === 'astigmatism') parts.push('url(#a11y-astigmatism)')
  // Light-sensitivity uses a tiny brightness lift in dark mode (where
  // the cells are dark and need a perceptual boost). In light mode
  // the cells are already near-white, the lift would just over-bake
  // the page, and the user wants the HDR PNG to be the *only* effect
  // on display — easier to verify HDR rendering in isolation.
  else if (condition === 'light-sensitivity' && dark) parts.push('brightness(1.05)')
  return parts.length ? parts.join(' ') : 'none'
}
// Tunnel vision is a whole-field-of-view effect → mask the cell.
// Macular degeneration is a central blind spot in fixated vision → the
// mask goes on `.a11ySample` so it lands on the text the user is
// "reading", not the geometric cell center. Diplopia is a horizontal
// ghost copy of the text via `text-shadow`.
function buildCellMask(condition: Condition): string {
  return condition === 'tunnel-vision'
    ? 'radial-gradient(circle at center, black 35%, transparent 75%)'
    : 'none'
}
function buildSampleMask(condition: Condition): string {
  return condition === 'macular'
    ? 'radial-gradient(circle at center, transparent 30%, black 65%)'
    : 'none'
}
function buildSampleFilter(condition: Condition, dark: boolean): string {
  // Dark-mode photophobia: lift the sample text a touch brighter
  // than its base token, on top of the cell-wide brightness(1.05).
  // Light text against a dark cell + small extra brightness reads
  // as a glyph that's "shining harder than the rest of the page" —
  // the perceptual analogue of an HDR pop without HDR rendering.
  if (condition === 'light-sensitivity' && dark) return 'brightness(1.18)'
  return 'none'
}
function buildSampleShadow(condition: Condition, dark: boolean): string {
  // ~30 px horizontal + 5 px upward separation reads as two clearly
  // distinct images — characteristic of moderate-to-severe diplopia
  // with a slight vertical eye-misalignment. 50 % alpha keeps the
  // ghost secondary so the primary glyph is still the dominant read.
  if (condition === 'diplopia') {
    return '30px -5px 0 color-mix(in oklch, currentColor 50%, transparent)'
  }
  // Photophobia, dark mode only: light glyph halates outward in its
  // own bright color. In light mode the visual is carried by the
  // sample-overlay pseudo (see buildSampleOverlay), which smudges
  // the dark glyph edges with white instead of glowing.
  if (condition === 'light-sensitivity' && dark) {
    return '0 0 6px currentColor, 0 0 2px currentColor'
  }
  return 'none'
}
function buildCellDynamicRange(condition: Condition, dark: boolean): string {
  // Opt the glow layer out of HDR tone-mapping only when we paint
  // HDR content — i.e. when the cell-glow is the static HDR image.
  return condition === 'light-sensitivity' && !dark ? 'no-limit' : 'standard'
}
// Photophobia HDR overlay — light mode only. Each bg tier has its
// own HDR PNG at a tuned PQ peak (generated by
// `site/scripts/generate-hdr-white.mjs`): `bg-section` at 10 000
// nits down to `bg-spot` at 150 nits. In dark mode the wash would
// dominate; that mode uses brightness + text glow instead.
function cellGlowUrl(bgName: string, condition: Condition, dark: boolean): string {
  if (condition !== 'light-sensitivity' || dark) return 'none'
  if (bgName.startsWith('bg-section')) return 'url("/hdr-white-section.png")'
  if (bgName.startsWith('bg-base'))    return 'url("/hdr-white-base.png")'
  if (bgName.startsWith('bg-pane'))    return 'url("/hdr-white-pane.png")'
  if (bgName.startsWith('bg-block'))   return 'url("/hdr-white-block.png")'
  if (bgName.startsWith('bg-spot'))    return 'url("/hdr-white-spot.png")'
  return 'none'
}

// Approximate prevalence by region. These are rough public-health
// estimates synthesised from WHO, CDC, Colour Blind Awareness, and
// peer-reviewed reviews; exact numbers vary by source, age band, and
// definition. Treat them as orders of magnitude, not precise figures.
type RegionStats = Partial<Record<
  | 'World' | 'US' | 'EU'
  | 'Africa' | 'Asia' | 'Europe' | 'North America' | 'Oceania' | 'South America',
  string
>>
const REGION_ORDER: (keyof RegionStats)[] = [
  'World', 'US', 'EU', 'Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America',
]

const STATS: Partial<Record<CVD | Condition, RegionStats>> = {
  protanopia: {
    World: '~1.0% of males', US: '~1.0% of males', EU: '~1.1% of males',
    Africa: '~0.7% of males', Asia: '~0.6% of males', Europe: '~1.1% of males',
    'North America': '~1.0% of males', Oceania: '~1.0% of males', 'South America': '~0.7% of males',
  },
  deuteranopia: {
    World: '~1.0% of males', US: '~1.1% of males', EU: '~1.2% of males',
    Africa: '~0.8% of males', Asia: '~0.7% of males', Europe: '~1.2% of males',
    'North America': '~1.1% of males', Oceania: '~1.0% of males', 'South America': '~0.8% of males',
  },
  tritanopia: {
    World: '~0.01%', US: '~0.01%', EU: '~0.01%',
    Africa: '~0.01%', Asia: '~0.01%', Europe: '~0.01%',
    'North America': '~0.01%', Oceania: '~0.01%', 'South America': '~0.01%',
  },
  achromatopsia: {
    World: '~0.003% (1 in 33,000)', US: '~0.003%', EU: '~0.003%',
    Africa: '~0.003%', Asia: '~0.003%', Europe: '~0.003%',
    'North America': '~0.003%', Oceania: '~0.003%', 'South America': '~0.003%',
  },
  'low-vision': {
    World: '~3.7% moderate-severe', US: '~2.0%', EU: '~2.5%',
    Africa: '~5.0%', Asia: '~4.0%', Europe: '~2.5%',
    'North America': '~2.0%', Oceania: '~2.0%', 'South America': '~3.0%',
  },
  cataracts: {
    World: '~3.5% visually significant', US: '~5% of adults 40+', EU: '~4% of adults 40+',
    Africa: '~6%', Asia: '~5%', Europe: '~4%',
    'North America': '~5%', Oceania: '~3%', 'South America': '~4%',
  },
  'tunnel-vision': {
    World: '~2% of adults 40+ (glaucoma)', US: '~3%', EU: '~2.5%',
    Africa: '~5% (notably higher)', Asia: '~2%', Europe: '~2%',
    'North America': '~3%', Oceania: '~2%', 'South America': '~3%',
  },
  macular: {
    World: '~9% of adults 45+ (AMD)', US: '~12%', EU: '~10%',
    Africa: '~5%', Asia: '~7%', Europe: '~10%',
    'North America': '~12%', Oceania: '~10%', 'South America': '~6%',
  },
  astigmatism: {
    // Detectable astigmatism is ~30% of adults but most is corrected
    // by glasses; these figures estimate the share currently
    // experiencing the uncorrected effect (clinically significant +
    // unaddressed). World figure is in line with WHO unmet refractive-
    // error needs.
    World: '~10%', US: '~5%', EU: '~6%',
    Africa: '~18%', Asia: '~14% (higher in East Asia)', Europe: '~6%',
    'North America': '~5%', Oceania: '~6%', 'South America': '~10%',
  },
  diplopia: {
    World: '~0.85%', US: '~0.9%', EU: '~0.85%',
    Africa: '~0.7%', Asia: '~0.8%', Europe: '~0.85%',
    'North America': '~0.9%', Oceania: '~0.85%', 'South America': '~0.8%',
  },
  'light-sensitivity': {
    World: '~5% chronic', US: '~7%', EU: '~6%',
    Africa: '~4%', Asia: '~5%', Europe: '~6%',
    'North America': '~7%', Oceania: '~5%', 'South America': '~5%',
  },
}

// Plain-English description of each condition, surfaced as the first
// part of the tab tooltip so the user can learn what they're toggling
// without leaving the page.
const DESCRIPTIONS: Partial<Record<CVD | Condition, string>> = {
  protanopia:        'Red-blind: missing or non-functional red (L) cone cells; reds, oranges, and greens look similar.',
  deuteranopia:      'Green-blind: missing or non-functional green (M) cone cells; reds and greens are confused.',
  tritanopia:        'Blue-blind: missing or non-functional blue (S) cone cells; blues and yellows are confused.',
  achromatopsia:     'Total color blindness: no functional color cones; the world appears in shades of grey.',
  'low-vision':      'Reduced visual acuity not fully correctable by glasses; details and edges appear soft.',
  cataracts:         'Clouding of the eye\'s natural lens; vision becomes hazy, washed out, and slightly yellow.',
  'tunnel-vision':   'Loss of peripheral vision (advanced glaucoma, retinitis pigmentosa); only the centre of view remains.',
  macular:           'Loss of central vision from the macula (age-related macular degeneration, AMD); a blind spot covers what you focus on.',
  astigmatism:       'Irregular curvature of the cornea or lens; uncorrected, text and edges appear blurred along one axis. Most cases are corrected by glasses or contacts; the figures below are an estimate of the population currently experiencing the uncorrected effect.',
  diplopia:          'Double vision: the same object appears twice, often from eye-muscle imbalance or neurological issues.',
  'light-sensitivity':'Photophobia: ordinary light feels uncomfortably bright, sometimes painful (migraine, dry eye, post-concussion).',
}

function tooltip(id: string): string | undefined {
  const desc = DESCRIPTIONS[id as keyof typeof DESCRIPTIONS]
  const stats = STATS[id as keyof typeof STATS]
  if (!desc && !stats) return undefined
  const lines: string[] = []
  if (desc) {
    lines.push(desc)
    if (stats) lines.push('')
  }
  if (stats) {
    REGION_ORDER.forEach((k) => {
      if (stats[k]) lines.push(`${k}: ${stats[k]}`)
    })
  }
  return lines.join('\n')
}

// Render a token name; for tinted tones, split the trailing `-tone`
// suffix onto its own line so the matrix headers stay narrow. The
// neutral tone renders an empty second line so header height stays
// constant when the user switches between tones (no layout jump).
function HeaderName({ name, tone }: { name: string; tone: Tone }) {
  if (tone === 'neutral') {
    return (
      <>
        {name}
        <br />
        <span class={s.a11yHeadSuffix}>&nbsp;</span>
      </>
    )
  }
  const suffix = `-${tone}`
  if (!name.endsWith(suffix)) {
    return (
      <>
        {name}
        <br />
        <span class={s.a11yHeadSuffix}>&nbsp;</span>
      </>
    )
  }
  return (
    <>
      {name.slice(0, -suffix.length)}
      <br />
      <span class={s.a11yHeadSuffix}>{suffix}</span>
    </>
  )
}

function useDarkObserver(): boolean {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const html = document.documentElement
    const obs = new MutationObserver(() => setDark(html.classList.contains('dark')))
    obs.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

interface CellProps {
  textName: string
  textColor: string
  bgName: string
  bgColor: string
  size: Size
  weight: Weight
  capital: boolean
  condition: Condition
  dark: boolean
}
function Cell({ textName, textColor, bgName, bgColor, size, weight, capital, condition, dark }: CellProps) {
  const result = useMemo(() => {
    const eff = effectiveOver(textColor, bgColor)
    const bg = rgbOf(bgColor)
    const ratio = wcagRatio(eff, bg)
    const lc = apcaLc(eff, bg)
    return { ratio, lc }
  }, [textColor, bgColor])

  const large = wcagLarge(size, weight)
  const sizeLabel = large ? 'large' : 'normal'
  const aa = wcagAA(result.ratio, large)
  const aaa = wcagAAA(result.ratio, large)
  const aaMin = large ? 3 : 4.5
  const aaaMin = large ? 4.5 : 7
  const apcaPass = Math.abs(result.lc) >= apcaMin(size, weight)
  const apcaThreshold = apcaMin(size, weight)

  const wcagTitle = `${textName} on ${bgName} · WCAG 2 ratio ${result.ratio.toFixed(2)}:1
AA  ${sizeLabel} ≥ ${aaMin}:1 — ${aa ? 'pass' : 'fail'}
AAA ${sizeLabel} ≥ ${aaaMin}:1 — ${aaa ? 'pass' : 'fail'}`
  const apcaTitle = `${textName} on ${bgName} · APCA Lc ${result.lc.toFixed(1)}
Body text at ${size}px ${weight} ≥ ${apcaThreshold} — ${apcaPass ? 'pass' : 'fail'}`

  return (
    <div
      class={s.a11yCell}
      style={{
        background: bgColor,
        color: textColor,
        ['--cell-glow' as string]: cellGlowUrl(bgName, condition, dark),
      }}
    >
      <div
        class={s.a11ySample}
        style={{
          fontSize: `${size}px`,
          fontWeight: weightCss(weight),
          textTransform: capital ? 'uppercase' : 'none',
        }}
      >
        Aa Bb Cc 123
      </div>
      <div class={s.a11yFooter}>
        <div class={s.a11yMetricsCol}>
          <div class={s.a11yLine}>
            <span class={s.a11yLabel}>WCAG</span>
            <span class={`${s.a11yValue} ${aa ? s.a11yPass : s.a11yFail}`} title={wcagTitle}>{result.ratio.toFixed(1)}</span>
          </div>
          <div class={s.a11yLine}>
            <span class={s.a11yLabel}>APCA</span>
            <span class={`${s.a11yValue} ${apcaPass ? s.a11yPass : s.a11yFail}`} title={apcaTitle}>Lc&nbsp;{result.lc.toFixed(0)}</span>
          </div>
        </div>
        <div class={s.a11yMarksCol}>
          <span class={s.a11yMark} title={`AA ${sizeLabel} ≥ ${aaMin}:1 — ${aa ? 'pass' : 'fail'}`}>
            AA&nbsp;<span class={`${s.a11yMarkIcon} ${aa ? s.a11yPass : s.a11yFail}`}>{aa ? '✓' : '✗'}</span>
          </span>
          <span class={s.a11yMark} title={`AAA ${sizeLabel} ≥ ${aaaMin}:1 — ${aaa ? 'pass' : 'fail'}`}>
            AAA&nbsp;<span class={`${s.a11yMarkIcon} ${aaa ? s.a11yPass : s.a11yFail}`}>{aaa ? '✓' : '✗'}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// URL state — every selection (tone, size, weight, capital, CVD,
// condition) is reflected as a query param so the URL is shareable.
// Defaults are omitted from the URL to keep it short.
type State = {
  tone: Tone
  size: Size
  weight: Weight
  capital: boolean
  cvd: CVD
  condition: Condition
}
const DEFAULTS: State = {
  tone: 'neutral', size: 15, weight: 'regular', capital: false, cvd: 'normal', condition: 'none',
}
const SIZES_SET: Set<number> = new Set(SIZES)
const WEIGHTS_SET: Set<string> = new Set(WEIGHTS.map((w) => w.id))
const TONES_SET: Set<string> = new Set(TONES.map((t) => t.id))
const CVDS_SET: Set<string> = new Set(CVDS.map((c) => c.id))
const CONDITIONS_SET: Set<string> = new Set(CONDITIONS.map((c) => c.id))

function readUrlState(): State {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  const p = new URLSearchParams(window.location.search)
  const sizeRaw = parseInt(p.get('size') ?? '', 10)
  return {
    tone:      TONES_SET.has(p.get('tone') ?? '')           ? (p.get('tone') as Tone)           : DEFAULTS.tone,
    size:      SIZES_SET.has(sizeRaw)                       ? (sizeRaw as Size)                 : DEFAULTS.size,
    weight:    WEIGHTS_SET.has(p.get('weight') ?? '')       ? (p.get('weight') as Weight)       : DEFAULTS.weight,
    capital:   p.get('capital') === '1',
    cvd:       CVDS_SET.has(p.get('cvd') ?? '')             ? (p.get('cvd') as CVD)             : DEFAULTS.cvd,
    condition: CONDITIONS_SET.has(p.get('condition') ?? '') ? (p.get('condition') as Condition) : DEFAULTS.condition,
  }
}
function writeUrlState(state: State) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const set = (key: string, value: string, defaultValue: string) => {
    if (value === defaultValue) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  set('tone',      state.tone,                     DEFAULTS.tone)
  set('size',      String(state.size),             String(DEFAULTS.size))
  set('weight',    state.weight,                   DEFAULTS.weight)
  set('capital',   state.capital ? '1' : '0',      '0')
  set('cvd',       state.cvd,                      DEFAULTS.cvd)
  set('condition', state.condition,                DEFAULTS.condition)
  window.history.replaceState({}, '', url.toString())
}

export default function AccessibilityMatrix() {
  // Gate the whole island behind a hydration flag — the cells reach for
  // a `<canvas>` during render to resolve oklch/alpha colors to sRGB,
  // and that's not available during SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const dark = useDarkObserver()
  const mode: Mode = dark ? 'dark' : 'light'
  const [tone, setTone] = useState<Tone>(DEFAULTS.tone)
  const [size, setSize] = useState<Size>(DEFAULTS.size)
  const [weight, setWeight] = useState<Weight>(DEFAULTS.weight)
  const [capital, setCapital] = useState<boolean>(DEFAULTS.capital)
  const [cvd, setCvd] = useState<CVD>(DEFAULTS.cvd)
  const [condition, setCondition] = useState<Condition>(DEFAULTS.condition)

  // On hydration, restore state from the URL query string. The URL is
  // the single source of truth, so the page is fully shareable.
  useEffect(() => {
    if (!mounted) return
    const s = readUrlState()
    setTone(s.tone); setSize(s.size); setWeight(s.weight); setCapital(s.capital)
    setCvd(s.cvd); setCondition(s.condition)
  }, [mounted])

  // Sync state → URL whenever any selection changes.
  useEffect(() => {
    if (!mounted) return
    writeUrlState({ tone, size, weight, capital, cvd, condition })
  }, [mounted, tone, size, weight, capital, cvd, condition])

  const cellFilter = buildFilter(cvd, condition, dark)
  const cellMask = buildCellMask(condition)
  const cellDynamicRange = buildCellDynamicRange(condition, dark)
  const sampleMask = buildSampleMask(condition)
  const sampleShadow = buildSampleShadow(condition, dark)
  const sampleFilter = buildSampleFilter(condition, dark)

  const bgs = BG[tone]
  const texts = TEXT[tone]

  if (!mounted) return null

  return (
    <section class={s.block}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="a11y-protanopia">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
        </filter>
        <filter id="a11y-deuteranopia">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
        </filter>
        <filter id="a11y-tritanopia">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
        </filter>
        <filter id="a11y-achromatopsia">
          <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" />
        </filter>
        {/* Directional Gaussian blur — wider X stdDeviation than Y simulates
            uncorrected astigmatism's directional smear. */}
        <filter id="a11y-astigmatism">
          <feGaussianBlur stdDeviation="1.4 0.25" />
        </filter>
      </svg>

      <div class={s.blockHeading}>
        <p>
          Contrast for every text level on every background, in the current theme. Both the WCAG 2 ratio and the APCA Lc value are properties of the color pair — they don't change with font size or weight. What changes is the <em>threshold</em> applied: WCAG only relaxes to "large text" thresholds at ≥24 px regular or ≥18.66 px bold; APCA shifts its body-text minimum at every size step. Transparent text is composited over the background before measurement, so the numbers reflect what's painted.
        </p>
      </div>

      <div class={s.a11yControls}>
        <div class={s.a11yControlRow}>
          <div class={s.a11ySegment} role="tablist" aria-label="Tone">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tone}
                class={t.id === tone ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
                onClick={() => setTone(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div class={s.a11yControlRow}>
          <div class={s.a11ySegment} role="radiogroup" aria-label="Font size">
            {SIZES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === size}
                class={p === size ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
                onClick={() => setSize(p)}
              >
                {p}px
              </button>
            ))}
          </div>
          <div class={s.a11ySegment} role="radiogroup" aria-label="Weight">
            {WEIGHTS.map((w) => (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={w.id === weight}
                class={w.id === weight ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
                onClick={() => setWeight(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div class={s.a11ySegment} role="radiogroup" aria-label="Letter case">
            <button
              type="button"
              role="radio"
              aria-checked={!capital}
              class={!capital ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
              onClick={() => setCapital(false)}
            >
              Sentence
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={capital}
              class={capital ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
              onClick={() => setCapital(true)}
            >
              Capital
            </button>
          </div>
        </div>
        <div class={s.a11yControlRow}>
          <div class={s.a11ySegment} role="radiogroup" aria-label="Color vision">
            {CVDS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === cvd}
                title={tooltip(v.id)}
                class={v.id === cvd ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
                onClick={() => setCvd(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div class={s.a11yControlRow}>
          <div class={s.a11ySegment} role="radiogroup" aria-label="Vision condition">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === condition}
                title={tooltip(c.id)}
                class={c.id === condition ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
                onClick={() => setCondition(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class={s.a11yScroll}>
        <div
          class={s.a11yMatrix}
          style={{
            gridTemplateColumns: `max-content repeat(${texts.length}, 122px)`,
            ['--cell-filter' as string]: cellFilter,
            ['--cell-mask' as string]: cellMask,
            ['--cell-dynamic-range' as string]: cellDynamicRange,
            ['--sample-mask' as string]: sampleMask,
            ['--sample-shadow' as string]: sampleShadow,
            ['--sample-filter' as string]: sampleFilter,
          }}
        >
          <div class={`${s.a11yCorner} ${s.a11yHeadCell}`} />
          {texts.map((t) => (
            <div key={t.name} class={s.a11yHeadCell}>
              <HeaderName name={t.name} tone={tone} />
            </div>
          ))}
          {bgs.map((b) => (
            <>
              <div key={`${b.name}-rh`} class={`${s.a11yRowHead} ${s.a11yHeadCell}`}>
                <HeaderName name={b.name} tone={tone} />
              </div>
              {texts.map((t) => (
                <Cell
                  key={`${b.name}-${t.name}`}
                  textName={t.name}
                  textColor={t[mode]}
                  bgName={b.name}
                  bgColor={b[mode]}
                  size={size}
                  weight={weight}
                  capital={capital}
                  condition={condition}
                  dark={dark}
                />
              ))}
            </>
          ))}
        </div>
      </div>
    </section>
  )
}
