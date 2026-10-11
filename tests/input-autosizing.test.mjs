import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, webkit } = requireSite('playwright')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, webkit]
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
  for (const engine of engines) {
    browsers.set(engine, await engine.launch({
      headless: true,
      ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
    }))
  }
})

after(async () => Promise.all([...browsers.values()].map(browser => browser.close())))

async function fixture(t, engine, html, { userAgent, nativeSupport = true } = {}) {
  const page = await browsers.get(engine).newPage(userAgent ? { userAgent } : {})
  t.after(() => page.close())
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent(html)
  await page.addStyleTag({ content: css })
  if (!nativeSupport) await page.evaluate(() => {
    const supports = CSS.supports.bind(CSS)
    CSS.supports = (...args) => args[0] === 'field-sizing' ? false : supports(...args)
  })
  await page.addScriptTag({ content: script })
  return { page, errors }
}

for (const engine of engines) {
  test(`${engine.name()}: WebKit browser identities use JS even when CSS reports support`, async t => {
    const agents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.2 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 CriOS/143.0.0.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 FxiOS/145.0 Mobile/15E148 Safari/605.1.15',
    ]
    for (const userAgent of agents) {
      const { page, errors } = await fixture(t, engine,
        '<a-input id="growing" multiline value="One&#10;Two&#10;Three"></a-input>', { userAgent })
      assert.equal(await page.evaluate(() => CSS.supports('field-sizing', 'content')), true)
      const sizing = await page.locator('#growing textarea').evaluate(el => ({
        fieldSizing: el.style.getPropertyValue('field-sizing'), height: el.clientHeight, scroll: el.scrollHeight,
      }))
      assert.equal(sizing.fieldSizing, 'fixed')
      assert.equal(sizing.height, sizing.scroll)
      assert.deepEqual(errors, [])
    }
  })

  test(`${engine.name()}: missing native support falls back and honors rows and maxrows`, async t => {
    const { page, errors } = await fixture(t, engine,
      '<a-input id="growing" multiline style="width:240px"></a-input>', { nativeSupport: false })
    const height = () => page.locator('#growing textarea').evaluate(el => el.clientHeight)
    assert.equal(await height(), 28)
    await page.locator('#growing').evaluate(el => el.value = 'One\nTwo\nThree\nFour\nFive\nSix')
    assert.equal(await height(), 128)
    await page.locator('#growing').evaluate(el => el.value = 'One\nTwo')
    assert.equal(await height(), 48)
    await page.locator('#growing').evaluate(el => { el.setAttribute('maxrows', '3'); el.value = 'Line\n'.repeat(20) })
    assert.equal(await height(), 68)
    await page.locator('#growing').evaluate(el => el.setAttribute('rows', '2'))
    assert.equal(await height(), 48)
    await page.locator('#growing').evaluate(el => el.value = '')
    assert.equal(await height(), 48)
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: JS measurements preserve page and capped textarea scroll while typing`, async t => {
    const { page, errors } = await fixture(t, engine,
      '<div style="height:1000px"></div><a-input id="growing" multiline style="width:240px"></a-input>',
      { nativeSupport: false })
    await page.locator('#growing').evaluate(el => el.value = 'Line\n'.repeat(60))
    const beforePage = await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); return window.scrollY })
    await page.locator('#growing').evaluate(el => el.value += 'x')
    assert.equal(await page.evaluate(() => window.scrollY), beforePage)
    await page.locator('#growing').evaluate(el => el.setAttribute('maxrows', '3'))
    const beforeTyping = await page.locator('#growing textarea').evaluate(el => {
      el.focus()
      el.setSelectionRange(16, 16)
      el.scrollTop = 50
      return { page: window.scrollY, textarea: el.scrollTop }
    })
    await page.locator('#growing textarea').press('x')
    const afterTyping = await page.locator('#growing textarea').evaluate(el => ({ page: window.scrollY, textarea: el.scrollTop }))
    assert.deepEqual(afterTyping, beforeTyping)
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: typography changes resize natively or after a fallback value refresh`, async t => {
    const { page, errors } = await fixture(t, engine,
      '<a-input id="growing" multiline style="width:240px" value="One&#10;Two&#10;Three&#10;Four&#10;Five&#10;Six"></a-input>')
    const textarea = page.locator('#growing textarea')
    assert.equal(await textarea.evaluate(el => el.style.getPropertyValue('field-sizing')),
      engine === chromium ? 'content' : 'fixed')
    const initial = await textarea.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))
    await textarea.evaluate(el => el.style.lineHeight = '40px')
    if (engine === webkit) await page.locator('#growing').evaluate(el => el.value = el.value)
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
