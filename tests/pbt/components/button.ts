import type { Locator, Page } from 'playwright'

type PropertyInput = {
  control: Locator
  props: Record<string, unknown>
  action: string
}

type TestButton = HTMLElement & {
  __clicked?: boolean
}

const click = {
  name: 'click',
  run: async (page: Page, control: Locator) => {
    await control.evaluate((element: TestButton) => {
      element.__clicked = false
      element.addEventListener('click', (event) => {
        element.__clicked = true
        event.preventDefault()
      }, { capture: true, once: true })
    })
    const box = await control.boundingBox()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  },
}

const clickability = {
  name: 'clickability',
  run: ({ control, props, action }: PropertyInput) => action === 'click'
    ? control.evaluate((element: TestButton, unavailable) => {
      const expected = !unavailable
      return element.__clicked === expected
        ? undefined
        : `clicked=${element.__clicked}, expected ${expected}`
    }, Boolean(props.disabled || props.loading))
    : undefined,
}

const layoutDoesntCollide = {
  name: 'layoutDoesntCollide',
  run: ({ control, props, action }: PropertyInput) => action === 'render'
    ? control.evaluate((element, props) => {
      const label = element.querySelector<HTMLElement>(':scope > a-button-label')
      if (!label) return 'label is missing'

      type Rect = { left: number; right: number; top: number; bottom: number }
      const button = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const px = (value: string) => Number.parseFloat(value) || 0
      const tolerance = 0.5
      const failures: string[] = []
      const shadowLengths = style.boxShadow.match(/-?\d*\.?\d+px/g)?.map(px) ?? []
      const selectedRing = style.boxShadow.includes('inset') ? shadowLengths[3] ?? 0 : 0
      if (props.selected && selectedRing <= 0) failures.push('selected ring is missing')

      const contentBox: Rect = {
        left: button.left + px(style.borderLeftWidth) + px(style.paddingLeft),
        right: button.right - px(style.borderRightWidth) - px(style.paddingRight),
        top: button.top + px(style.borderTopWidth) + px(style.paddingTop),
        bottom: button.bottom - px(style.borderBottomWidth) - px(style.paddingBottom),
      }
      const paintBox: Rect = {
        left: button.left + Math.max(px(style.borderLeftWidth), selectedRing),
        right: button.right - Math.max(px(style.borderRightWidth), selectedRing),
        top: button.top + Math.max(px(style.borderTopWidth), selectedRing),
        bottom: button.bottom - Math.max(px(style.borderBottomWidth), selectedRing),
      }
      const radius = Math.min(px(style.borderTopLeftRadius), button.width / 2, button.height / 2)
      const innerRadius = Math.max(0, radius - Math.max(px(style.borderLeftWidth), px(style.borderTopWidth), selectedRing))
      const within = (rect: Rect, box: Rect) =>
        rect.left >= box.left - tolerance && rect.right <= box.right + tolerance &&
        rect.top >= box.top - tolerance && rect.bottom <= box.bottom + tolerance
      const insideRoundedBox = (x: number, y: number) => {
        if (x < paintBox.left - tolerance || x > paintBox.right + tolerance ||
            y < paintBox.top - tolerance || y > paintBox.bottom + tolerance) return false
        if (!innerRadius) return true
        const cx = x < paintBox.left + innerRadius ? paintBox.left + innerRadius
          : x > paintBox.right - innerRadius ? paintBox.right - innerRadius : x
        const cy = y < paintBox.top + innerRadius ? paintBox.top + innerRadius
          : y > paintBox.bottom - innerRadius ? paintBox.bottom - innerRadius : y
        return Math.hypot(x - cx, y - cy) <= innerRadius + tolerance
      }
      const paintedInside = (rect: Rect) =>
        insideRoundedBox(rect.left, rect.top) && insideRoundedBox(rect.right, rect.top) &&
        insideRoundedBox(rect.left, rect.bottom) && insideRoundedBox(rect.right, rect.bottom)

      const painted: { name: string; rect: Rect }[] = []
      for (const child of element.querySelectorAll<HTMLElement>(':scope > a-button-label, :scope > a-icon')) {
        const childStyle = getComputedStyle(child)
        if (childStyle.display === 'none' || childStyle.visibility === 'hidden') continue
        const box = child.getBoundingClientRect()
        const name = child.localName === 'a-icon' ? 'icon' : 'label'
        if (!within(box, contentBox)) failures.push(`${name} crosses the content bounds`)

        let ink: Rect = box
        if (name === 'label' && child.textContent) {
          const context = document.createElement('canvas').getContext('2d')!
          context.font = `${childStyle.fontStyle} ${childStyle.fontWeight} ${childStyle.fontSize} ${childStyle.fontFamily}`
          const metrics = context.measureText(child.textContent)
          const baseline = box.top
            + (px(childStyle.lineHeight) - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
            + metrics.fontBoundingBoxAscent
          ink = {
            left: box.left - metrics.actualBoundingBoxLeft,
            right: box.left + metrics.actualBoundingBoxRight,
            top: baseline - metrics.actualBoundingBoxAscent,
            bottom: baseline + metrics.actualBoundingBoxDescent,
          }
        }
        if (!paintedInside(ink)) failures.push(`${name} crosses the border or selected ring`)
        painted.push({ name, rect: ink })
      }

      for (let i = 0; i < painted.length; i++) {
        for (let j = i + 1; j < painted.length; j++) {
          const a = painted[i], b = painted[j]
          if (Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > tolerance &&
              Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > tolerance)
            failures.push(`${a.name} overlaps ${b.name}`)
        }
      }

      if (props.underline && !props.underlineOnHover && ['tertiary', 'quaternary'].includes(String(props.priority))) {
        const labelStyle = getComputedStyle(label)
        const context = document.createElement('canvas').getContext('2d')!
        context.font = `${labelStyle.fontStyle} ${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`
        const metrics = context.measureText(label.textContent ?? '')
        const box = label.getBoundingClientRect()
        const baseline = box.top
          + (px(labelStyle.lineHeight) - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
          + metrics.fontBoundingBoxAscent
        const underlineTop = baseline + px(style.textUnderlineOffset)
        const underline: Rect = {
          left: box.left,
          right: box.right,
          top: underlineTop,
          bottom: underlineTop + px(style.textDecorationThickness),
        }
        if (!paintedInside(underline)) failures.push('underline crosses the border or selected ring')
      }

      return failures.join('; ') || undefined
    }, props)
    : undefined,
}

export default {
  source: (props: Record<string, unknown>) => `import { Button } from '@antadesign/anta'

const props = ${JSON.stringify(props, null, 2)}

export default function App() {
  return <Button {...props} id="harness-target" />
}
`,
  fixture: { label: 'Button fixture' },
  axes: {
    href: [undefined, '#button-fixture'],
    priority: [undefined, 'primary', 'secondary', 'tertiary', 'quaternary'],
    underline: [undefined, 'solid', 'dashed', 'dotted'],
    underlineOnHover: [false, true],
    tone: [undefined, 'neutral', 'brand', 'info', 'success', 'warning', 'critical'],
    size: ['small', 'medium', 'large'],
    round: [false, true],
    paddingless: [false, true],
    loading: [false, true],
    disabled: [false, true],
    selected: [false, true],
  },
  actions: [click],
  properties: [clickability, layoutDoesntCollide],
}
