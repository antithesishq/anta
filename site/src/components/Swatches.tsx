import { useState } from 'preact/hooks'
import s from './Swatches.module.css'
import bgExampleSvg from './bg-example.svg?raw'
import borderExampleSvg from './border-example.svg?raw'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'critical' | 'warning'
type Kind = 'bg' | 'text' | 'border'

interface TokenRow {
  name: string
  light: string
  dark: string
}

const TONES: { id: Tone; label: string }[] = [
  { id: 'neutral',  label: 'Neutral' },
  { id: 'brand',    label: 'Brand' },
  { id: 'info',     label: 'Info' },
  { id: 'success',  label: 'Success' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning',  label: 'Warning' },
]

// bg-section is mode-invariant across tones (no tone-specific variant exists in
// the Figma library) — we still include it as the 5th swatch in every tone row
// so the layout stays consistent and shows that section is shared.
const BG_SECTION: TokenRow = { name: 'bg-section', light: '#ffffff', dark: '#171519' }

const TOKENS: Record<Kind, Partial<Record<Tone, TokenRow[]>>> = {
  bg: {
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
  },
  text: {
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
      { name: 'text-2-info', light: '#175082',   dark: '#7db6e8'   },
      { name: 'text-3-info', light: '#175082cc', dark: '#7db6e8cc' },
      { name: 'text-4-info', light: '#175082b2', dark: '#7db6e899' },
      { name: 'text-5-info', light: '#17508280', dark: '#7db6e866' },
    ],
    success: [
      { name: 'text-1-success', light: '#004618',   dark: '#9ddeb1'   },
      { name: 'text-2-success', light: '#1f5c31',   dark: '#74cd8e'   },
      { name: 'text-3-success', light: '#1f5c31cc', dark: '#71d08ecc' },
      { name: 'text-4-success', light: '#1f5c3199', dark: '#71d08e99' },
      { name: 'text-5-success', light: '#1f5c3166', dark: '#71d08e66' },
    ],
    critical: [
      { name: 'text-1-critical', light: '#8f1014',   dark: '#ffabac'   },
      { name: 'text-2-critical', light: '#a01c1c',   dark: '#e78e90'   },
      { name: 'text-3-critical', light: '#a01c1ccc', dark: '#e49091cc' },
      { name: 'text-4-critical', light: '#a01c1c99', dark: '#e4909199' },
      { name: 'text-5-critical', light: '#a01c1c66', dark: '#e4909166' },
    ],
    warning: [
      { name: 'text-1-warning', light: '#7f410b',   dark: '#f0bf75'   },
      { name: 'text-2-warning', light: '#995200',   dark: '#e1a452'   },
      { name: 'text-3-warning', light: '#995200cc', dark: '#e9a135cc' },
      { name: 'text-4-warning', light: '#99520099', dark: '#e9a13599' },
      { name: 'text-5-warning', light: '#99520066', dark: '#e9a13566' },
    ],
  },
  border: {
    neutral: [
      { name: 'border-1', light: '#ece9ec', dark: '#272329' },
      { name: 'border-2', light: '#e0dce0', dark: '#3e3941' },
      { name: 'border-3', light: '#d4ced4', dark: '#49424c' },
      { name: 'border-4', light: '#c1b9c1', dark: '#534c57' },
      { name: 'border-5', light: '#938d96', dark: '#776e77' },
    ],
    brand: [
      { name: 'border-1-brand', light: '#e9e5fa', dark: '#251f47' },
      { name: 'border-2-brand', light: '#ddd8f8', dark: '#2d2556' },
      { name: 'border-3-brand', light: '#d2cbf6', dark: '#483493' },
      { name: 'border-4-brand', light: '#bcb1f1', dark: '#503cb4' },
      { name: 'border-5-brand', light: '#9081df', dark: '#7460d7' },
    ],
    info: [
      { name: 'border-1-info', light: '#e1eefa', dark: '#0e2b44' },
      { name: 'border-2-info', light: '#cfe3f7', dark: '#12324f' },
      { name: 'border-3-info', light: '#bad6f3', dark: '#175082' },
      { name: 'border-4-info', light: '#93c5ec', dark: '#1a5b93' },
      { name: 'border-5-info', light: '#56a1e1', dark: '#2686d9' },
    ],
    success: [
      { name: 'border-1-success', light: '#d9f2e0', dark: '#0f321a' },
      { name: 'border-2-success', light: '#c6ecd1', dark: '#12391e' },
      { name: 'border-3-success', light: '#b3e5c2', dark: '#1f5c31' },
      { name: 'border-4-success', light: '#88d7a0', dark: '#226737' },
      { name: 'border-5-success', light: '#44c169', dark: '#329550' },
    ],
    critical: [
      { name: 'border-1-critical', light: '#fae5e5', dark: '#531314' },
      { name: 'border-2-critical', light: '#f7d4d4', dark: '#5d1819' },
      { name: 'border-3-critical', light: '#f4c2c2', dark: '#a01c1c' },
      { name: 'border-4-critical', light: '#efa4a4', dark: '#b02120' },
      { name: 'border-5-critical', light: '#e56c6c', dark: '#de4545' },
    ],
    warning: [
      { name: 'border-1-warning', light: '#f9e7cd', dark: '#37200b' },
      { name: 'border-2-warning', light: '#f6dbb1', dark: '#3e250e' },
      { name: 'border-3-warning', light: '#f3cc91', dark: '#6a3b0c' },
      { name: 'border-4-warning', light: '#edb25a', dark: '#7f410b' },
      { name: 'border-5-warning', light: '#d88118', dark: '#ae6613' },
    ],
  },
}

