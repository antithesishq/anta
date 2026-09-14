import { rect, type PlotArgs } from '@antadesign/plot'

export function heatmap(): PlotArgs<Node> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const hours = ['09', '11', '13', '15', '17', '19']
  const data = days.flatMap((day, d) => hours.map((hour, h) => ({
    day, hour, activity: Math.round(20 + 75 * Math.sin(h * 0.8 + d * 0.5) ** 2),
  })))

  return {
    series: [
      rect<Node>({
        data,
        x: 'hour',
        y: 'day',
        inset: 2,
        color: row => ({
          light: 'hsl(174, 65%, ' + (94 - Number(row.activity) * 0.6) + '%)',
          dark: 'hsl(174, 55%, ' + (16 + Number(row.activity) * 0.4) + '%)',
        }),
        tooltip: ({ row }) => document.createTextNode(row.day + ' ' + row.hour + ':00 · ' + row.activity + '%'),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 38 },
    axis: { x: { categories: hours, label: '' }, y: { categories: days, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function intervals(): PlotArgs<Node> {
  const data = [
    { task: 'Fetch', start: 0.5, end: 3.2 },
    { task: 'Parse', start: 2.8, end: 5.1 },
    { task: 'Build', start: 4.5, end: 9.4 },
    { task: 'Test', start: 7.8, end: 11.2 },
    { task: 'Ship', start: 10.8, end: 12.5 },
  ]

  return {
    series: [
      rect<Node>({
        data,
        x: 'start',
        x2: 'end',
        y: 'task',
        inset: 9,
        color: { light: '#c4b5fd', dark: '#6d28d9' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 1 },
        hover_span_y: true,
        tooltip: ({ row }) => document.createTextNode(row.task + ': ' + row.start + '–' + row.end + ' s'),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 44 },
    axis: { x: { min: 0, max: 14, label: '' }, y: { label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function sized(): PlotArgs<Node> {
  const data = Array.from({ length: 32 }, (_, i) => ({
    x: 8 + (i * 23 % 84),
    y: 18 + (i * 13 % 65),
    value: 20 + (i * 17 % 80),
  }))

  return {
    series: [
      rect<Node>({
        data,
        size: { width: 16, height: 9 },
        color: row => Number(row.value) > 65
          ? { light: '#c2410c', dark: '#fdba74' }
          : { light: '#0891b2', dark: '#67e8f9' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1 },
        tooltip: ({ row }) => document.createTextNode('Value: ' + row.value),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function history(): PlotArgs<Node> {
  const start = Date.UTC(2026, 0, 1, 9)
  const data = Array.from({ length: 36 }, (_, i) => ({
    run: i + 1,
    end_ms: start + (i * 3 + (i % 3)) * 60_000,
    lane: [5, 6, 14, 23, 24, 25, 32].includes(i) ? 'Failed' : 'Passed',
  }))

  return {
    series: [
      rect<Node>({
        data: data.filter(row => row.lane === 'Passed'),
        x: 'end_ms',
        y: 'lane',
        size: { width: 10, height: 40 },
        band_align: 'end',
        inset: 0,
        color: { light: '#189e3e', dark: '#4ade80' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 0.5 },
        tooltip: ({ row }) => document.createTextNode('Run ' + row.run + ': ' + row.lane),
      }),
      rect<Node>({
        data: data.filter(row => row.lane === 'Failed'),
        x: 'end_ms',
        y: 'lane',
        size: { width: 10, height: 40 },
        band_align: 'start',
        inset: 0,
        color: { light: '#c41e5e', dark: '#fb7185' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 0.5 },
        tooltip: ({ row }) => document.createTextNode('Run ' + row.run + ': ' + row.lane),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 24, left: 56 },
    axis: {
      x: {
        scale: 'utc',
        min: start - 5 * 60_000,
        max: start + 115 * 60_000,
        label: '',
        line: false,
        tick_label: { format: value => new Date(Number(value)).toISOString().slice(11, 16) },
      },
      y: { categories: ['Failed', 'Passed'], grid_align: 'edge', label: '', line: false },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    theme_invert: false,
    zoom_pan: false,
  }
}

export const rectExamples = { heatmap, intervals, sized, history }
