import { scatter, type PlotArgs } from '@antadesign/plot'

export function stylingExample(): PlotArgs<Node> {
  return {
    series: [scatter<Node>({
      data: [{ x: 12, y: 18 }, { x: 30, y: 42 }, { x: 48, y: 35 },
        { x: 58, y: 64 }, { x: 76, y: 58 }, { x: 88, y: 82 }],
      size: 3, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false,
    })],
    margin: { top: 16, right: 16, bottom: 40, left: 60 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: false,
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
  }
}
