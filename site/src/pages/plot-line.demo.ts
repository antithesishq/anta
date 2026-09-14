export default `
import { useState } from 'preact/hooks'
import { line, type LineArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = Array.from({ length: 193 }, (_, i) => ({
  hour: i / 8,
  requests: Math.round(180 + 420 * Math.exp(-(((i - 116) / 40) ** 2))
    + 55 * Math.sin(i * 0.55) + 28 * Math.cos(i * 1.7) + 16 * Math.sin(i * 2.9)),
}))

/** @play props Line options */
const options = {
  x: 'hour',
  y: 'requests',
  color: { light: '#6366f1', dark: '#a5b4fc' },
  width: 3,
  dash: [],
  tooltip: ({ x, y }) => x + ':00 · ' + y + ' requests/s',
  hoverable: true,
  highlight: true,
} satisfies Omit<LineArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      line({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'A day of traffic', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'Hour', min: 0, max: 24 }, y: { label: 'Requests / second', min: 0 } },
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
