import { useEffect, useRef, useState } from 'preact/hooks'
import s from './Swatches.module.css'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'critical' | 'warning'
type Kind = 'bg' | 'text' | 'border'

// Resolve any computed CSS color to hex (8-digit when it carries alpha) via a
// 1×1 canvas. The role tokens are now `oklch(from <seed> …)`, so the computed
// value comes back as `oklch(…)` rather than `rgb(…)` — painting it and reading
// the pixel converts any format (oklch, color(), rgb) uniformly to sRGB hex.
function toHex(color: string): string {
  if (!color) return color
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return color
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  const h = (x: number) => x.toString(16).padStart(2, '0')
  return a < 255 ? `#${h(r)}${h(g)}${h(b)}${h(a)}` : `#${h(r)}${h(g)}${h(b)}`
}

// Token NAMES only — values are never hardcoded. Backgrounds use a numeric
// elevation scale `bg-1 … bg-5` (1 = deepest / recessed, 5 = most raised);
// `bg-1` is neutral-only, so tinted bg rows lead with the shared `bg-1`, then
// `bg-2-${tone}` … `bg-5-${tone}`. Text / border follow `prefix-1…5(-tone)`.
const sfx = (tone: Tone) => (tone === 'neutral' ? '' : `-${tone}`)
function tokenNames(kind: Kind, tone: Tone): string[] {
  if (kind === 'bg') {
    return tone === 'neutral'
      ? ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5']
      : ['bg-1', `bg-2-${tone}`, `bg-3-${tone}`, `bg-4-${tone}`, `bg-5-${tone}`]
  }
  return [1, 2, 3, 4, 5].map((n) => `${kind}-${n}${sfx(tone)}`)
}

function Swatch({ kind, token, rev }: { kind: Kind; token: string; rev: number }) {
  // Read the live computed color off the rendered preview (which resolves
  // `var(--token)` within its themed `.light`/`.dark` row) and show it as hex
  // — so the label always tracks tokens.css, no hardcoded values. `rev` bumps
  // on a palette switch (theme-anta on/off) so the readout re-reads.
  const previewRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    setValue(toHex(kind === 'bg' ? cs.backgroundColor : cs.color))
  }, [kind, token, rev])
  return (
    <div class={s.swatch}>
      {kind === 'bg' && (
        <div ref={previewRef} class={s.bgPreview} style={{ background: `var(--${token})` }} />
      )}
      {kind === 'text' && (
        <div ref={previewRef} class={s.textPreview} style={{ color: `var(--${token})` }}>Aa</div>
      )}
      {kind === 'border' && (
        <div ref={previewRef} class={s.borderPreview} style={{ color: `var(--${token})` }}>
          <div class={s.borderCorner} />
        </div>
      )}
      <span class={`${s.tokenName} copyable`}>{token}</span>
      <span class={s.hex}>{value}</span>
    </div>
  )
}

// One swatch grid — a single "theme example". The themed `.light`/`.dark`
// ancestor (rendered by the static Swatches.astro shell) supplies the per-mode
// token values; each Swatch reads them live for its hex label.
export default function SwatchGrid({ kind, tone }: { kind: Kind; tone: Tone }) {
  // Bump on a palette switch so each Swatch re-reads its computed hex (the
  // ThemeSwitcher dispatches `anta-palette-change` when theme-anta toggles).
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const onChange = () => setRev((r) => r + 1)
    window.addEventListener('anta-palette-change', onChange)
    return () => window.removeEventListener('anta-palette-change', onChange)
  }, [])
  return (
    <div class={s.swatchGrid}>
      {tokenNames(kind, tone).map((name) => (
        <Swatch key={name} kind={kind} token={name} rev={rev} />
      ))}
    </div>
  )
}
