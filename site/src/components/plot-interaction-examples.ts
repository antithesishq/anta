import { scatter, line, bar, rect, type PlotArgs } from '@antadesign/plot'

export function highlights(): PlotArgs<Node> {
  const data = [
    { x: 'A', y: 64 }, { x: 'B', y: 82 },
    { x: 'C', y: 53 }, { x: 'D', y: 71 },
    { x: 'E', y: 44 }, { x: 'F', y: 61 },
  ]

  return {
    series: [
      bar<Node>({
        data: data.slice(0, 2), inset: 7, border_radius: 4,
        color: { light: 'rgba(13, 148, 136, 0.35)', dark: 'rgba(94, 234, 212, 0.35)' },
      }),
      bar<Node>({
        data: data.slice(2, 4), inset: 7, border_radius: 4,
        color: { light: '#0d9488', dark: '#5eead4' },
        highlight_color: row => row.x === 'C'
          ? { light: '#f97316', dark: '#fdba74' }
          : 'color-mix(in oklch, magenta 50%, transparent)',
      }),
      bar<Node>({
        data: data.slice(4, 5), inset: 7, border_radius: 4,
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        highlight: false,
      }),
      bar<Node>({
        data: data.slice(5), inset: 7, border_radius: 4,
        color: { light: '#94a3b8', dark: '#64748b' },
        hoverable: false,
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { categories: data.map(row => row.x), label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function tooltips(): PlotArgs<Node> {
  const data = [
    { x: 8, x2: 38, y: 15, y2: 48, name: 'Window A' },
    { x: 55, x2: 86, y: 48, y2: 82, name: 'Window B' },
  ]

  return {
    series: [
      rect<Node>({
        data,
        color: { light: 'rgba(13, 148, 136, 0.45)', dark: 'rgba(94, 234, 212, 0.45)' },
        stroke: { color: { light: '#0d9488', dark: '#5eead4' }, width: 2 },
        tooltip: true,
      }),
      rect<Node>({
        data: data.map(row => ({
          ...row, x: row.x + 12, x2: row.x2 + 8, y: row.y + 12, y2: row.y2 + 10,
        })),
        color: { light: 'rgba(124, 58, 237, 0.45)', dark: 'rgba(196, 181, 253, 0.45)' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 2 },
        tooltip: ({ row }) => {
          const content = document.createElement('div')
          const title = document.createElement('strong')
          title.textContent = String(row.name)
          const value = document.createElement('div')
          value.textContent = 'Bounds: x ' + row.x + '–' + row.x2 + ', y ' + row.y + '–' + row.y2
          content.append(title, value)
          return content
        },
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function selection(output: HTMLOutputElement): PlotArgs<Node> {
  const data = Array.from({ length: 24 }, (_, i) => ({
    x: 8 + (i * 19 % 84),
    y: 12 + (i * 29 % 76),
    name: 'Sample ' + (i + 1),
  }))

  return {
    series: [
      scatter<Node>({
        data, size: 13,
        color: { light: '#0891b2', dark: '#67e8f9' },
        tooltip: true,
        on_select: ({ row, x, y }) => {
          output.textContent = row.name + ' · x: ' + x + ' · y: ' + y
        },
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function zoom(output: HTMLOutputElement): PlotArgs<Node> {
  const data = Array.from({ length: 201 }, (_, i) => ({
    x: i / 2,
    y: 45 + 18 * Math.sin(i / 18) + 9 * Math.cos(i / 5) + 4 * Math.sin(i * 1.3),
  }))

  return {
    series: [
      line<Node>({
        data, width: 2,
        color: { light: '#6366f1', dark: '#a5b4fc' },
        tooltip: true,
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: { x: true, y: true, modifier: true },
    on_viewport_change: ({ x, y }) => {
      const format = (axis: { window: number[] } | null) => axis
        ? axis.window.map(value => value.toFixed(1)).join('–') : 'full extent'
      output.textContent = 'Visible x: ' + format(x) + ' · y: ' + format(y)
    },
  }
}

export function zoomFree(output: HTMLOutputElement): PlotArgs<Node> {
  return { ...zoom(output), zoom_pan: { x: true, y: true, modifier: false } }
}

export function zoomX(output: HTMLOutputElement): PlotArgs<Node> {
  return { ...zoom(output), zoom_pan: { x: true, y: false, modifier: true } }
}

export function viewport(output: HTMLOutputElement): PlotArgs<Node> {
  return { ...zoomX(output), viewport: { x: [20, 45], y: null, key: 0 } }
}

export function composedTooltips(): PlotArgs<Node> {
  const args = tooltips()
  return {
    ...args,
    tooltip: ([baseline_hit, current_hit]) => {
      const baseline = baseline_hit?.data.row
      const current = current_hit?.data.row
      const content = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = String((current ?? baseline)?.name ?? 'Window comparison')
      const table = document.createElement('table')
      const header = table.createTHead().insertRow()
      for (const label of ['Bound', 'Baseline', 'Current', 'Change']) {
        const cell = document.createElement('th')
        cell.scope = 'col'
        cell.textContent = label
        header.append(cell)
      }
      const body = table.createTBody()
      for (const [field, label] of [['x', 'X start'], ['x2', 'X end'], ['y', 'Y start'], ['y2', 'Y end']]) {
        const before = baseline?.[field]
        const after = current?.[field]
        const delta = typeof before === 'number' && typeof after === 'number' ? after - before : undefined
        const row = body.insertRow()
        const heading = document.createElement('th')
        heading.scope = 'row'
        heading.textContent = label
        row.append(heading)
        for (const value of [before ?? '—', after ?? '—', delta === undefined ? '—' : `${delta > 0 ? '+' : ''}${delta}`]) {
          row.insertCell().textContent = String(value)
        }
      }
      content.append(title, table)
      return content
    },
  }
}

export const interactionExamples = { highlights, tooltips, composedTooltips, selection, zoom, zoomFree, zoomX, viewport }
