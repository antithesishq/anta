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
// WCAG: large = ≥18pt regular OR ≥14pt bold. Anta's 13–17px range is all
// "small" by WCAG; only 18px+ bold qualifies as large.
function wcagLarge(sizePx: number, bold: boolean): boolean {
  // 18pt = 24px regular; 14pt = 18.66px bold
  return bold ? sizePx >= 18.66 : sizePx >= 24
}
function wcagAA(ratio: number, large: boolean) { return ratio >= (large ? 3 : 4.5) }
function wcagAAA(ratio: number, large: boolean) { return ratio >= (large ? 4.5 : 7) }

// APCA Lookup: simplified body-text recommendations from the public APCA
// readability tables. Keys are font-size-px buckets; values are the
// minimum |Lc| recommended for body text at that size. Bold gets a softer
// requirement (roughly one font-size column lighter).
function apcaMin(sizePx: number, bold: boolean): number {
  // From the W3 working draft "minimum font size for Lc" table, transposed.
  // Ranges are approximate; the actual table uses Lc-then-size lookup.
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

const SIZES = [13, 14, 15, 16, 17] as const
type Size = (typeof SIZES)[number]

type CVD = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
const CVDS: { id: CVD; label: string }[] = [
  { id: 'normal',        label: 'Regular' },
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
  { id: 'none',              label: 'None' },
  { id: 'low-vision',        label: 'Low vision' },
  { id: 'cataracts',         label: 'Cataracts' },
  { id: 'tunnel-vision',     label: 'Tunnel vision' },
  { id: 'macular',           label: 'Macular' },
  { id: 'astigmatism',       label: 'Astigmatism' },
  { id: 'diplopia',          label: 'Diplopia' },
  { id: 'light-sensitivity', label: 'Light sensitivity' },
]

function buildFilter(cvd: CVD, condition: Condition): string {
  const parts: string[] = []
  if (cvd !== 'normal') parts.push(`url(#a11y-${cvd})`)
  if (condition === 'low-vision') parts.push('blur(1.4px)')
  else if (condition === 'cataracts') parts.push('blur(1px) saturate(0.5) brightness(1.05)')
  else if (condition === 'astigmatism') parts.push('url(#a11y-astigmatism)')
  else if (condition === 'light-sensitivity') parts.push('brightness(1.4) contrast(1.15)')
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
function buildSampleShadow(condition: Condition): string {
  // ~30 px horizontal + 5 px upward separation reads as two clearly
  // distinct images — characteristic of moderate-to-severe diplopia
  // with a slight vertical eye-misalignment. 50 % alpha keeps the
  // ghost secondary so the primary glyph is still the dominant read.
  return condition === 'diplopia'
    ? '30px -5px 0 color-mix(in oklch, currentColor 50%, transparent)'
    : 'none'
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
// suffix onto its own line so the matrix headers stay narrow.
function HeaderName({ name, tone }: { name: string; tone: Tone }) {
  if (tone === 'neutral') return <>{name}</>
  const suffix = `-${tone}`
  if (!name.endsWith(suffix)) return <>{name}</>
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
  bold: boolean
}
function Cell({ textName, textColor, bgName, bgColor, size, bold }: CellProps) {
  const result = useMemo(() => {
    const eff = effectiveOver(textColor, bgColor)
    const bg = rgbOf(bgColor)
    const ratio = wcagRatio(eff, bg)
    const lc = apcaLc(eff, bg)
    return { ratio, lc }
  }, [textColor, bgColor])

  const large = wcagLarge(size, bold)
  const sizeLabel = large ? 'large' : 'normal'
  const aa = wcagAA(result.ratio, large)
  const aaa = wcagAAA(result.ratio, large)
  const aaMin = large ? 3 : 4.5
  const aaaMin = large ? 4.5 : 7
  const apcaPass = Math.abs(result.lc) >= apcaMin(size, bold)
  const apcaThreshold = apcaMin(size, bold)
  const fontWeight = bold ? 600 : 'inherit'

  const wcagTitle = `${textName} on ${bgName} · WCAG 2 ratio ${result.ratio.toFixed(2)}:1
AA  ${sizeLabel} ≥ ${aaMin}:1 — ${aa ? 'pass' : 'fail'}
AAA ${sizeLabel} ≥ ${aaaMin}:1 — ${aaa ? 'pass' : 'fail'}`
  const apcaTitle = `${textName} on ${bgName} · APCA Lc ${result.lc.toFixed(1)}
Body text at ${size}px ${bold ? 'bold' : 'regular'} ≥ ${apcaThreshold} — ${apcaPass ? 'pass' : 'fail'}`

  return (
    <div class={s.a11yCell} style={{ background: bgColor, color: textColor }}>
      <div class={s.a11ySample} style={{ fontSize: `${size}px`, fontWeight }}>Aa Bb 12</div>
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

// Persisted session keys for the accessibility matrix's state, so the
// user's chosen size / weight / vision settings carry across tone-tab
// navigations.
const STORE_KEY = 'anta-a11y-state'
type StoredState = { size: Size; bold: boolean; cvd: CVD; condition: Condition }
function loadStored(): Partial<StoredState> {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<StoredState>
  } catch { return {} }
}
function saveStored(s: StoredState) {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch {}
}

export default function AccessibilityMatrix({ tone }: { tone: Tone }) {
  // Gate the whole island behind a hydration flag — the cells reach for
  // a `<canvas>` during render to resolve oklch/alpha colors to sRGB,
  // and that's not available during SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Once the matrix mounts (and its `<h2 id="accessibility">` enters
  // the DOM), if the current URL points at an anchor that's now
  // resolvable, scroll to it. Without this, navigating to
  // `/colors/<tone>/#accessibility` from a tone-tab click lands at the
  // top of the new page because the anchor element didn't exist yet
  // when the browser ran its initial scroll-to-anchor pass.
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    if (!window.location.hash) return
    const el = document.querySelector(window.location.hash)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
  }, [mounted])

  const dark = useDarkObserver()
  const mode: Mode = dark ? 'dark' : 'light'
  const [size, setSize] = useState<Size>(15)
  const [bold, setBold] = useState<boolean>(false)
  const [cvd, setCvd] = useState<CVD>('normal')
  const [condition, setCondition] = useState<Condition>('none')

  // On hydration, restore the user's last-selected matrix settings from
  // sessionStorage so they carry across tone-tab navigations.
  useEffect(() => {
    if (!mounted) return
    const s = loadStored()
    if (s.size !== undefined) setSize(s.size)
    if (s.bold !== undefined) setBold(s.bold)
    if (s.cvd !== undefined) setCvd(s.cvd)
    if (s.condition !== undefined) setCondition(s.condition)
  }, [mounted])

  // Persist whenever any selection changes.
  useEffect(() => {
    if (!mounted) return
    saveStored({ size, bold, cvd, condition })
  }, [mounted, size, bold, cvd, condition])

  const cellFilter = buildFilter(cvd, condition)
  const cellMask = buildCellMask(condition)
  const sampleMask = buildSampleMask(condition)
  const sampleShadow = buildSampleShadow(condition)

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
        <h2 id="accessibility">
          <a href="#accessibility" class="header-anchor muted">Accessibility</a>
        </h2>
        <p>
          Contrast for every text level on every background, in the current theme. Both the WCAG 2 ratio and the APCA Lc value are properties of the color pair — they don't change with font size or weight. What changes with size and weight is the <em>threshold</em> applied: WCAG only relaxes its threshold once text is at least 24 px regular or 18.66 px bold (so all 13–17 px sizes here are evaluated as "small"), while APCA shifts its body-text minimum at every size step. Transparent text is composited over the background before measurement, so the numbers reflect what's painted.
        </p>
      </div>

      <div class={s.a11yControls}>
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
            <button
              type="button"
              role="radio"
              aria-checked={!bold}
              class={!bold ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
              onClick={() => setBold(false)}
            >
              Regular
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={bold}
              class={bold ? `${s.a11ySegBtn} ${s.a11ySegBtnActive}` : s.a11ySegBtn}
              onClick={() => setBold(true)}
            >
              Strong
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
            ['--sample-mask' as string]: sampleMask,
            ['--sample-shadow' as string]: sampleShadow,
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
                  bold={bold}
                />
              ))}
            </>
          ))}
        </div>
      </div>
    </section>
  )
}
