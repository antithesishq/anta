export default `
import type { ReactNode } from 'react'
import { custom, line, scatter, type Series } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

// Deterministic particles keep the scene stable while you edit its options.
const stars = [
  { x: 0, y: 0 },
  ...Array.from({ length: 180 }, (_, i) => ({
    x: ((i * 73.31) % 240) - 120,
    y: ((i * 41.73) % 160) - 80,
  })),
]

const palette = ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24']
const particles = Array.from({ length: 300 }, (_, i) => {
  const arm = i % 3
  const progress = Math.floor(i / 3) / 100
  const angle = progress * Math.PI * 3.4 + arm * Math.PI * 2 / 3
  const radius = 9 + progress * 82
  const jitter = Math.sin(i * 12.7) * (2 + progress * 5)
  return {
    x: Math.cos(angle) * radius + jitter,
    y: Math.sin(angle) * radius * 0.58 + Math.cos(i * 7.3) * 3,
    size: 2 + (1 - progress) * 3 + (i % 13 === 0 ? 3 : 0),
    color: palette[arm],
    arm: ['CYAN', 'VIOLET', 'ROSE'][arm],
    energy: Math.round((1 - progress) * 100),
  }
})

const orbits = palette.map((color, index) => {
  const rotation = -0.65 + index * 0.43
  const data = Array.from({ length: 241 }, (_, i) => {
    const angle = i / 240 * Math.PI * 2
    const x = Math.cos(angle) * (77 + index * 8)
    const y = Math.sin(angle) * (23 + index * 3)
    return {
      x: x * Math.cos(rotation) - y * Math.sin(rotation),
      y: x * Math.sin(rotation) + y * Math.cos(rotation),
    }
  })
  return { color, data }
})

const series: Series<ReactNode>[] = [
  custom<ReactNode>({
    data: stars,
    x: 'x',
    y: 'y',
    hoverable: false,
    renderer: (series, { ctx, inner, resolve_x, resolve_y }) => {
      const cx = resolve_x(0)
      const cy = resolve_y(0)
      if (cx === undefined || cy === undefined) return
      ctx.save()
      const radius = (inner.right - inner.left) * 0.45
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      nebula.addColorStop(0, '#383064')
      nebula.addColorStop(0.35, '#181b3c')
      nebula.addColorStop(1, '#070b18')
      ctx.fillStyle = nebula
      ctx.fillRect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
      for (let i = 1; i < series.x.length; i++) {
        const x = resolve_x(i)
        const y = resolve_y(i)
        if (x === undefined || y === undefined) continue
        ctx.fillStyle = i % 7 === 0 ? '#c4b5fd' : '#52617d'
        ctx.beginPath()
        ctx.arc(x, y, i % 7 === 0 ? 1.3 : 0.65, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    },
  }),
  ...orbits.flatMap(({ color, data }) => [
    line<ReactNode>({ data, color: '#282443', width: 6, hoverable: false }),
    line<ReactNode>({ data, color, width: 1, hoverable: false }),
  ]),
  scatter<ReactNode>({
    data: particles,
    mark: 'circle',
    tooltip: ({ row }) => (
      <div style={{ padding: '4px 8px' }}>
        <strong>{String(row.arm)} ARM</strong>
        <div>Energy {String(row.energy)}%</div>
      </div>
    ),
  }),
  scatter<ReactNode>({
    data: orbits.map(({ color, data }, i) => ({
      ...data[28 + i * 43],
      color,
      name: ['LYRA', 'NOVA', 'VEGA', 'SOL'][i],
    })),
    size: 11,
    stroke: { color: '#ffffff', width: 1.5 },
    tooltip: ({ row }) => <strong>{String(row.name)}</strong>,
  }),
  scatter<ReactNode>({ data: [{ x: 0, y: 0 }], size: 26, color: '#67569b', hoverable: false }),
  scatter<ReactNode>({ data: [{ x: 0, y: 0 }], size: 14, color: '#c4b5fd', hoverable: false }),
  scatter<ReactNode>({
    data: [{ x: 0, y: 0 }],
    size: 6,
    color: '#ffffff',
    tooltip: () => <strong>THE SINGULARITY</strong>,
  }),
]

/** @play props Plot options */
const options = {
  title: { text: 'AFTER HOURS', size: 20, color: '#e0e7ff' },
  width: 600,
  height: 400,
  border: false,
  chrome_color: '#334155',
  background: '#070b18',
  theme_invert: false,
}

/** @play props Axis */
const axis = {
  x: {
    min: -120,
    max: 120,
    label: 'X',
    line: true,
    tick_mark: false,
    hidden: true,
    tick_label: {
      size: 10,
      color: '#94a3b8',
      format: (value: number | string) => String(value),
    },
  },
  y: {
    min: -80,
    max: 80,
    label: 'Y',
    line: true,
    tick_mark: false,
    hidden: true,
    tick_label: {
      size: 10,
      color: '#94a3b8',
      format: (value: number | string) => String(value),
    },
  },
}

/** @play props Margin */
const margin = { top: 48, right: 16, bottom: 16, left: 16 }

/** @play props Grid */
const grid = { x: false, y: false }

/** @play props Zoom and pan */
const zoom_pan = { x: true, y: true, modifier: false }

// Replace the object to apply a change; Plot does not observe in-place mutation.
const plotArgs = { ...options, series, axis, margin, grid, zoom_pan }

function Demo() {
  return <Plot plotArgs={plotArgs} className="plot-demo" />
}
`
