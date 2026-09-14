export default `
import type { ReactNode } from 'react'
import { area, line, scatter, rule, type Series } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

// Synthetic data, sampled every 15 minutes. No randomness: edits keep the same data.
const forecast = Array.from({ length: 97 }, (_, i) => {
  const hour = i / 4
  const morning = 150 * Math.exp(-(((hour - 9) / 2.8) ** 2))
  const evening = 240 * Math.exp(-(((hour - 17) / 3.4) ** 2))
  const expected = 85 + morning + evening
  const spread = 22 + 12 * Math.sin(hour / 5) ** 2
  return { hour, expected, low: expected - spread, high: expected + spread }
})

const observations = forecast.map((point, i) => {
  const burst = i >= 61 && i <= 68 ? 65 * Math.sin((i - 60) / 9 * Math.PI) : 0
  const actual = Math.round(point.expected + 13 * Math.sin(i * 1.8) + 8 * Math.cos(i * 0.7) + burst)
  return { ...point, actual, outside: actual > point.high || actual < point.low }
})

const trend = observations.map((point, i) => {
  const window = observations.slice(Math.max(0, i - 3), Math.min(observations.length, i + 4))
  return { hour: point.hour, average: window.reduce((sum, row) => sum + row.actual, 0) / window.length }
})

const meanExpected = forecast.reduce((sum, point) => sum + point.expected, 0) / forecast.length

const series: Series<ReactNode>[] = [
  area<ReactNode>({
    data: forecast,
    x: 'hour',
    y: 'high',
    y2: 'low',
    color: { light: '#ede9fe', dark: '#30274e' },
    hoverable: false,
  }),
  rule<ReactNode>({
    y: meanExpected,
    color: { light: '#d97706', dark: '#fbbf24' },
    width: 2,
    dash: [8, 4],
    hoverable: false,
  }),
  line<ReactNode>({
    data: forecast,
    x: 'hour',
    y: 'expected',
    color: { light: '#8b5cf6', dark: '#c4b5fd' },
    width: 2,
    dash: [5, 5],
    tooltip: ({ x, y }) => <span>Forecast at {x}h: {Math.round(Number(y))} requests/s</span>,
  }),
  line<ReactNode>({
    data: trend,
    x: 'hour',
    y: 'average',
    color: { light: '#0891b2', dark: '#67e8f9' },
    width: 3,
    tooltip: ({ x, y }) => <span>Trend at {x}h: {Math.round(Number(y))} requests/s</span>,
  }),
  scatter<ReactNode>({
    data: observations.filter(point => !point.outside),
    x: 'hour',
    y: 'actual',
    color: { light: '#0891b2', dark: '#67e8f9' },
    size: 4,
    tooltip: ({ x, y }) => <span>Observed at {x}h: {y} requests/s</span>,
  }),
  scatter<ReactNode>({
    data: observations.filter(point => point.outside),
    x: 'hour',
    y: 'actual',
    color: { light: '#e76f51', dark: '#fda489' },
    mark: 'diamond',
    size: 9,
    stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1 },
    tooltip: ({ x, y }) => (
      <div>
        <strong>Outside forecast range</strong>
        <div>{x}h · {y} requests/s</div>
      </div>
    ),
  }),
]

/** @play props Plot options */
const options = {
  title: { text: 'Daily demand', size: 18, color: { light: '#25324b', dark: '#e2e8f0' } },
  width: 800,
  height: 400,
  border: false,
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  background: { light: '#ffffff', dark: '#151b28' },
  theme_invert: false,
}

/** @play props Axis */
const axis = {
  x: {
    min: 0,
    max: 24,
    label: { text: 'Hour of day', color: { light: '#64748b', dark: '#94a3b8' } },
    line: true,
    tick_mark: false,
    hidden: false,
    tick_label: {
      size: 10,
      color: { light: '#64748b', dark: '#94a3b8' },
      format: (value: number | string) => String(value).padStart(2, '0') + ':00',
    },
  },
  y: {
    min: 0,
    max: 440,
    label: { text: 'Requests / second', color: { light: '#64748b', dark: '#94a3b8' } },
    line: false,
    tick_mark: false,
    hidden: false,
    tick_label: {
      size: 10,
      color: { light: '#64748b', dark: '#94a3b8' },
      format: (value: number | string) => String(value),
    },
  },
}

/** @play props Margin */
const margin = { top: 44, right: 24, bottom: 54, left: 72 }

/** @play props Grid */
const grid = { x: false, y: true }

/** @play props Zoom and pan */
const zoom_pan = { x: true, y: true, modifier: false }

// Replace the object to apply a change; Plot does not observe in-place mutation.
const plotArgs = { ...options, series, axis, margin, grid, zoom_pan }

function Demo() {
  return <Plot plotArgs={plotArgs} className="plot-demo" />
}
`
