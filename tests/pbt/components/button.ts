import type { Locator, Page } from 'playwright'
import { axis } from '../axes'

type PropertyInput = {
  control: Locator
  props: Record<string, unknown>
  action: string
}

type TestButton = HTMLElement & {
  __clicked?: boolean
}

const sizes = {
  small: { fontSize: '13px', minHeight: '24px' },
  medium: { fontSize: '15px', minHeight: '28px' },
  large: { fontSize: '17px', minHeight: '32px' },
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

const propsMatch = {
  name: 'propsMatch',
  run: ({ control, props, action }: PropertyInput) => {
    if (action !== 'render') return
    const unavailable = Boolean(props.disabled || props.loading)
    const link = Boolean(props.href)
    const expectedStyle: Record<string, string> = {
      ...sizes[props.size as keyof typeof sizes],
      borderTopLeftRadius: props.round ? '999px' : '4px',
    }
    if (props.underline && ['tertiary', 'quaternary'].includes(String(props.priority)))
      expectedStyle.textDecorationStyle = String(props.underline)
    if (props.paddingless && props.priority === 'quaternary') {
      expectedStyle.minHeight = '0px'
      expectedStyle.paddingLeft = '0px'
      expectedStyle.paddingRight = '0px'
      expectedStyle.paddingTop = '0px'
      expectedStyle.paddingBottom = '0px'
    }

    return control.evaluate((element, expected) => {
      const failures: string[] = []
      const check = (name: string, actual: unknown, wanted: unknown) => {
        if (actual !== wanted) failures.push(`${name}=${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`)
      }

      check('href', element.getAttribute('href'), expected.href)

      const style = getComputedStyle(element)
      for (const [name, wanted] of Object.entries(expected.style))
        check(name, name.startsWith('--') ? style.getPropertyValue(name).trim() : (style as any)[name], wanted)
      if (expected.loading)
        check('::before.animationName', getComputedStyle(element, '::before').animationName, 'btn-loading-slide')

      return failures.join('; ') || undefined
    }, {
      href: link && !unavailable ? String(props.href) : null,
      style: expectedStyle,
      loading: Boolean(props.loading),
    })
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

    const button = element.getBoundingClientRect()
    const content = label.getBoundingClientRect()
    const style = getComputedStyle(element)
    const labelStyle = getComputedStyle(label)
    const px = (value: string) => Number.parseFloat(value) || 0
    const failures: string[] = []
    const tolerance = 0.5
    const left = button.left + px(style.borderLeftWidth) + px(style.paddingLeft)
    const right = button.right - px(style.borderRightWidth) - px(style.paddingRight)
    const top = button.top + px(style.borderTopWidth) + px(style.paddingTop)
    const bottom = button.bottom - px(style.borderBottomWidth) - px(style.paddingBottom)

    if (content.left < left - tolerance) failures.push('label crosses the left chrome')
    if (content.right > right + tolerance) failures.push('label crosses the right chrome')
    if (content.top < top - tolerance) failures.push('label crosses the top chrome')
    if (content.bottom > bottom + tolerance) failures.push('label crosses the bottom chrome')

    const shadowLengths = style.boxShadow.match(/-?\d*\.?\d+px/g)?.map(px) ?? []
    const selectedRing = style.boxShadow.includes('inset') ? shadowLengths[3] ?? 0 : 0
    if (props.selected && selectedRing <= 0) failures.push('selected ring is missing')

    if (props.underline && !props.underlineOnHover && ['tertiary', 'quaternary'].includes(String(props.priority))) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      context.font = `${labelStyle.fontStyle} ${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`
      const metrics = context.measureText(label.textContent ?? '')
      const lineHeight = px(labelStyle.lineHeight)
      const baseline = content.top
        + (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
        + metrics.fontBoundingBoxAscent
      const underlineBottom = baseline + px(style.textUnderlineOffset) + px(style.textDecorationThickness)
      const innerBottom = button.bottom - Math.max(px(style.borderBottomWidth), selectedRing)
      if (underlineBottom > innerBottom + tolerance) failures.push('underline crosses the bottom chrome')
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
  axes: [
    axis('href', [undefined, '#button-fixture']),
    axis('priority', [undefined, 'primary', 'secondary', 'tertiary', 'quaternary']),
    axis('underline', [undefined, 'solid', 'dashed', 'dotted']),
    axis('underlineOnHover', [false, true]),
    axis('tone', [undefined, 'neutral', 'brand', 'info', 'success', 'warning', 'critical']),
    axis('size', ['small', 'medium', 'large']),
    axis('round', [false, true]),
    axis('paddingless', [false, true]),
    axis('loading', [false, true]),
    axis('disabled', [false, true]),
    axis('selected', [false, true]),
  ],
  actions: [click],
  properties: [propsMatch, clickability, layoutDoesntCollide],
}
