import { useRef } from 'preact/hooks'
import { Box } from '@antadesign/anta'
import type { BoxContext } from '@antadesign/anta'
import { useElements } from './useElements'

export function BoxCanvasPreview() {
  useElements()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function draw(context: BoxContext) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { font, devicePixelRatio: dpr } = context
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    ctx.scale(dpr, dpr)
    ctx.font = font.shorthand
    ctx.letterSpacing = font.letterSpacing
    ctx.wordSpacing = font.wordSpacing
    ctx.direction = font.direction === 'rtl' ? 'rtl' : 'ltr'
    ctx.fillStyle = font.color
    ctx.fillText('Matches the DOM', 0, font.lineHeight ?? font.size)
  }

  return (
    <Box className="canvas-probe" onContextChange={(_, { current }) => draw(current)}>
      <span>Matches the DOM</span>
      <canvas ref={canvasRef} aria-label="Canvas text using the Box font and color" />
    </Box>
  )
}
