import { useEffect, useRef, useState } from 'preact/hooks'
import chroma from 'chroma-js'
import { Button } from '@antadesign/anta'

/**
 * Custom color picker for the theming lab. Lets you express a color in OKLCH,
 * HSL, RGB, or hex, and — in OKLCH mode — renders the sRGB gamut: a lightness ×
 * chroma plane for the current hue with the out-of-gamut region dimmed, the
 * chroma track marked at its in-gamut limit, and an explicit note when the
 * current color falls outside sRGB (so you can see what "the limits" are).
 *
 * OKLCH `[l, c, h]` is the single source of truth; the other models are views
 * that convert back to it on edit (via chroma-js). Gamut math is done directly
 * (Björn Ottosson's OKLab matrices) so the boundary matches what the browser
 * renders, independent of chroma's clamping.
 */

type Triple = [number, number, number]

const CMAX = 0.4 // chroma axis ceiling for the plane + slider
const PW = 260
const PH = 150

// --- OKLab / OKLCH → linear sRGB (unclamped) -------------------------------
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
function gamma(c: number): number {
  c = Math.max(0, Math.min(1, c))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}
function maxChroma(L: number, H: number): number {
  let lo = 0
  let hi = CMAX
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2
    if (inGamut(L, m, H)) lo = m
    else hi = m
  }
  return lo
}

function safeOklch(arr: number[], fallbackH: number): Triple {
  const [l, c, h] = arr
  return [l, c, Number.isNaN(h) ? fallbackH : h]
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }
const chanLabel = { width: 18, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--monospace)' }
const numStyle = {
  width: 62,
  fontSize: 12,
  fontFamily: 'var(--monospace)',
  padding: '2px 4px',
  background: 'var(--bg-1)',
  color: 'var(--text-2)',
  border: '1px solid var(--border-4)',
  borderRadius: 4,
}

