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

async function fits(page, id = 'growing') {
  await page.waitForFunction(id => {
    const ta = document.getElementById(id).shadowRoot.querySelector('textarea')
    return ta.clientHeight > 0 && Math.abs(ta.scrollHeight - ta.clientHeight) <= 1
  }, id)
}

async function height(page, id = 'growing') {
  return page.locator(`#${id} textarea`).evaluate(ta => ta.clientHeight)
}

for (const engine of [chromium, webkit]) {
  for (const hidden of ['details', 'display', 'content-visibility']) {
    test(`${engine.name()}: multiline Input grows after ${hidden} reveal and width changes`, async t => {
      const container = hidden === 'details' ? 'details' : 'div'
      const hiddenStyle = hidden === 'display' ? 'display:none;' : hidden === 'content-visibility' ? 'content-visibility:hidden;' : ''
      const value = 'A long sentence that wraps across several lines when the available width is narrow. '.repeat(4)
      const { page, errors } = await fixture(t, engine, `
        <${container} id="container" style="${hiddenStyle}width:420px">
          ${hidden === 'details' ? '<summary>Fields</summary>' : ''}
          <div style="display:grid;grid-template-columns:minmax(0,1fr)">
            <div style="display:grid;grid-template-columns:subgrid;grid-column:1/-1">
              <a-input id="growing" multiline value="${value}"></a-input>
              <a-input multiline value="A second eagerly initialized textarea"></a-input>
            </div>
          </div>
        </${container}>
      `)
      // Safari's metadata probes and playground code both read layout while folded.
      await page.evaluate(() => {
        for (const host of document.querySelectorAll('a-input')) {
          for (const node of [host, ...host.shadowRoot.querySelectorAll('*')]) {
            node.getBoundingClientRect()
            void node.clientWidth
          }
        }
      })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert.equal(await page.locator('#growing textarea').evaluate(ta => ta.style.height), '')
      await page.locator('#container').evaluate(el => {
        if (el instanceof HTMLDetailsElement) el.open = true
        el.style.display = 'block'
        el.style.contentVisibility = 'visible'
      })
      await fits(page)
      const wide = await height(page)
      await page.locator('#container').evaluate(el => el.style.width = '150px')
      await page.waitForFunction(wide => document.querySelector('#growing').shadowRoot.querySelector('textarea').clientHeight > wide, wide)
      await fits(page)
      const narrow = await height(page)
      await page.locator('#growing textarea').fill('Short')
      await fits(page)
      assert.ok(await height(page) < narrow)
      await page.locator('#growing').evaluate(el => el.value = 'First\nSecond\nThird\nFourth')
      await fits(page)
      assert.ok(await height(page) > 60)
      // Updates made while folded must be measured again on reveal.
      await page.locator('#container').evaluate(el => {
        if (el instanceof HTMLDetailsElement) el.open = false
        else el.style.display = 'none'
      })
      await page.locator('#growing').evaluate(el => el.value = 'Restored')
      await page.locator('#container').evaluate(el => {
        if (el instanceof HTMLDetailsElement) el.open = true
        else el.style.display = 'block'
      })
      await page.waitForFunction(() => document.querySelector('#growing').shadowRoot.querySelector('textarea').clientHeight < 40)
      await fits(page)
      assert.ok(await height(page) < 40)
      await page.locator('#growing').evaluate(el => {
        el.remove()
        el.value = 'Reconnected\nWith\nFour\nLines'
        document.getElementById('container').append(el)
      })
      await fits(page)
      assert.ok(await height(page) > 60)
      assert.deepEqual(errors, [])
    })
  }

  test(`${engine.name()}: multiline Input resizes through nested disclosures and a shadow ancestor`, async t => {
    const { page, errors } = await fixture(t, engine, '<details id="outer"><summary>Outer</summary><div id="shadow-host"></div></details>')
    await page.evaluate(() => {
      const shadow = document.getElementById('shadow-host').attachShadow({ mode: 'open' })
      shadow.innerHTML = '<details id="inner" open><summary>Inner</summary><a-input id="growing" multiline value="One&#10;Two&#10;Three"></a-input></details>'
    })
    const growing = page.locator('#growing')
    const textarea = growing.locator('textarea')
    await page.locator('#outer').evaluate(el => el.open = true)
    await page.waitForFunction(() => document.getElementById('shadow-host').shadowRoot.getElementById('growing').shadowRoot.querySelector('textarea').clientHeight > 60)
    await page.locator('#inner').evaluate(el => el.open = false)
    await growing.evaluate(el => el.value = 'Short')
    await page.locator('#inner').evaluate(el => el.open = true)
    await page.waitForFunction(() => document.getElementById('shadow-host').shadowRoot.getElementById('growing').shadowRoot.querySelector('textarea').clientHeight < 40)
    await textarea.fill('One\nTwo\nThree\nFour')
    assert.ok(await textarea.evaluate(el => el.clientHeight > 60))
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: multiline Input honors row limits, row changes, and size changes`, async t => {
    const { page, errors } = await fixture(t, engine, '<a-input id="growing" multiline maxrows="3" style="width:240px"></a-input>')
    const textarea = page.locator('#growing textarea')
    await textarea.fill('One\nTwo\nThree\nFour\nFive\nSix')
    const capped = await height(page)
    assert.ok(capped >= 60 && capped < 80)
    assert.ok(await textarea.evaluate(ta => ta.scrollHeight > ta.clientHeight))
    await page.locator('#growing').evaluate(el => el.setAttribute('rows', '2'))
    assert.ok(await height(page) < capped)
    assert.equal(await textarea.evaluate(ta => ta.style.height), '')
    await textarea.fill('Short')
    const fixed = await height(page)
    await textarea.fill('One\nTwo\nThree\nFour')
    assert.equal(await height(page), fixed)
    await page.locator('#growing').evaluate(el => {
      el.removeAttribute('rows')
      el.removeAttribute('maxrows')
    })
    await fits(page)
    const medium = await height(page)
    await page.locator('#growing').evaluate(el => el.setAttribute('size', 'large'))
    await fits(page)
    assert.ok(await height(page) > medium)
    await textarea.fill('')
    await page.locator('#growing').evaluate(el => el.setAttribute('placeholder', 'A placeholder\nWith three\nLines'))
    await fits(page)
    assert.ok(await height(page) > 60)
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
