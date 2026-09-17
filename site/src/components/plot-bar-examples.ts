import { bar, type PlotArgs } from '@antadesign/plot'

export function rounded(): PlotArgs<Node> {
  const data = [
    { day: 'Mon', requests: 42 },
    { day: 'Tue', requests: 68 },
    { day: 'Wed', requests: 91 },
    { day: 'Thu', requests: 57 },
    { day: 'Fri', requests: 84 },
    { day: 'Sat', requests: 36 },
    { day: 'Sun', requests: 24 },
  ]

  return {
    series: [bar<Node>({
      data,
      x: 'day',
      y: 'requests',
      border_radius: 6,
      inset: 5,
      color: row => Number(row.requests) > 80
        ? { light: '#c2410c', dark: '#fdba74' }
        : { light: '#0891b2', dark: '#67e8f9' },
      hover_span_x: true,
      tooltip: ({ x, y }) => document.createTextNode(x + ': ' + y + ' requests/s'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function horizontal(): PlotArgs<Node> {
  const data = [
    { service: 'Search', requests: 92 },
    { service: 'Feed', requests: 78 },
    { service: 'Checkout', requests: 64 },
    { service: 'Profile', requests: 47 },
    { service: 'Upload', requests: 31 },
  ]

  return {
    series: [bar<Node>({
      data,
      x: 'requests',
      y: 'service',
      border_radius: 4,
      inset: 8,
      color: { light: '#7c3aed', dark: '#c4b5fd' },
      hover_span_y: true,
      tooltip: ({ x, y }) => document.createTextNode(y + ': ' + x + ' requests/s'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 78 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: false,
    zoom_pan: false,
  }
}

export function stacked(): PlotArgs<Node> {
  const data = [
    { day: 'Mon', network: 18, compute: 42, storage: 24 },
    { day: 'Tue', network: 24, compute: 32, storage: 18 },
    { day: 'Wed', network: 12, compute: 56, storage: 28 },
    { day: 'Thu', network: 28, compute: 24, storage: 16 },
    { day: 'Fri', network: 16, compute: 48, storage: 22 },
  ]

  return {
    series: [bar<Node>({
      data,
      x: 'day',
      y: ['network', 'compute', 'storage'],
      color: [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#6366f1', dark: '#a5b4fc' },
        { light: '#d97706', dark: '#fcd34d' },
      ],
      inset: 8,
      tooltip: ({ label, y }) => document.createTextNode(label + ': ' + y + ' ms'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function diverging(): PlotArgs<Node> {
  const data = [
    { month: 'Jan', change: 24 },
    { month: 'Feb', change: -16 },
    { month: 'Mar', change: 38 },
    { month: 'Apr', change: 12 },
    { month: 'May', change: -28 },
    { month: 'Jun', change: -9 },
    { month: 'Jul', change: 31 },
  ]

  return {
    series: [bar<Node>({
      data,
      x: 'month',
      y: 'change',
      inset: 6,
      color: row => Number(row.change) >= 0
        ? { light: '#0d9488', dark: '#5eead4' }
        : { light: '#c2410c', dark: '#fdba74' },
      hover_span_x: true,
      tooltip: ({ x, y }) => document.createTextNode(x + ': ' + (Number(y) > 0 ? '+' : '') + y + '%'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { label: '' }, y: { min: -40, max: 40, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function stackedHorizontal(): PlotArgs<Node> {
  const data = [
    { service: 'Search', network: 18, compute: 46, storage: 14 },
    { service: 'Feed', network: 26, compute: 28, storage: 22 },
    { service: 'Upload', network: 42, compute: 16, storage: 32 },
    { service: 'Export', network: 12, compute: 36, storage: 18 },
  ]
  return {
    series: [bar<Node>({ data, x: ['network', 'compute', 'storage'], y: 'service',
      color: [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#6366f1', dark: '#a5b4fc' },
        { light: '#d97706', dark: '#fcd34d' },
      ],
      inset: 8, border_radius: 3,
      tooltip: ({ label, x }) => document.createTextNode(label + ': ' + x + ' ms'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 64 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: false,
    zoom_pan: false,
  }
}

export function stackedDiverging(): PlotArgs<Node> {
  const data = [
    { month: 'Jan', new: 28, expansion: 12, churn: -14, contraction: -6 },
    { month: 'Feb', new: 18, expansion: 8, churn: -22, contraction: -10 },
    { month: 'Mar', new: 36, expansion: 16, churn: -8, contraction: -4 },
    { month: 'Apr', new: 24, expansion: 18, churn: -18, contraction: -12 },
    { month: 'May', new: 32, expansion: 10, churn: -12, contraction: -8 },
  ]
  return {
    series: [bar<Node>({ data, x: 'month', y: ['new', 'expansion', 'churn', 'contraction'],
      color: [
        { light: '#0d9488', dark: '#2dd4bf' },
        { light: '#5eead4', dark: '#99f6e4' },
        { light: '#ea580c', dark: '#fb923c' },
        { light: '#fdba74', dark: '#fed7aa' },
      ],
      inset: 7,
      tooltip: ({ label, y }) => document.createTextNode(label + ': ' + (Number(y) > 0 ? '+' : '') + y),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 36 },
    axis: { x: { label: '' }, y: { min: -40, max: 60, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function stackedTooltip(): PlotArgs<Node> {
  const data = [
    { day: 'Mon', network: 18, compute: 42, storage: 24 },
    { day: 'Tue', network: 24, compute: 32, storage: 18 },
    { day: 'Wed', network: 12, compute: 56, storage: 28 },
    { day: 'Thu', network: 28, compute: 24, storage: 16 },
    { day: 'Fri', network: 16, compute: 48, storage: 22 },
  ]

  return {
    series: [bar<Node>({
      data,
      x: 'day',
      y: ['network', 'compute', 'storage'],
      color: [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#6366f1', dark: '#a5b4fc' },
        { light: '#d97706', dark: '#fcd34d' },
      ],
      inset: 10,
      hover_span_x: false,
      hover_span_y: false,
      tooltip: ({ label, row }) => {
        const content = document.createElement('div')
        for (const field of ['network', 'compute', 'storage']) {
          const entry = document.createElement('div')
          const value = document.createElement(field === label ? 'strong' : 'span')
          value.textContent = field + ': ' + row[field] + ' ms'
          entry.append(value)
          content.append(entry)
        }
        return content
      },
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function categoryOrder(): PlotArgs<Node> {
  const data = [
    { severity: 'High', count: 28 }, { severity: 'Low', count: 46 },
    { severity: 'Critical', count: 12 }, { severity: 'Medium', count: 35 },
  ]
  return {
    series: [bar<Node>({ data, x: 'severity', y: 'count', inset: 10, border_radius: 3,
      color: { light: '#64748b', dark: '#94a3b8' },
      tooltip: ({ x, y }) => document.createTextNode(x + ': ' + y + ' issues'),
    })],
    height: 260,
    margin: { top: 5, right: 12, bottom: 24, left: 30 },
    axis: {
      x: { categories: ['Critical', 'High', 'Medium', 'Low'], label: '' },
      y: { min: 0, max: 50, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export const barExamples = { rounded, horizontal, stacked, diverging, stackedHorizontal, stackedDiverging, stackedTooltip, categoryOrder }