const TITLES: Record<Kind, string> = {
  bg: 'Background',
  text: 'Text',
  border: 'Border',
}

const INTROS: Record<Kind, string> = {
  bg: 'These tokens define how surfaces are structured and layered across the interface. They help create visual hierarchy and guide the user’s attention.',
  text: 'These tokens define how text is presented across the interface. They help establish hierarchy, readability, and consistent contrast.',
  border: 'These tokens define how borders are used to separate, group, and structure elements across the interface.',
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

function MoonStarsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 9.5A6 6 0 0 1 6.5 2c0-.4 0-.7.1-1A6 6 0 1 0 15 8.4l-1 .1Z" fill="currentColor" />
      <circle cx="11.5" cy="3.5" r="0.7" fill="currentColor" />
      <circle cx="13.5" cy="6" r="0.5" fill="currentColor" />
    </svg>
  )
}

function hexToOklch(hex: string): string {
  const clean = hex.replace('#', '')
  const r6 = clean.slice(0, 6)
  const alpha = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : null
  let r = parseInt(r6.slice(0, 2), 16) / 255
  let g = parseInt(r6.slice(2, 4), 16) / 255
  let b = parseInt(r6.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  r = lin(r); g = lin(g); b = lin(b)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const sV = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(sV)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bo = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  const C = Math.sqrt(a * a + bo * bo)
  let H = (Math.atan2(bo, a) * 180) / Math.PI
  if (H < 0) H += 360
  const lStr = L.toFixed(3), cStr = C.toFixed(3), hStr = Math.round(H)
  return alpha != null
    ? `oklch(${lStr} ${cStr} ${hStr} / ${alpha.toFixed(2)})`
    : `oklch(${lStr} ${cStr} ${hStr})`
}

function Swatch({ kind, token, hex }: { kind: Kind; token: string; hex: string }) {
  return (
    <div class={s.swatch}>
      {kind === 'bg' && (
        <div class={s.bgPreview} style={{ background: `var(--${token})` }} />
      )}
      {kind === 'text' && (
        <div class={s.textPreview} style={{ color: `var(--${token})` }}>Aa</div>
      )}
      {kind === 'border' && (
        <div class={s.borderPreview} style={{ color: `var(--${token})` }}>
          <div class={s.borderCorner} />
        </div>
      )}
      <span class={`${s.tokenName} copyable`}>{token}</span>
      <span class={s.hex}>{hex}</span>
      <span class={s.oklch}>{hexToOklch(hex)}</span>
    </div>
  )
}

function ThemeRow({ mode, kind, rows }: { mode: 'light' | 'dark'; kind: Kind; rows: TokenRow[] }) {
  const className = mode === 'dark' ? `${s.themeRow} ${s.themeRowDark} dark` : `${s.themeRow} ${s.themeRowLight}`
  return (
    <div class={className}>
      <div class={s.themeLabel}>
        {mode === 'light' ? <SunIcon /> : <MoonStarsIcon />}
        <span>{mode === 'light' ? 'Light theme' : 'Dark theme'}</span>
      </div>
      <div class={s.swatchGrid}>
        {rows.map((row) => (
          <Swatch key={row.name} kind={kind} token={row.name} hex={mode === 'light' ? row.light : row.dark} />
        ))}
      </div>
    </div>
  )
}

function BackgroundDescription() {
  return (
    <div class={s.description}>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-base</span> is the main background color for the page. Use it for large surfaces and overall layouts.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-section</span> is used for secondary areas, such as side navigation or grouped sections. It helps separate content without adding too much contrast.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-pane</span> is used for blocks that need stronger emphasis, such as cards, panels, or highlighted content.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-block</span> and <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-spot</span> are darker background variations. Their use cases are still exploratory.</p>
    </div>
  )
}

function TextDescription() {
  // Each line uses its own text-* token color so the description visually
  // demonstrates the token's appearance.
  const lines: { token: string; copy: string }[] = [
    { token: 'text-1', copy: 'Primary text, for headings and key content.' },
    { token: 'text-2', copy: 'Secondary text, for descriptions and supporting content.' },
    { token: 'text-3', copy: 'Subdued text, for labels, statuses and secondary data.' },
    { token: 'text-4', copy: 'Minor text, for timestamps, counters and metadata.' },
    { token: 'text-5', copy: 'Placeholder text, for hints and non-critical information.' },
  ]
  return (
    <div class={s.description}>
      {lines.map((l) => (
        <p key={l.token} style={{ color: `var(--${l.token})` }}>
          <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>{l.token}</span> — {l.copy}
        </p>
      ))}
    </div>
  )
}

function BorderDescription() {
  return (
    <div class={s.description}>
      <p>Border colors are used depending on how much separation is needed and the background they appear on.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>border-1</span> is used on lighter surfaces. It works well between <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-base</span> and <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-section</span>, often appearing in spacing areas to subtly define boundaries.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>border-2</span> is used to separate <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-base</span> and <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-pane</span>, providing a slightly stronger level of contrast.</p>
      <p><span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>border-3</span>, <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>border-4</span> and <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>border-5</span> are used when a container needs to be clearly defined or when separating elements on stronger backgrounds such as <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-block</span> and <span class="copyable" style={{ fontFamily: 'var(--monospace)' }}>bg-spot</span>.</p>
    </div>
  )
}

// Background mockup — the exact Figma SVG, with hex colors substituted for our
// token CSS variables so it flips with light/dark mode and stays in sync with
// the design system. The SVG lives in bg-example.svg and is imported as raw
// markup so the var() references resolve from :root.
function BackgroundExample() {
  return (
    <div class={s.exampleScroll}>
      <div class={s.bgExampleSvg} dangerouslySetInnerHTML={{ __html: bgExampleSvg }} />
    </div>
  )
}

// Border mockup — exact Figma SVG with hex colors substituted for our token
// CSS variables. Inlined as raw markup so var() resolves from :root.
function BorderExample() {
  return (
    <div class={s.exampleScroll}>
      <div class={s.bgExampleSvg} dangerouslySetInnerHTML={{ __html: borderExampleSvg }} />
    </div>
  )
}

function ColorBlock({ kind, tone }: { kind: Kind; tone: Tone }) {
  const rows = TOKENS[kind][tone]
  if (!rows || rows.length === 0) return null
  return (
    <section class={s.block}>
      <div class={s.blockHeading}>
        <h2>{TITLES[kind]}</h2>
        <p>{INTROS[kind]}</p>
      </div>
      <div class={s.themeRows}>
        <ThemeRow mode="light" kind={kind} rows={rows} />
        <ThemeRow mode="dark" kind={kind} rows={rows} />
      </div>
      {kind === 'bg' && <BackgroundDescription />}
      {kind === 'text' && <TextDescription />}
      {kind === 'border' && <BorderDescription />}
      {kind === 'bg' && tone === 'neutral' && <BackgroundExample />}
      {kind === 'border' && tone === 'neutral' && <BorderExample />}
    </section>
  )
}

function ToneTabs({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <div class={s.toneTabs} role="tablist">
      {TONES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          class={t.id === value ? `${s.toneTab} ${s.toneTabActive}` : s.toneTab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function ColorsPage() {
  const [tone, setTone] = useState<Tone>('neutral')
  return (
    <div class={s.page}>
      <ToneTabs value={tone} onChange={setTone} />
      <ColorBlock kind="bg" tone={tone} />
      <ColorBlock kind="text" tone={tone} />
      <ColorBlock kind="border" tone={tone} />
    </div>
  )
}
