export default `
import { useState } from 'preact/hooks'
import type { ReactNode } from 'react'
import { custom, type CustomArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = Array.from({ length: 7 }, (_, y) =>
  Array.from({ length: 11 }, (_, x) => ({
    x, y,
    angle: Math.atan2(y - 3, x - 5) + Math.PI / 2,
    speed: 7 + 10 * Math.exp(-((x - 5) ** 2 + (y - 3) ** 2) / 18),
  })),
).flat()

/** @play props Custom options */
const options = {
  x: 'x',
  y: 'y',
  color: (row) => ({
    light: 'hsl(' + (180 + Number(row.speed) * 5) + ', 65%, 45%)',
    dark: 'hsl(' + (180 + Number(row.speed) * 5) + ', 75%, 70%)',
  }),
  renderer: (series, { ctx, resolve_x, resolve_y, color_at }) => {
    ctx.save()
    ctx.lineWidth = 2
    for (let i = 0; i < series.x.length; i++) {
      const x = resolve_x(i)
      const y = resolve_y(i)
      if (x === undefined || y === undefined) continue
      const row = series.rows?.[i]
      const angle = Number(row?.angle ?? 0)
      const length = Number(row?.speed ?? 8)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.strokeStyle = color_at(i)
      ctx.fillStyle = color_at(i)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-length / 2, 0)
      ctx.lineTo(length / 2, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(length / 2 + 3, 0)
      ctx.lineTo(length / 2 - 3, -4)
      ctx.lineTo(length / 2 - 3, 4)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  },
  hit_test: (series, { cursor, resolve_x, resolve_y }) => {
    let nearest: number | null = null
    let distance = 13
    for (let i = 0; i < series.x.length; i++) {
      const x = resolve_x(i)
      const y = resolve_y(i)
      if (x === undefined || y === undefined) continue
      const candidate = Math.hypot(cursor.x - x, cursor.y - y)
      if (candidate <= distance) {
        nearest = i
        distance = candidate
      }
    }
    return nearest
  },
  tooltip: ({ x, y, row }) => 'Position (' + x + ', ' + y + ') · speed ' + Number(row?.speed).toFixed(1),
  hoverable: true,
} satisfies Omit<CustomArgs<ReactNode>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      custom<ReactNode>({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Flow field', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'X', min: -0.7, max: 10.7 }, y: { label: 'Y', min: -0.7, max: 6.7 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return (
    <div className="series-demo">
      <Plot plotArgs={plotArgs} />
      <output aria-live="polite">{selection}</output>
    </div>
  )
}
`
