import { useEffect, useRef, useState } from 'preact/hooks'
import chroma from 'chroma-js'
import { Menu, Tabs, TabPanel, Input, Tooltip } from '@antadesign/anta'

/**
 * Color picker built entirely from Anta components. A swatch Button opens a Menu
 * holding the picker: color models (OKLCH / HSL / RGB / HEX) as Anta Tabs, each
 * channel an Anta Input (no sliders). In OKLCH, an L×C gamut plane for the
 * current hue is drawn to a device-pixel-ratio-scaled canvas (sharp on retina),
 * clickable to set L/C; the in-gamut chroma limit lives in a Tooltip on the C
 * input. OKLCH `[l, c, h]` is the source of truth; other models convert back via
 * chroma-js. Gamut math is done directly so the boundary matches the browser.
 */

type Triple = [number, number, number]
const CMAX = 0.4
const PW = 264
const PH = 150

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
const gamma = (c: number) => {
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
const safeOklch = (arr: number[], fh: number): Triple => [arr[0], arr[1], Number.isNaN(arr[2]) ? fh : arr[2]]
const num = (v: string, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
const fx = (x: number, d: number) => (Math.round(x * 10 ** d) / 10 ** d).toString()

// A channel field. Its value round-trips through the colour state and is reformatted
// by fx, so it holds a raw string draft — a fractional oklch value ("0.", "0.55")
// types cleanly. Re-seed only when the external value diverges numerically (a canvas
// pick, another channel), never mid-keystroke.
function Chan({ label, val, onVal, tip }: { label: string; val: string; onVal: (v: string) => void; tip?: any }) {
  const [draft, setDraft] = useState(val)
  const [seen, setSeen] = useState(val)
  if (seen !== val) {
    setSeen(val)
    if (num(draft) !== num(val)) setDraft(val)
  }
  return (
    <div style={{ width: 78, position: 'relative' }}>
      <Input
        type="text"
        inputMode="decimal"
        size="small"
        label={label}
        value={draft}
        onValueChange={(_e: any, a: any) => {
          setDraft(a.value)
          onVal(a.value)
        }}
      />
      {tip ? <Tooltip>{tip}</Tooltip> : null}
    </div>
  )
}

const MODELS = [
  { value: 'oklch', label: 'OKLCH' },
  { value: 'hsl', label: 'HSL' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hex', label: 'HEX' },
]

export default function ColorPicker({
  value = '#5f4bc3',
  onChange,
  label = 'Color',
}: {
  value?: string
  onChange?: (hex: string) => void
  label?: string
}) {
  const [[l, c, h], setOklch] = useState<Triple>(() => {
    try {
      return safeOklch(chroma(value).oklch(), 0)
    } catch {
      return [0.5, 0.15, 285]
    }
  })
  const [hexDraft, setHexDraft] = useState(value)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const planeCache = useRef<{ hue: number; w: number; data: ImageData } | null>(null)

  const hex = chroma.oklch(l, c, h).hex()
  const outOfGamut = !inGamut(l, c, h)
  const cLimit = maxChroma(l, h)

  const mounted = useRef(false)
  useEffect(() => {
    // Skip the mount pass: `hex` is the oklch round-trip of the incoming `value`,
    // so propagating it would overwrite the parent's exact seed literal with its
    // round-tripped form. Only a real edit (a later `hex` change) should call up.
    if (mounted.current) onChange?.(hex)
    else mounted.current = true
    setHexDraft(hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex])

  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = Math.round(PW * dpr)
    const H2 = Math.round(PH * dpr)
    if (cv.width !== W) cv.width = W
    if (cv.height !== H2) cv.height = H2
    const hue = Math.round(h)
    if (planeCache.current?.hue !== hue || planeCache.current?.w !== W) {
      const img = ctx.createImageData(W, H2)
      for (let y = 0; y < H2; y++) {
        const cc = (1 - y / (H2 - 1)) * CMAX
        for (let x = 0; x < W; x++) {
          const ll = x / (W - 1)
          const i = (y * W + x) * 4
          if (inGamut(ll, cc, hue)) {
            const [r, g, b] = oklchToLinear(ll, cc, hue)
            img.data[i] = gamma(r) * 255
            img.data[i + 1] = gamma(g) * 255
            img.data[i + 2] = gamma(b) * 255
            img.data[i + 3] = 255
          } else {
            const chk = (((x / dpr) >> 3) + ((y / dpr) >> 3)) & 1 ? 28 : 20
            img.data[i] = img.data[i + 1] = img.data[i + 2] = chk
            img.data[i + 3] = 255
          }
        }
      }
      planeCache.current = { hue, w: W, data: img }
    }
    ctx.putImageData(planeCache.current.data, 0, 0)
    const mx = l * (W - 1)
    const my = (1 - Math.min(c, CMAX) / CMAX) * (H2 - 1)
    ctx.beginPath()
    ctx.arc(mx, my, 6 * dpr, 0, Math.PI * 2)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3 * dpr
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(mx, my, 6 * dpr, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5 * dpr
    ctx.stroke()
  }, [l, c, h])

  const pickFromPlane = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const ll = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const cc = Math.max(0, Math.min(CMAX, (1 - (e.clientY - r.top) / r.height) * CMAX))
    setOklch([ll, cc, h])
  }

  const hsl = chroma.oklch(l, c, h).hsl()
  const hslH = Number.isNaN(hsl[0]) ? 0 : hsl[0]
  const rgb = chroma.oklch(l, c, h).rgb()

  const setHsl = (i: number, v: string) => {
    const next = [hslH, hsl[1], hsl[2]]
    next[i] = i === 0 ? num(v) : num(v) / 100
    setOklch(safeOklch(chroma.hsl(next[0], next[1], next[2]).oklch(), h))
  }
  const setRgb = (i: number, v: string) => {
    const next = [rgb[0], rgb[1], rgb[2]]
    next[i] = num(v)
    setOklch(safeOklch(chroma.rgb(next[0], next[1], next[2]).oklch(), h))
  }

  // min/max/step were native number-input attrs; clamping now lives in each onVal.
  const chan = (label: string, val: string, _min: number, _max: number, _step: number, onVal: (v: string) => void, tip?: any) => (
    <Chan label={label} val={val} onVal={onVal} tip={tip} />
  )

  const row = { display: 'flex', gap: 8, flexWrap: 'wrap' as const }

  return (
    <div style={{ display: 'inline-block' }}>
      {/* Re-template the host grid (the element supports this) to put the field's
          own label to the left of the box, and monospace the label + value. */}
      <style>{`
        .acp-trigger { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 8px; width: 230px; }
        .acp-trigger::part(label) { margin: 0; }
        .acp-trigger::part(label), .acp-trigger::part(input) { font-family: var(--monospace); letter-spacing: 0; }
      `}</style>
      <Input
        className="acp-trigger"
        size="small"
        label={label}
        value={hex}
        readOnly
        style={{ cursor: 'pointer' }}
        leading={
          <span style={{ width: 13, height: 13, borderRadius: 2, background: hex, display: 'block', border: '1px solid var(--border-3)' }} />
        }
      />
      {/* Anchor the picker to the field's box. */}
      <Menu placement="bottom-start" autoWidth>
        <div style={{ padding: 12, width: 300, display: 'grid', gap: 12, fontFamily: 'var(--sans-serif)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: hex, border: '1px solid var(--border-3)', flex: 'none' }} />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <code style={{ fontSize: 13, color: 'var(--text-1)' }}>{hex}</code>
              <code style={{ fontSize: 11, color: 'var(--text-4)' }}>
                oklch({fx(l, 3)} {fx(c, 3)} {fx(h, 1)})
              </code>
            </div>
          </div>

          <Tabs options={MODELS} defaultValue="oklch" size="small">
            <TabPanel value="oklch">
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <canvas
                  ref={canvasRef}
                  onClick={pickFromPlane}
                  style={{ width: '100%', height: 'auto', borderRadius: 6, cursor: 'crosshair', display: 'block' }}
                />
                <div style={row}>
                  {chan('L', fx(l, 3), 0, 1, 0.01, (v) => setOklch([Math.max(0, Math.min(1, num(v))), c, h]))}
                  {chan('C', fx(c, 3), 0, CMAX, 0.005, (v) => setOklch([l, Math.max(0, Math.min(CMAX, num(v))), h]), `in-gamut chroma limit at this L / hue: ${fx(cLimit, 3)}`)}
                  {chan('H', fx(h, 1), 0, 360, 1, (v) => setOklch([l, c, ((num(v) % 360) + 360) % 360]))}
                </div>
              </div>
            </TabPanel>
            <TabPanel value="hsl">
              <div style={{ ...row, marginTop: 10 }}>
                {chan('H', fx(hslH, 0), 0, 360, 1, (v) => setHsl(0, v))}
                {chan('S %', fx(hsl[1] * 100, 0), 0, 100, 1, (v) => setHsl(1, v))}
                {chan('L %', fx(hsl[2] * 100, 0), 0, 100, 1, (v) => setHsl(2, v))}
              </div>
            </TabPanel>
            <TabPanel value="rgb">
              <div style={{ ...row, marginTop: 10 }}>
                {chan('R', fx(rgb[0], 0), 0, 255, 1, (v) => setRgb(0, v))}
                {chan('G', fx(rgb[1], 0), 0, 255, 1, (v) => setRgb(1, v))}
                {chan('B', fx(rgb[2], 0), 0, 255, 1, (v) => setRgb(2, v))}
              </div>
            </TabPanel>
            <TabPanel value="hex">
              <div style={{ marginTop: 10, maxWidth: 160 }}>
                <Input
                  size="small"
                  label="Hex"
                  value={hexDraft}
                  placeholder="#rrggbb"
                  onValueChange={(e: any, a: any) => {
                    // Draft tracks every keystroke so the field shows what's typed,
                    // but the colour commits only on `change` (blur / Enter). Committing
                    // on each keystroke let a valid intermediate (e.g. `#5f4`) round-trip
                    // through `hex` and rewrite the field mid-edit.
                    setHexDraft(a.value)
                    if (e.type === 'change' && chroma.valid(a.value)) setOklch(safeOklch(chroma(a.value).oklch(), h))
                  }}
                />
              </div>
            </TabPanel>
          </Tabs>

          {outOfGamut ? (
            <div style={{ fontSize: 11, color: 'var(--text-2-warning)' }}>
              Outside sRGB — clips to <code>{hex}</code> when rendered.
            </div>
          ) : null}
        </div>
      </Menu>
    </div>
  )
}
