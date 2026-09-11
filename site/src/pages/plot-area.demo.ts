export default `
import { useState } from 'preact/hooks'
import { area, type AreaArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = Array.from({ length: 41 }, (_, i) => {
  const baseline = 36 + 12 * Math.sin(i / 5) + 24 * Math.exp(-(((i - 27) / 5) ** 2))
  return {
    minute: i * 1.5,
    low: Math.round(baseline - 10 - 3 * Math.sin(i)),
    high: Math.round(baseline + 18 + 9 * Math.sin(i / 3) ** 2),
  }
})

/** @play props Area options */
const options = {
  x: 'minute',
  y: 'high',
  y2: 'low',
  color: { light: '#c7d2fe', dark: '#37306b' },
  stroke: { color: { light: '#818cf8', dark: '#a5b4fc' }, width: 2 },
  dash: [],
  tooltip: ({ x, row }) => x + ' min · ' + row.low + '–' + row.high + ' ms',
  hoverable: true,
  highlight: true,
} satisfies Omit<AreaArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      area({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Latency envelope', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'Minute', min: 0, max: 60 }, y: { label: 'Latency (ms)', min: 0 } },
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
