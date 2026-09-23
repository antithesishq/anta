import { scatter, type PlotArgs } from '@antadesign/plot'

function base(): PlotArgs<Node> {
  return {
    series: [scatter<Node>({ data: [
      { x: 12, y: 18 }, { x: 30, y: 42 }, { x: 48, y: 35 },
      { x: 58, y: 64 }, { x: 76, y: 58 }, { x: 88, y: 82 },
    ], size: 3, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    height: 260,
    margin: { top: 20, right: 24, bottom: 48, left: 76 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
  }
}

export function title(): PlotArgs<Node> {
  return { ...base(), margin: { top: 44, right: 24, bottom: 48, left: 76 },
    title: { text: 'Plot title', font: { size: 20, color: { light: '#713fff', dark: '#c4b5fd' } } } }
}

export function fontRoles(): PlotArgs<Node> {
  return {
    ...base(),
    margin: { top: 48, right: 20, bottom: 58, left: 72 },
    font: { family: '"TT Interphases Pro Variable", sans-serif', size: 13, weight: 450,
      color: { light: '#713fff', dark: '#c4b5fd' } },
    title: { text: '22px · bold · condensed',
      font: { size: 22, weight: 750, condensed: true, letter_spacing: -0.35 } },
    axis: {
      x: { min: 0, max: 100,
        label: { text: 'Serif · italic · 16px', font: { family: 'Georgia, serif', size: 16, italic: true,
          color: { light: '#c2410c', dark: '#fdba74' } } } },
      y: { min: 0, max: 100,
        label: { text: 'Mono · +1px letters', font: { family: 'monospace', size: 12, letter_spacing: 1 } } },
    },
  }
}

export function fontOverrides(): PlotArgs<Node> {
  return {
    ...base(),
    margin: { top: 48, right: 20, bottom: 58, left: 72 },
    font: { family: '"TT Interphases Pro Variable", sans-serif', size: 14, weight: 600,
      italic: true, caps: true, letter_spacing: 1, word_spacing: 4,
      color: { light: '#0f766e', dark: '#5eead4' } },
    title: { text: 'Small caps · +4px words', font: { size: 20 } },
    axis: {
      x: { min: 0, max: 100,
        label: { text: 'Normal caps · zero spacing', font: { caps: false, italic: false,
          letter_spacing: 0, word_spacing: 0, color: { light: '#c2410c', dark: '#fdba74' } } },
        tick_label: { font: { family: 'monospace', size: 10, weight: 400, italic: false,
          caps: false, letter_spacing: 0, word_spacing: 0 } } },
      y: { min: 0, max: 100,
        label: { text: 'Italic · small caps', font: { caps: 'small-caps', letter_spacing: 0.5, word_spacing: 0 } },
        tick_label: { font: { family: 'monospace', size: 10, weight: 400, italic: false,
          caps: false, letter_spacing: 0, word_spacing: 0 } } },
    },
  }
}

export function margins(): PlotArgs<Node> {
  return { ...base(), margin: { top: 40, right: 40, bottom: 64, left: 88 },
    background: { light: 'white', dark: '#202124' } }
}

export function grid(): PlotArgs<Node> {
  const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  return { ...base(), height: 160, margin: { top: 10, right: 10, bottom: 10, left: 10 },
    series: [scatter<Node>({ data: categories.map((x, i) => ({ x, y: 20 + i * 9 })),
      size: 3, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    axis: { x: { categories, label: '', tick_mark: false, tick_label: { format: () => '' } },
      y: { min: 0, max: 100, label: '', tick_mark: false, tick_label: { format: () => '' } } },
    grid: { x: true, y: true } }
}

export function gridX(): PlotArgs<Node> {
  return { ...grid(), grid: { x: true, y: false } }
}

export function gridY(): PlotArgs<Node> {
  return { ...grid(), grid: { x: false, y: true } }
}

export function gridNone(): PlotArgs<Node> {
  return { ...grid(), grid: false }
}

export function themeColors(): PlotArgs<Node> {
  return { ...base(), series: [scatter<Node>({
    data: [{ x: 20, y: 30 }, { x: 50, y: 65 }, { x: 80, y: 45 }],
    size: 18, color: { light: 'tomato', dark: 'lightskyblue' }, hoverable: false,
  })] }
}

export function scales(): PlotArgs<Node> {
  return { ...base(),
    series: [scatter<Node>({ data: [1, 10, 100, 1000, 10000].map((y, i) => ({ x: 10 + i * 20, y })),
      size: 4, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    axis: { x: { scale: 'linear', min: 0, max: 100, label: 'Linear' },
      y: { scale: 'log', min: 1, max: 10000, label: 'Logarithmic',
        tick_label: { format: value => Number(value) >= 1000 ? Number(value) / 1000 + 'k' : String(value) } } },
    grid: { y: true },
  }
}

export function timeCategory(): PlotArgs<Node> {
  const start = new Date(2026, 0, 12).getTime()
  return { ...base(),
    series: [scatter<Node>({ data: [
      { x: start, y: 'Alpha' }, { x: start + 3600000, y: 'Beta' },
      { x: start + 7200000, y: 'Alpha' }, { x: start + 10800000, y: 'Gamma' },
      { x: start + 14400000, y: 'Beta' },
    ], size: 4, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false })],
    margin: { top: 20, right: 24, bottom: 48, left: 94 },
    axis: { x: { scale: 'time', min: start, max: start + 14400000, label: 'Time', padding: 8,
      tick_label: { format: value => new Date(Number(value)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) } },
      y: { scale: 'category', categories: ['Alpha', 'Beta', 'Gamma'], label: 'Category' } },
  }
}

export function axisLabels(): PlotArgs<Node> {
  return { ...base(), margin: { top: 44, right: 28, bottom: 62, left: 94 }, axis: {
    x: { min: 0, max: 100, label: { text: 'Time', position: 'right', font: { size: 18, color: { light: '#713fff', dark: '#c4b5fd' } } } },
    y: { min: 0, max: 100, label: { text: 'Value', position: 'top', font: { size: 12, color: { light: '#c2410c', dark: '#fdba74' } } } },
  } }
}

export function axisLabelsOpposite(): PlotArgs<Node> {
  return { ...base(), margin: { top: 44, right: 28, bottom: 62, left: 94 }, axis: {
    x: { min: 0, max: 100, label: { text: 'Time', position: 'left', font: { size: 12,
      color: { light: '#c2410c', dark: '#fdba74' } } } },
    y: { min: 0, max: 100, label: { text: 'Value', position: 'bottom', font: { size: 20,
      color: { light: '#713fff', dark: '#c4b5fd' } } } },
  } }
}

export function tickLabels(): PlotArgs<Node> {
  return { ...base(), margin: { top: 44, right: 28, bottom: 62, left: 94 }, axis: {
    x: { min: 0, max: 100, label: 'Elapsed time', tick_label: { format: value => value + ' s', font: { size: 10, color: { light: '#713fff', dark: '#c4b5fd' } } } },
    y: { min: 0, max: 100, label: 'Utilization', tick_label: { format: value => value + '%', font: { size: 15, color: { light: '#c2410c', dark: '#fdba74' } } } },
  } }
}

export function seriesColors(): PlotArgs<Node> {
  return { ...base(), series: [scatter<Node>({
    data: [{ x: 12, y: 18 }, { x: 30, y: 42 }, { x: 48, y: 35 }, { x: 58, y: 64 }, { x: 76, y: 58 }, { x: 88, y: 82 }],
    size: 8, color: row => Number(row.y) >= 60
      ? { light: '#c2410c', dark: '#fdba74' } : { light: '#64748b', dark: '#94a3b8' },
    hoverable: false,
  })] }
}

export function markShapes(): PlotArgs<Node> {
  const marks = ['circle', 'square', 'diamond', 'triangle'] as const
  return { ...base(), series: marks.map((mark, i) => scatter<Node>({
    data: [{ x: mark, y: 40 + i * 10 }], mark, size: 12,
    color: [
      { light: '#7c3aed', dark: '#c4b5fd' }, { light: '#db2777', dark: '#f9a8d4' },
      { light: '#0891b2', dark: '#67e8f9' }, { light: '#ea580c', dark: '#fdba74' },
    ][i], hoverable: false,
  })), axis: { x: { categories: [...marks], label: '' }, y: { min: 0, max: 100, label: '' } },
    margin: { top: 20, right: 12, bottom: 32, left: 32 },
  }
}

export function strokes(): PlotArgs<Node> {
  return { ...base(), series: [1, 3, 5].map((width, i) => scatter<Node>({
    data: [{ x: 25 + i * 25, y: 50 }], size: 18,
    color: { light: '#f0abfc', dark: '#c026d3' },
    stroke: { color: { light: '#7e22ce', dark: '#f5d0fe' }, width }, hoverable: false,
  })) }
}

export const detailExamples = { title, fontRoles, fontOverrides, margins, grid, gridX, gridY, gridNone, themeColors, scales, timeCategory, axisLabels, axisLabelsOpposite,
  tickLabels, seriesColors, markShapes, strokes }