export default function ColorPicker({
  value = '#5f4bc3',
  onChange,
}: {
  value?: string
  onChange?: (hex: string) => void
}) {
  const [[l, c, h], setOklch] = useState<Triple>(() => {
    try {
      return safeOklch(chroma(value).oklch(), 0)
    } catch {
      return [0.5, 0.15, 285]
    }
  })
  const [model, setModel] = useState<'oklch' | 'hsl' | 'rgb' | 'hex'>('oklch')
  const [hexDraft, setHexDraft] = useState(value)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const planeCache = useRef<{ hue: number; data: ImageData } | null>(null)

  const hex = chroma.oklch(l, c, h).hex()
  const outOfGamut = !inGamut(l, c, h)
  const cLimit = maxChroma(l, h)

  useEffect(() => {
    onChange?.(hex)
    setHexDraft(hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex])

  // Draw the L×C gamut plane for the current hue, then the marker on top.
  useEffect(() => {
    if (model !== 'oklch') return
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const hue = Math.round(h)
    if (planeCache.current?.hue !== hue) {
      const img = ctx.createImageData(PW, PH)
      for (let y = 0; y < PH; y++) {
        const cc = (1 - y / (PH - 1)) * CMAX
        for (let x = 0; x < PW; x++) {
          const ll = x / (PW - 1)
          const i = (y * PW + x) * 4
          if (inGamut(ll, cc, hue)) {
            const [r, g, b] = oklchToLinear(ll, cc, hue)
            img.data[i] = gamma(r) * 255
            img.data[i + 1] = gamma(g) * 255
            img.data[i + 2] = gamma(b) * 255
            img.data[i + 3] = 255
          } else {
            const chk = ((x >> 3) + (y >> 3)) & 1 ? 28 : 20
            img.data[i] = img.data[i + 1] = img.data[i + 2] = chk
            img.data[i + 3] = 255
          }
        }
      }
      planeCache.current = { hue, data: img }
    }
    ctx.putImageData(planeCache.current.data, 0, 0)
    const mx = l * (PW - 1)
    const my = (1 - Math.min(c, CMAX) / CMAX) * (PH - 1)
    ctx.beginPath()
    ctx.arc(mx, my, 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(mx, my, 6, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [l, c, h, model])

  const pickFromPlane = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const ll = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const cc = Math.max(0, Math.min(CMAX, (1 - (e.clientY - r.top) / r.height) * CMAX))
    setOklch([ll, cc, h])
  }

  // Channel views for the non-oklch models (computed from the canonical oklch).
  const hsl = chroma.oklch(l, c, h).hsl()
  const rgb = chroma.oklch(l, c, h).rgb()
  const hslH = Number.isNaN(hsl[0]) ? 0 : hsl[0]

  const slider = (
    label: string,
    v: number,
    min: number,
    max: number,
    step: number,
    set: (n: number) => void,
    trackBg?: string,
  ) => (
    <div style={rowStyle}>
      <span style={chanLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
        style={{ flex: 1, ...(trackBg ? { background: trackBg, borderRadius: 4, height: 8, appearance: 'auto' } : {}) }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(v.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0))}
        onChange={(e) => set(Number((e.target as HTMLInputElement).value))}
        style={numStyle}
      />
    </div>
  )

  const setHsl = (i: number, n: number) => {
    const next = [hslH, hsl[1], hsl[2]]
    next[i] = n
    setOklch(safeOklch(chroma.hsl(next[0], next[1], next[2]).oklch(), h))
  }
  const setRgb = (i: number, n: number) => {
    const next = [rgb[0], rgb[1], rgb[2]]
    next[i] = n
    setOklch(safeOklch(chroma.rgb(next[0], next[1], next[2]).oklch(), h))
  }

  const MODELS = ['oklch', 'hsl', 'rgb', 'hex'] as const

  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        maxWidth: 380,
        padding: 14,
        border: '1px solid var(--border-4)',
        borderRadius: 10,
        background: 'var(--bg-2)',
        fontFamily: 'var(--sans-serif)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: hex,
            border: '1px solid var(--border-3)',
            flex: 'none',
          }}
        />
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <code style={{ fontSize: 13, color: 'var(--text-1)' }}>{hex}</code>
          <code style={{ fontSize: 11, color: 'var(--text-4)' }}>
            oklch({l.toFixed(3)} {c.toFixed(3)} {h.toFixed(1)})
          </code>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {MODELS.map((m) =>
          model === m ? (
            <Button key={m} size="small" priority="secondary" selected label={m.toUpperCase()} onClick={() => setModel(m)} />
          ) : (
            <Button key={m} size="small" priority="quaternary" label={m.toUpperCase()} onClick={() => setModel(m)} />
          ),
        )}
      </div>

      {model === 'oklch' && (
        <>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={PW}
              height={PH}
              onClick={pickFromPlane}
              style={{ width: '100%', height: 'auto', borderRadius: 6, cursor: 'crosshair', display: 'block' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
              <span>L → 0…1 · C ↑ 0…{CMAX} · hue {h.toFixed(0)}°</span>
              <span>dimmed = outside sRGB</span>
            </div>
          </div>
          {slider('L', l, 0, 1, 0.001, (n) => setOklch([n, c, h]))}
          {slider('C', c, 0, CMAX, 0.001, (n) => setOklch([l, n, h]))}
          <div style={{ fontSize: 11, color: 'var(--text-4)', margin: '-2px 0 0 28px' }}>
            in-gamut chroma limit at this L/hue: <code>{cLimit.toFixed(3)}</code>
          </div>
          {slider('H', h, 0, 360, 0.1, (n) => setOklch([l, c, n]))}
        </>
      )}

      {model === 'hsl' && (
        <>
          {slider('H', hslH, 0, 360, 1, (n) => setHsl(0, n))}
          {slider('S', hsl[1], 0, 1, 0.01, (n) => setHsl(1, n))}
          {slider('L', hsl[2], 0, 1, 0.01, (n) => setHsl(2, n))}
        </>
      )}

      {model === 'rgb' && (
        <>
          {slider('R', rgb[0], 0, 255, 1, (n) => setRgb(0, n))}
          {slider('G', rgb[1], 0, 255, 1, (n) => setRgb(1, n))}
          {slider('B', rgb[2], 0, 255, 1, (n) => setRgb(2, n))}
        </>
      )}

      {model === 'hex' && (
        <input
          type="text"
          value={hexDraft}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value
            setHexDraft(v)
            if (chroma.valid(v)) setOklch(safeOklch(chroma(v).oklch(), h))
          }}
          style={{ ...numStyle, width: '100%', fontSize: 14, padding: '6px 8px' }}
          placeholder="#rrggbb"
        />
      )}

      {outOfGamut && (
        <div style={{ fontSize: 11, color: 'var(--text-2-warning)' }}>
          Outside sRGB — clips to <code>{hex}</code> when rendered.
        </div>
      )}
    </div>
  )
}
