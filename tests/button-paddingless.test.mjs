import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')

test('selected paddingless buttons keep their size and use an underline instead of an inset ring', async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  try {
    const page = await browser.newPage()
    await page.setContent(`
      <a-button id="plain" priority="quaternary" paddingless round><a-button-label>Button fixture</a-button-label></a-button>
      <a-button id="flat" priority="quaternary" paddingless underline="solid"><a-button-label>Button fixture</a-button-label></a-button>
      <a-button id="dotted" priority="quaternary" paddingless round underline="dotted"><a-button-label>Button fixture</a-button-label></a-button>
      <a-button id="hover" priority="quaternary" paddingless round underline="solid" underline-on-hover><a-button-label>Button fixture</a-button-label></a-button>
      <a role="button" data-anta href="#fixture" id="link" priority="quaternary" paddingless round><a-button-label>Button fixture</a-button-label></a>
      <a-button id="padded" priority="quaternary" round><a-button-label>Button fixture</a-button-label></a-button>
    `)
    await page.addStyleTag({ path: resolve('src/tokens.css') })
    await page.addStyleTag({ path: resolve('src/elements/a-button.css') })

    for (const id of ['plain', 'flat', 'dotted', 'hover', 'link', 'padded']) {
      const button = page.locator(`#${id}`)
      const before = await button.boundingBox()
      await button.evaluate(element => element.setAttribute('selected', ''))
      const after = await button.boundingBox()
      const style = await button.evaluate(element => {
        const computed = getComputedStyle(element)
        return {
          boxShadow: computed.boxShadow,
          color: computed.color,
          decorationLine: computed.textDecorationLine,
          decorationColor: computed.textDecorationColor,
          decorationStyle: computed.textDecorationStyle,
        }
      })

      assert.equal(after.width, before.width, `${id} width changed`)
      assert.equal(after.height, before.height, `${id} height changed`)
      if (id === 'padded') {
        assert.match(style.boxShadow, /inset/)
      } else {
        assert.equal(style.boxShadow, 'none', `${id} retained the inset ring`)
        assert.equal(style.decorationLine, 'underline', `${id} lost its selection mark`)
        assert.equal(style.decorationColor, style.color, `${id} selection mark is hidden`)
      }
      if (id === 'dotted') assert.equal(style.decorationStyle, 'dotted')
    }
  } finally {
    await browser.close()
  }
})
