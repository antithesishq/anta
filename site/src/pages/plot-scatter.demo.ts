export default `
import { useState } from 'preact/hooks'
import { scatter, type ScatterArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const groups = [
  { name: 'Cached', baseline: 12 },
  { name: 'API', baseline: 38 },
  { name: 'Batch', baseline: 68 },
]
const data = groups.flatMap((group, groupIndex) =>
  Array.from({ length: 28 }, (_, i) => ({
    requests: 80 + i * 31 + groupIndex * 17,
    latency: Math.round(group.baseline + i * 1.4 + Math.sin(i * 1.7 + groupIndex) * 9),
    payload: 4 + (i * 7 % 15),
    group: group.name,
  })),
)

/** @play props Group colors */
const colors = {
  Cached: { light: '#0d9488', dark: '#5eead4' },
  API: { light: '#6366f1', dark: '#a5b4fc' },
  Batch: { light: '#d97706', dark: '#fcd34d' },
}

/** @play props Scatter options */
const options = {
  x: 'requests',
  y: 'latency',
  color: (row) => colors[row.group as keyof typeof colors],
  size: (row) => 5 + Number(row.payload) / 2,
  mark: 'circle',
  stroke: { color: { light: '#ffffff', dark: '#141820' }, width: 1 },
  tooltip: ({ x, y, row }) => String(row.group) + ': ' + x + ' req/s · ' + y + ' ms',
  hoverable: true,
  highlight: true,
} satisfies Omit<ScatterArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      scatter({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Latency under load', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'Requests / second' }, y: { label: 'Latency (ms)', min: 0 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
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
