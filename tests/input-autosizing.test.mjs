import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, webkit } = requireSite('playwright')
const browsers = new Map()
let script, css

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import './src/elements/a-input'
        import './src/elements/a-input-time'
        import './src/tokens.css'
        import './src/theme-antune.css'
      `,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, outfile: 'input-autosizing.js', format: 'iife', target: 'es2022',
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  for (const engine of [chromium, webkit]) {
    browsers.set(engine, await engine.launch({
      headless: true,
      ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
    }))
  }
})

after(async () => Promise.all([...browsers.values()].map(browser => browser.close())))

async function fixture(t, engine, html) {
  const page = await browsers.get(engine).newPage()
  t.after(() => page.close())
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent(html)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  return { page, errors }
}

for (const engine of [chromium, webkit]) {
  test(`${engine.name()}: multiline Input follows typography changes at the same width`, async t => {
    const { page, errors } = await fixture(t, engine,
      '<a-input id="growing" multiline style="width:240px" value="One&#10;Two&#10;Three&#10;Four&#10;Five&#10;Six"></a-input>')
    const textarea = page.locator('#growing textarea')
    const initial = await textarea.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
    await textarea.evaluate(el => el.style.lineHeight = '40px')
    await page.waitForFunction(height => {
      const ta = document.getElementById('growing').shadowRoot.querySelector('textarea')
      return ta.clientHeight > height && Math.abs(ta.scrollHeight - ta.clientHeight) <= 1
    }, initial.height)
    assert.equal(await textarea.evaluate(el => el.clientWidth), initial.width)
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: controlled multiline Input updates preserve page scroll position`, async t => {
    const { page, errors } = await fixture(t, engine,
      '<div style="height:1000px"></div><a-input id="growing" multiline style="width:240px"></a-input>')
    await page.locator('#growing').evaluate(el => el.value = 'A line\n'.repeat(60))
    const initialScroll = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
      return window.scrollY
    })
    assert.ok(initialScroll > 1000)
    await page.locator('#growing').evaluate(el => {
      el.value = el.value
      el.setAttribute('name', 'message')
    })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
    assert.equal(await page.evaluate(() => window.scrollY), initialScroll)
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: InputTime fits locale periods and keeps width when switching AM/PM`, async t => {
    const { page, errors } = await fixture(t, engine, '<details id="container"><summary>Time</summary></details>')
    const periods = await page.evaluate(() => {
      const locales = ['en-US', 'ja-JP', 'zh-CN', 'ko-KR', 'ar-EG', 'es-MX']
      return locales.map(locale => {
        const host = document.createElement('a-input-time')
        host.setAttribute('locale', locale)
        host.setAttribute('hour12', 'true')
        host.value = '01:05'
        document.getElementById('container').append(host)
        return { locale, am: host.shadowRoot.querySelector('.seg--period').value }
      })
    })
    await page.locator('#container').evaluate(el => el.open = true)
    const widths = await page.locator('a-input-time').evaluateAll(hosts => hosts.map(host => {
      const period = host.shadowRoot.querySelector('.seg--period')
      const style = getComputedStyle(period)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      context.font = style.font
      const textWidth = context.measureText(period.value).width
      return { width: period.clientWidth, textWidth, value: period.value }
    }))
    for (const [i, period] of widths.entries()) {
      assert.ok(period.width >= period.textWidth, `${periods[i].locale}: AM fits`)
    }
    await page.locator('a-input-time').evaluateAll(hosts => hosts.forEach(host => host.value = '13:05'))
    const pmWidths = await page.locator('.seg--period').evaluateAll(periods => periods.map(period => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      context.font = getComputedStyle(period).font
      return { width: period.clientWidth, textWidth: context.measureText(period.value).width }
    }))
    for (const [i, period] of pmWidths.entries()) {
      assert.equal(period.width, widths[i].width, `${periods[i].locale}: stable width`)
      assert.ok(period.width >= period.textWidth, `${periods[i].locale}: PM fits`)
    }
    const englishPeriod = page.locator('a-input-time[locale="en-US"] .seg--period')
    await englishPeriod.focus()
    await englishPeriod.press('ArrowUp')
    assert.equal(await page.locator('a-input-time[locale="en-US"]').evaluate(el => el.value), '01:05')
    assert.deepEqual(errors, [])
  })
}
