import { custom, scatter, type PlotArgs, type CustomRendererFn, type CustomHitTestFn, type CustomHighlightRendererFn } from '@antadesign/plot'

export function ellipses(): PlotArgs<Node> {
  const groups = [
    { x: 32, y: 40, sx: 10, sy: 5, angle: 0.6 },
    { x: 68, y: 62, sx: 8, sy: 5, angle: -0.8 },
  ]
  const points = groups.flatMap((group, g) => Array.from({ length: 80 }, (_, i) => {
    const radius = Math.sqrt(-2 * Math.log((i + 0.5) / 80))
    const theta = i * 2.399963
    const u = group.sx * radius * Math.cos(theta)
    const v = group.sy * radius * Math.sin(theta)
    return {
      x: group.x + u * Math.cos(group.angle) - v * Math.sin(group.angle),
      y: group.y + u * Math.sin(group.angle) + v * Math.cos(group.angle),
      group: g,
    }
  }))

  return {
    series: [
      scatter<Node>({
        data: points,
        size: 3,
        color: row => Number(row.group) === 0
          ? { light: '#0d9488', dark: '#5eead4' }
          : { light: '#7c3aed', dark: '#c4b5fd' },
        tooltip: ({ x, y }) => document.createTextNode(Number(x).toFixed(1) + ', ' + Number(y).toFixed(1)),
      }),
      custom<Node>({
        data: groups,
        x: 'x', y: 'y',
        color: (_, i) => i === 0
          ? { light: '#0f766e', dark: '#5eead4' }
          : { light: '#6d28d9', dark: '#c4b5fd' },
        hoverable: false,
        renderer: (_, { ctx, x_scale, y_scale, color_at }) => {
          ctx.save()
          ctx.lineWidth = 2
          groups.forEach((group, i) => {
            ctx.strokeStyle = color_at(i)
            ctx.beginPath()
            // The 95% contour of the specified bivariate Gaussian model.
            for (let step = 0; step <= 100; step++) {
              const theta = step / 100 * Math.PI * 2
              const u = Math.sqrt(5.991) * group.sx * Math.cos(theta)
              const v = Math.sqrt(5.991) * group.sy * Math.sin(theta)
              const x = Number(x_scale(group.x + u * Math.cos(group.angle) - v * Math.sin(group.angle)))
              const y = Number(y_scale(group.y + u * Math.sin(group.angle) + v * Math.cos(group.angle)))
              if (step === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.closePath()
            ctx.stroke()
          })
          ctx.restore()
        },
      }),
    ],
    height: 260,
    margin: { top: 8, right: 8, bottom: 24, left: 30 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function chords(): PlotArgs<Node> {
  const names = ['A', 'B', 'C', 'D', 'E']
  const matrix = [
    [0, 12, 8, 4, 16],
    [12, 0, 18, 6, 3],
    [8, 18, 0, 14, 7],
    [4, 6, 14, 0, 11],
    [16, 3, 7, 11, 0],
  ]
  const gap = 0.08
  const total = matrix.flat().reduce((sum, value) => sum + value, 0)
  const unit = (Math.PI * 2 - gap * names.length) / total
  let angle = -Math.PI / 2
  const groups = matrix.map((row, i) => {
    const start = angle
    const segments = row.map(value => {
      const from = angle
      angle += value * unit
      return { start: from, end: angle }
    })
    const end = angle
    angle += gap
    return { name: names[i], total: row.reduce((sum, value) => sum + value, 0), start, end, segments }
  })

  return {
    series: [custom<Node>({
      data: groups,
      color: (_, i) => [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#7c3aed', dark: '#c4b5fd' },
        { light: '#db2777', dark: '#f9a8d4' },
        { light: '#d97706', dark: '#fcd34d' },
        { light: '#2563eb', dark: '#93c5fd' },
      ][i],
      hit_test: (_, { cursor, inner }) => {
        const cx = (inner.left + inner.right) / 2
        const cy = (inner.top + inner.bottom) / 2
        const radius = Math.min(inner.right - inner.left, inner.bottom - inner.top) / 2 - 32
        const distance = Math.hypot(cursor.x - cx, cursor.y - cy)
        if (Math.abs(distance - (radius + 7)) > 8) return null
        let angle = Math.atan2(cursor.y - cy, cursor.x - cx)
        if (angle < -Math.PI / 2) angle += Math.PI * 2
        const index = groups.findIndex(group => angle >= group.start && angle <= group.end)
        return index < 0 ? null : index
      },
      tooltip: ({ row }) => document.createTextNode('Group ' + row?.name + ': ' + row?.total + ' connections'),
      render_highlight: (series, i, { ctx, inner, color_at, highlight_color_at }) => {
        const rows = series.rows as typeof groups
        const group = rows[i]
        const cx = (inner.left + inner.right) / 2
        const cy = (inner.top + inner.bottom) / 2
        const radius = Math.min(inner.right - inner.left, inner.bottom - inner.top) / 2 - 32
        const point = (a: number) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
        // Match the main renderer: ribbons take the lower-index group's color.
        ctx.fillStyle = color_at(i)
        ctx.globalAlpha = 0.45
        for (let j = i + 1; j < rows.length; j++) {
          const source = group.segments[j]
          const target = rows[j].segments[i]
          const [sx, sy] = point(source.start)
          const [tx, ty] = point(target.start)
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.arc(cx, cy, radius, source.start, source.end)
          ctx.quadraticCurveTo(cx, cy, tx, ty)
          ctx.arc(cx, cy, radius, target.start, target.end)
          ctx.quadraticCurveTo(cx, cy, sx, sy)
          ctx.closePath()
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.strokeStyle = highlight_color_at(i)
        ctx.lineWidth = 13
        ctx.beginPath()
        ctx.arc(cx, cy, radius + 7, group.start, group.end)
        ctx.stroke()
      },
      renderer: (_, { ctx, inner, color_at }) => {
        const cx = (inner.left + inner.right) / 2
        const cy = (inner.top + inner.bottom) / 2
        const radius = Math.min(inner.right - inner.left, inner.bottom - inner.top) / 2 - 32
        const point = (a: number) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
        ctx.save()
        // Allocate ribbon endpoints from the same weights as the outer arcs.
        groups.forEach((group, i) => {
          for (let j = i + 1; j < groups.length; j++) {
            const source = group.segments[j]
            const target = groups[j].segments[i]
            const [sx, sy] = point(source.start)
            const [tx, ty] = point(target.start)
            ctx.fillStyle = color_at(i)
            ctx.globalAlpha = 0.45
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.arc(cx, cy, radius, source.start, source.end)
            ctx.quadraticCurveTo(cx, cy, tx, ty)
            ctx.arc(cx, cy, radius, target.start, target.end)
            ctx.quadraticCurveTo(cx, cy, sx, sy)
            ctx.closePath()
            ctx.fill()
          }
        })
        ctx.globalAlpha = 1
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        groups.forEach((group, i) => {
          ctx.strokeStyle = color_at(i)
          ctx.fillStyle = color_at(i)
          ctx.lineWidth = 9
          ctx.beginPath()
          ctx.arc(cx, cy, radius + 7, group.start, group.end)
          ctx.stroke()
          const mid = (group.start + group.end) / 2
          ctx.fillText(group.name, cx + (radius + 22) * Math.cos(mid), cy + (radius + 22) * Math.sin(mid))
        })
        ctx.restore()
      },
    })],
    height: 260,
    margin: 0,
    axis: { x: { hidden: true, min: 0, max: 1 }, y: { hidden: true, min: 0, max: 1 } },
    background: { light: '#ffffff', dark: '#151b28' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

// Deterministic samples and a Gaussian kernel density estimate, used by the violin example.
function distributions() {
  return ['A', 'B', 'C'].map((group, g) => {
    const values = Array.from({ length: 60 }, (_, i) => {
      const z = Math.sqrt(-2 * Math.log((i + 0.5) / 60)) * Math.cos(i * 2.399963)
      return 36 + g * 10 + z * (6 + g * 2) + (g === 2 && i % 2 === 0 ? 18 : 0)
    }).sort((a, b) => a - b)
    const density = Array.from({ length: 101 }, (_, value) => ({
      value,
      density: values.reduce((sum, sample) => sum + Math.exp(-0.5 * ((value - sample) / 4) ** 2), 0)
        / (values.length * 4 * Math.sqrt(2 * Math.PI)),
    }))
    return { group, values, density, q1: values[15], median: (values[29] + values[30]) / 2, q3: values[44] }
  })
}

// Test the same closed polygon used for drawing, including the spaces between sampled points.
function containsPoint(points: number[][], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function ridgelines(): PlotArgs<Node> {
  const data = Array.from({ length: 6 }, (_, i) => {
    const values = Array.from({ length: 80 }, (_, j) => {
      const z = Math.sqrt(-2 * Math.log((j + 0.5) / 80)) * Math.cos(j * 2.399963)
      return 25 + i * 8 + z * [8, 5, 11, 4, 9, 6][i] + (j % 3 === 0 ? 14 : 0)
    })
    return {
      group: 'Week ' + (i + 1),
      mean: values.reduce((sum, value) => sum + value, 0) / values.length,
      density: Array.from({ length: 101 }, (_, value) => ({
        value,
        density: values.reduce((sum, sample) => sum + Math.exp(-0.5 * ((value - sample) / 3) ** 2), 0)
          / (values.length * 3 * Math.sqrt(2 * Math.PI)),
      })),
    }
  })
  const peak = Math.max(...data.flatMap(row => row.density.map(point => point.density)))

  return {
    series: [custom<Node>({
      data,
      y: 'group',
      color: (_, i) => ({ light: 'hsl(' + (175 + i * 15) + ', 55%, 55%)', dark: 'hsl(' + (175 + i * 15) + ', 50%, 45%)' }),
      hit_test: (_, { cursor, x_scale, resolve_y, inner }) => {
        const step = (inner.bottom - inner.top) / data.length
        // Reverse paint order selects the foreground ridge where shapes overlap.
        for (let i = data.length - 1; i >= 0; i--) {
          const center = resolve_y(i)
          if (center === undefined) continue
          const baseline = center + step * 0.45
          const points = [
            [Number(x_scale(0)), baseline],
            ...data[i].density.map(point => [
              Number(x_scale(point.value)), baseline - point.density / peak * step * 1.9,
            ]),
            [Number(x_scale(100)), baseline],
          ]
          if (containsPoint(points, cursor.x, cursor.y)) return i
        }
        return null
      },
      tooltip: ({ row }) => document.createTextNode(row?.group + ' · 80 samples · mean ' + Number(row?.mean).toFixed(1)),
      renderer: (series, { ctx, x_scale, resolve_y, color_at, inner }) => {
        const step = (inner.bottom - inner.top) / data.length
        ctx.save()
        // Paint from the top row down, so foreground ridges cover the preceding tails.
        const rows = series.rows as typeof data
        rows.forEach((row, i) => {
          const center = resolve_y(i)
          if (center === undefined) return
          const baseline = center + step * 0.45
          ctx.fillStyle = color_at(i)
          ctx.strokeStyle = '#334155'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(Number(x_scale(0)), baseline)
          row.density.forEach(point => {
            ctx.lineTo(Number(x_scale(point.value)), baseline - point.density / peak * step * 1.9)
          })
          ctx.lineTo(Number(x_scale(100)), baseline)
          ctx.closePath()
          ctx.globalAlpha = [1, 0.7, 0.85, 0.65, 0.8, 0.7][data.indexOf(row)]
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.stroke()
        })
        ctx.restore()
      },
    })],
    height: 260,
    margin: { top: 24, right: 8, bottom: 24, left: 52 },
    axis: {
      x: { min: 0, max: 100, label: '' },
      y: { categories: data.map(row => row.group).reverse(), padding_top: 28, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function violins(): PlotArgs<Node> {
  const data = distributions()
  const peak = Math.max(...data.flatMap(row => row.density.map(point => point.density)))

  return {
    series: [custom<Node>({
      data,
      x: 'group',
      color: (_, i) => [
        { light: 'color-mix(in oklch, #0d9488 60%, transparent)', dark: 'color-mix(in oklch, #5eead4 60%, transparent)' },
        { light: 'color-mix(in oklch, #7c3aed 60%, transparent)', dark: 'color-mix(in oklch, #c4b5fd 60%, transparent)' },
        { light: 'color-mix(in oklch, #c2410c 60%, transparent)', dark: 'color-mix(in oklch, #fdba74 60%, transparent)' },
      ][i],
      hit_test: (_, { cursor, y_scale, resolve_x, inner }) => {
        const width = Math.min(34, (inner.right - inner.left) / 9)
        for (let i = data.length - 1; i >= 0; i--) {
          const x = resolve_x(i)
          if (x === undefined) continue
          const points = [
            ...data[i].density.map(point => [x + point.density / peak * width, Number(y_scale(point.value))]),
            ...data[i].density.slice().reverse().map(point => [x - point.density / peak * width, Number(y_scale(point.value))]),
          ]
          if (containsPoint(points, cursor.x, cursor.y)) return i
        }
        return null
      },
      tooltip: ({ row }) => document.createTextNode('Group ' + row?.group
        + ' · median ' + Number(row?.median).toFixed(1)
        + ' · middle 50%: ' + Number(row?.q1).toFixed(1) + '–' + Number(row?.q3).toFixed(1)),
      renderer: (series, { ctx, y_scale, resolve_x, color_at, inner }) => {
        const width = Math.min(34, (inner.right - inner.left) / 9)
        ctx.save()
        const rows = series.rows as typeof data
        rows.forEach((row, i) => {
          const x = resolve_x(i)
          if (x === undefined) return
          ctx.fillStyle = color_at(i)
          ctx.beginPath()
          row.density.forEach((point, j) => {
            const px = x + point.density / peak * width
            const py = Number(y_scale(point.value))
            if (j === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          row.density.slice().reverse().forEach(point => {
            ctx.lineTo(x - point.density / peak * width, Number(y_scale(point.value)))
          })
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#151b28'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(x, Number(y_scale(row.q1)))
          ctx.lineTo(x, Number(y_scale(row.q3)))
          ctx.stroke()
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(x, Number(y_scale(row.median)), 3, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()
      },
    })],
    height: 260,
    margin: { top: 8, right: 8, bottom: 24, left: 30 },
    axis: { x: { categories: ['A', 'B', 'C'], label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function highlights(): PlotArgs<Node> {
  const renderer: CustomRendererFn<Node> = (series, { ctx, resolve_x, resolve_y, color_at }) => {
    for (let i = 0; i < series.x.length; i++) {
      const x = resolve_x(i), y = resolve_y(i)
      if (x === undefined || y === undefined) continue
      ctx.fillStyle = color_at(i)
      ctx.beginPath()
      ctx.arc(x, y, 16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const hit_test: CustomHitTestFn<Node> = (series, { cursor, resolve_x, resolve_y }) => {
    for (let i = series.x.length - 1; i >= 0; i--) {
      const x = resolve_x(i), y = resolve_y(i)
      if (x !== undefined && y !== undefined && Math.hypot(cursor.x - x, cursor.y - y) <= 16) return i
    }
    return null
  }
  const render_highlight: CustomHighlightRendererFn<Node> = (series, i, { ctx, resolve_x, resolve_y, highlight_color_at }) => {
    const x = resolve_x(i), y = resolve_y(i)
    if (x === undefined || y === undefined) return
    ctx.strokeStyle = highlight_color_at(i)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, Math.PI * 2)
    ctx.stroke()
  }
  return {
    height: 260,
    axis: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
    margin: { top: 12, right: 12, bottom: 28, left: 32 },
    grid: false, zoom_pan: false,
    series: [
      custom<Node>({
        data: [{ x: 20, y: 35 }, { x: 20, y: 65 }], x: 'x', y: 'y', renderer, hit_test,
        color: 'color-mix(in oklch, teal 40%, transparent)', tooltip: true,
      }),
      custom<Node>({
        data: [{ x: 50, y: 35 }, { x: 50, y: 65 }], x: 'x', y: 'y', renderer, hit_test, render_highlight,
        color: { light: '#7c3aed', dark: '#c4b5fd' }, tooltip: true,
      }),
      custom<Node>({
        data: [{ x: 80, y: 35 }, { x: 80, y: 65 }], x: 'x', y: 'y', renderer, hit_test,
        color: '#94a3b8', highlight: false, tooltip: true,
      }),
    ],
  }
}

export const customExamples = { ellipses, chords, ridgelines, violins, highlights }
