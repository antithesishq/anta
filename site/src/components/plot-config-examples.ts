import { scatter, type PlotArgs } from '@antadesign/plot'

const examplePoints = [
  { x: 8, y: 14 }, { x: 36, y: 40 }, { x: 52, y: 32 },
  { x: 44, y: 59 }, { x: 64, y: 54 }, { x: 92, y: 86 },
]

export function presentation(): PlotArgs<Node> {
  return {
    series: [scatter<Node>({ data: examplePoints, size: 3,
      color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    title: { text: 'Plot title', size: 16, color: { light: '#374151', dark: '#e5e7eb' } },
    height: 260,
    margin: { top: 38, right: 16, bottom: 42, left: 52 },
    background: { light: '#f3f4f6', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    grid: { x: false, y: true },
    border: true,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    zoom_pan: false,
  }
}

export function spacing(): PlotArgs<Node> {
  return {
    series: [scatter<Node>({ data: examplePoints, size: 3,
      color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    height: 260,
    margin: { top: 40, right: 40, bottom: 68, left: 88 },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    zoom_pan: false,
  }
}

export function logarithmic(): PlotArgs<Node> {
  const data = examplePoints.map(({ x, y }) => ({ x, y: 10 ** (y / 20 - 1) }))
  return {
    series: [scatter<Node>({ data, size: 3,
      color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    height: 260,
    margin: { top: 12, right: 14, bottom: 44, left: 80 },
    axis: {
      x: { min: 0, max: 100, label: 'Batch' },
      y: { scale: 'log', min: 0.1, max: 10000, label: 'Duration (ms)',
        tick_label: { format: value => Number(value) >= 1000 ? Number(value) / 1000 + 'k' : String(value) } },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: true,
    zoom_pan: false,
  }
}

export function timeAxis(): PlotArgs<Node> {
  const start = Date.UTC(2026, 0, 12)
  const data = examplePoints.map(({ x, y }) => ({ x: start + x / 100 * 86400000, y }))
  return {
    series: [scatter<Node>({ data, size: 3,
      color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    height: 260,
    margin: { top: 12, right: 16, bottom: 44, left: 76 },
    axis: {
      x: { scale: 'utc', min: start, max: start + 86400000, label: 'Time (UTC)', padding: 8,
        tick_label: { format: value => new Date(Number(value)).toISOString().slice(11, 16) } },
      y: { min: 0, max: 100, label: 'Utilization', tick_mark: false,
        tick_label: { format: value => value + '%' } },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: true,
    zoom_pan: false,
  }
}

export const configExamples = { presentation, spacing, logarithmic, timeAxis }
