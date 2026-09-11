export default `
import { useState } from 'preact/hooks'
import { rect, type RectArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const data = days.flatMap((day, d) => Array.from({ length: 18 }, (_, h) => {
  const activity = Math.round(100 * Math.max(0.08, Math.sin((h + 1) / 19 * Math.PI)) * (d < 5 ? 1 : 0.45)
    * (0.65 + 0.35 * Math.sin(h * 2.3 + d) ** 2))
  return { day, hour: String(h + 6).padStart(2, '0') + ':00', activity }
}))

/** @play props Rect options */
const options = {
  x: 'hour',
  y: 'day',
  inset: 2,
  min_size: 2,
  offset: { x: 0, y: 0 },
  color: (row) => ({
    light: 'hsl(174, 65%, ' + (94 - Number(row.activity) * 0.6) + '%)',
    dark: 'hsl(174, 55%, ' + (16 + Number(row.activity) * 0.4) + '%)',
  }),

  tooltip: ({ x, y, row }) => x + ' · ' + y + ' · activity ' + row.activity + '%',
  hoverable: true,
  highlight: true,
} satisfies Omit<RectArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      rect({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Weekly activity', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: {
      x: {
        label: '',
        categories: Array.from({ length: 18 }, (_, h) => String(h + 6).padStart(2, '0') + ':00'),
      },
      y: { label: '', categories: days },
    },
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
