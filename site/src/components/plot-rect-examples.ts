import { rect, type PlotArgs } from '@antadesign/plot'

export function heatmap(): PlotArgs<Node> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
  const data = days.flatMap((day, d) => hours.map((hour, h) => {
    const daytime = Math.exp(-(((h - 14) / 5) ** 2))
    const variation = 0.9 + 0.1 * Math.sin(h * 1.7 + d * 2.3)
    const requests = Math.round((120 + 880 * daytime) * (d < 5 ? 1 : 0.4) * variation)
    return { day, hour, requests }
  }))

  return {
    series: [
      rect({
        data,
        x: 'hour',
        y: 'day',
        inset: 0.75,
        color: row => ({
          light: 'hsl(174, 65%, ' + (94 - Number(row.requests) * 0.06) + '%)',
          dark: 'hsl(174, 55%, ' + (16 + Number(row.requests) * 0.04) + '%)',
        }),
        tooltip: ({ row }) => document.createTextNode(row.day + ' ' + row.hour + ':00 · ' + row.requests + ' requests'),
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
      rect({
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
      rect({
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
      rect({
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
      rect({
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

export function bounds(): PlotArgs<Node> {
  const series: PlotArgs<Node>['series'] = [rect({
    data: [
      { start: 1, end: 3, low: 2, high: 5 },
      { start: 4, end: 6, low: 1, high: 4 },
    ],
    x: 'start',
    x2: 'end',
    y: 'low',
    y2: 'high',
    min_size: 2,
    offset: { x: 0, y: 0 },
    color: 'lightsteelblue',
    stroke: { color: 'steelblue', width: 1 },
    tooltip: ({ x, y }) => document.createTextNode('(' + x + ', ' + y + ')'),
    on_select: ({ row }) => console.log('Selected data:', row),
    hoverable: true,
    highlight: true,
  })]

  return {
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 0, max: 7, label: '' }, y: { min: 0, max: 6, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  }
}

export function bands(): PlotArgs<Node> {
  const series: PlotArgs<Node>['series'] = [rect({
    data: [{ group: 'A', row: 'First' }, { group: 'B', row: 'Second' }],
    x: 'group',
    y: 'row',
    size: { width: 12 },
    band_align: 'start',
    inset: 16,
    offset: { x: 2, y: 0 },
    hover_span_x: true,
    hover_span_y: true,
    color: 'steelblue',
    tooltip: true,
  })]

  return {
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 62 },
    axis: { x: { categories: ['A', 'B'], grid_align: 'edge', label: '' }, y: { categories: ['First', 'Second'], grid_align: 'edge', label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  }
}

export function background(): PlotArgs<Node> {
  const series: PlotArgs<Node>['series'] = [rect({
    data: [{ low: 2, high: 5 }],
    span: 'x',
    y: 'low',
    y2: 'high',
    color: 'aliceblue',
    hoverable: false,
    highlight: false,
  })]

  return {
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 0, max: 10, label: '' }, y: { min: 0, max: 7, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  }
}

export const rectExamples = { heatmap, intervals, sized, history, bounds, bands, background }
