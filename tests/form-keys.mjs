import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { componentTest as test } from './component-tier.mjs'
import { engines, startForm, stopForm, formPage, input, submit } from './form-harness.mjs'

before(startForm)
after(stopForm)

const keys = 'submit-hotkey="enter"'
const chord = 'submit-hotkey="mod+enter"'
const allKeys = 'submit-hotkey="enter mod+enter"'
const notes = (name = 'notes') => `<a-input name="${name}" multiline><span slot="label">Notes</span></a-input>`

async function fixture(t, engine, html) {
  const { page, errors } = await formPage(t, engine, html)
  // One record per event, in order: [type, target id or name, submitter id].
  // Anta's Button acts on a click in the capture phase, so its submit is
  // recorded before its click. A native button's click comes first.
  await page.evaluate(() => {
    window.log = []
    const name = el => el?.id || el?.getAttribute?.('name') || el?.localName || null
    window.watch = root => {
      for (const type of ['submit', 'submitdetailed', 'click', 'invalid']) {
        root.addEventListener(type, event => {
          if (type === 'submit') event.preventDefault()
          if (type === 'click' && !event.target.closest?.('a-button, button')) return
          window.log.push([type, name(event.target), type === 'submit' ? name(event.submitter) : null].join(':'))
        }, true)
      }
    }
    window.watch(document)
  })
  return { page, errors }
}

/** The text control inside an Input, or the element itself. */
const control = (page, selector) => page.locator(selector).first()

/** Focuses the control, proves it has focus, then sends real keys. A key sent
 *  to the wrong element would make every "does nothing" check pass. */
async function press(page, selector, ...chords) {
  const target = control(page, selector)
  await target.focus()
  assert.ok(await target.evaluate(el => el.getRootNode().activeElement === el && el.ownerDocument.hasFocus()), `${selector} did not take focus`)
  for (const chord of chords) await page.keyboard.press(chord)
  assert.ok(await target.evaluate(el => el.getRootNode().activeElement === el), `${selector} lost focus`)
}

const log = page => page.evaluate(() => window.log.splice(0))
const count = (entries, prefix) => entries.filter(entry => entry.startsWith(prefix)).length
const field = name => `a-input[name="${name}"] :is(input, textarea)`

for (const engine of engines) {
  test(`${engine.name()}: an a-form that is moved in the document still submits once per Enter`, async t => {
    const { page, errors } = await fixture(t, engine, `<a-form id="host" ${keys}><form id="f">${input('a', 'A')}${submit('save')}</form></a-form><div id="elsewhere"></div>`)
    await press(page, field('a'), 'Enter')
    assert.equal(count(await log(page), 'submit:f'), 1)
    await page.evaluate(() => {
      const host = document.getElementById('host')
      host.remove()
      document.getElementById('elsewhere').append(host)
    })
    await press(page, field('a'), 'Enter')
    assert.equal(count(await log(page), 'submit:f'), 1, 'one listener after the move, not two')
    assert.deepEqual(errors, [])
  })

  test.fast(`${engine.name()}: without submit-hotkey no key submits, in an a-form or a native form`, async t => {
    const { page, errors } = await fixture(t, engine, `
      <a-form id="host"><form id="layout">${input('a', 'A')}${notes('a-notes')}${submit('layout-save', 'priority="primary"')}</form></a-form>
      <form data-anta id="plain" submit-hotkey="enter mod+enter">${input('b', 'B')}<textarea id="native-notes"></textarea>${submit('plain-save', 'priority="primary"')}</form>
    `)
    await press(page, field('a'), 'Enter', 'Control+Enter', 'Meta+Enter')
    await press(page, field('a-notes'), 'Control+Enter', 'Meta+Enter')
    await press(page, field('b'), 'Enter', 'Control+Enter')
    await press(page, '#native-notes', 'Control+Enter', 'Meta+Enter')
    assert.deepEqual(await log(page), [], 'no button was activated and nothing submitted')

    // The same key in the same field submits once the a-form asks for it.
    await page.locator('#host').evaluate(host => host.setAttribute('submit-hotkey', 'enter'))
    await press(page, field('a'), 'Enter')
    assert.deepEqual(await log(page), ['submit:layout:', 'submitdetailed:layout:', 'click:layout-save:'])
    assert.deepEqual(errors, [])
  })

  test.fast(`${engine.name()}: Enter in a single-line Input activates the form's first submit button`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${keys}><form id="inside">${input('one', 'One')}${submit('inside-save')}${submit('inside-second')}</form></a-form>
      <a-form ${keys}><form id="outside">${input('two', 'Two')}</form></a-form>
      ${submit('outside-save', 'form="outside"')}
      <a-form ${keys}><form id="native">${input('three', 'Three')}<button type="button" id="native-other">Other</button><button id="native-save">Save</button></form></a-form>
    `)
    await page.locator(field('one')).fill('kept')
    await press(page, field('one'), 'Enter')
    assert.deepEqual(await log(page), ['submit:inside:', 'submitdetailed:inside:', 'click:inside-save:'])
    assert.equal(await page.locator(field('one')).inputValue(), 'kept', 'the field keeps its text')

    await press(page, field('two'), 'Enter')
    assert.deepEqual(await log(page), ['submit:outside:', 'submitdetailed:outside:', 'click:outside-save:'])

    await press(page, field('three'), 'Enter')
    assert.deepEqual(await log(page), ['click:native-save:', 'submit:native:native-save'], 'a native submit button is the submitter')
  })

  test(`${engine.name()}: Enter leaves an unavailable submit button alone`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${keys}><form id="disabled">${input('one', 'One')}${submit('disabled-save', 'disabled')}${submit('disabled-second')}</form></a-form>
      <a-form ${keys}><form id="loading">${input('two', 'Two')}${submit('loading-save', 'loading')}</form></a-form>
      <a-form ${keys}><form id="fieldset">${input('three', 'Three')}<fieldset disabled>${submit('fieldset-save')}</fieldset></form></a-form>
      <a-form ${keys}><form id="legend">${input('five', 'Five')}<fieldset disabled><legend><button type="submit" id="legend-save">Save</button></legend></fieldset></form></a-form>
      <a-form ${keys}><form id="invalid">${input('four', 'Four', { attrs: 'required' })}${submit('invalid-save')}</form></a-form>
    `)
    await press(page, field('one'), 'Enter')
    await press(page, field('two'), 'Enter')
    await press(page, field('three'), 'Enter')
    assert.deepEqual(await log(page), [], 'no click and no fallback to a later button')

    // A native button in the first legend of a disabled fieldset stays enabled.
    await press(page, field('five'), 'Enter')
    assert.deepEqual(await log(page), ['click:legend-save:', 'submit:legend:legend-save'])

    // An invalid form: the button is activated, the browser refuses to submit.
    await press(page, field('four'), 'Enter')
    const refused = await log(page)
    assert.equal(count(refused, 'click:invalid-save'), 1, 'the button was activated')
    assert.equal(count(refused, 'invalid:four'), 1, 'the browser reported the empty field')
    assert.equal(count(refused, 'submit:'), 0, 'nothing submitted')
    await page.locator(field('four')).fill('now valid')
    await press(page, field('four'), 'Enter')
    assert.equal(count(await log(page), 'submit:invalid'), 1)
  })

  test(`${engine.name()}: with no submit button, Enter submits a form with one text field`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${keys}><form id="single">${input('only', 'Only')}<a-checkbox name="agree">Agree</a-checkbox></form></a-form>
      <a-form ${keys}><form id="double">${input('first', 'First')}${input('second', 'Second')}</form></a-form>
    `)
    await press(page, field('first'), 'Enter')
    assert.deepEqual(await log(page), [])
    await press(page, field('only'), 'Enter')
    assert.deepEqual(await log(page), ['submit:single:'])
  })

  test.fast(`${engine.name()}: Ctrl+Enter and Cmd+Enter activate the primary submit Button and nothing else`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${allKeys}><form id="post">${input('title', 'Title')}${notes('body')}<textarea id="native-body"></textarea>
        ${submit('draft')}${submit('publish', 'priority="primary"')}</form></a-form>
      <a-form ${allKeys}><form id="secondary">${notes('secondary-notes')}${submit('secondary-save')}</form></a-form>
      <a-form ${allKeys}><form id="off">${notes('off-notes')}${submit('off-draft')}${submit('off-publish', 'priority="primary" disabled')}</form></a-form>
      <a-form ${keys}><form id="enter-only">${notes('enter-notes')}${submit('enter-save', 'priority="primary"')}</form></a-form>
      <a-form ${chord}><form id="chord-only">${input('chord-name', 'Name')}${submit('chord-save', 'priority="primary"')}</form></a-form>
    `)
    await press(page, field('body'), 'Enter')
    assert.deepEqual(await log(page), [], 'Enter in a multiline Input does not submit')
    assert.equal(await page.locator(field('body')).inputValue(), '\n', 'it adds a line')

    await press(page, field('body'), 'Control+Enter')
    assert.deepEqual(await log(page), ['submit:post:', 'submitdetailed:post:', 'click:publish:'], 'the primary Button, not the first')
    await press(page, field('body'), 'Meta+Enter')
    assert.equal(count(await log(page), 'click:publish'), 1)
    await press(page, field('title'), 'Control+Enter')
    assert.equal(count(await log(page), 'click:publish'), 1, 'from a single-line Input')
    await press(page, '#native-body', 'Control+Enter')
    assert.equal(count(await log(page), 'click:publish'), 1, 'from a native field in the form')

    await press(page, field('secondary-notes'), 'Control+Enter', 'Meta+Enter')
    assert.deepEqual(await log(page), [], 'a form without a primary submit Button ignores the chord')
    await press(page, field('off-notes'), 'Control+Enter')
    assert.deepEqual(await log(page), [], 'a disabled primary Button is not replaced by another')
    await press(page, field('enter-notes'), 'Control+Enter', 'Meta+Enter')
    assert.deepEqual(await log(page), [], 'a form that asked for Enter only ignores the chord')
    await press(page, field('chord-name'), 'Enter')
    assert.deepEqual(await log(page), [], 'a form that asked for the chord only ignores Enter')
    await press(page, field('chord-name'), 'Control+Enter')
    assert.deepEqual(await log(page), ['submit:chord-only:', 'submitdetailed:chord-only:', 'click:chord-save:'])
  })

  test(`${engine.name()}: an application's own Enter handler decides by cancelling the key`, async t => {
    const { page } = await fixture(t, engine, `
      <form id="legacy">${input('legacy-tag', 'Tag')}${submit('legacy-save')}</form>
      <a-form ${keys}><form id="keeps">${input('keeps-tag', 'Tag')}${submit('keeps-save')}</form></a-form>
      <a-form ${keys}><form id="cancels">${input('cancels-tag', 'Tag')}${submit('cancels-save')}</form></a-form>
    `)
    await page.evaluate(() => {
      window.tags = []
      for (const el of document.querySelectorAll('a-input')) {
        el.addEventListener('keydown', event => {
          if (event.key !== 'Enter') return
          window.tags.push(el.getAttribute('name'))
          if (el.getAttribute('name') === 'cancels-tag') event.preventDefault()
        })
      }
    })
    await press(page, field('legacy-tag'), 'Enter')
    assert.deepEqual(await log(page), [], 'a form that never opted in adds its tag and does not submit')
    await press(page, field('cancels-tag'), 'Enter')
    assert.deepEqual(await log(page), [], 'a cancelled key is left alone')
    await press(page, field('keeps-tag'), 'Enter')
    assert.equal(count(await log(page), 'submit:keeps'), 1, 'an uncancelled key in an opted-in form submits')
    assert.deepEqual(await page.evaluate(() => window.tags), ['legacy-tag', 'cancels-tag', 'keeps-tag'], 'each handler ran once')
  })

  test(`${engine.name()}: each form keeps its own submit button, and a form in a shadow root uses its native submit button`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${keys}><form id="b">${input('b-name', 'B')}${submit('b-save')}</form></a-form>
      ${submit('a-save', 'form="a"')}
      <a-form ${keys}><form id="a">${input('a-name', 'A')}</form></a-form>
      <a-form ${keys}><form id="outer">${input('outer-name', 'Outer')}<div id="opted"></div><div id="silent"></div>${submit('outer-save')}</form></a-form>
    `)
    await press(page, field('a-name'), 'Enter')
    assert.deepEqual(await log(page), ['submit:a:', 'submitdetailed:a:', 'click:a-save:'])
    await press(page, field('b-name'), 'Enter')
    assert.deepEqual(await log(page), ['submit:b:', 'submitdetailed:b:', 'click:b-save:'])

    // A form in an application's shadow root, with its host inside another form.
    await page.evaluate(() => {
      for (const [id, keys] of [['opted', 'enter'], ['silent', '']]) {
        const root = document.getElementById(id).attachShadow({ mode: 'open' })
        // Built with the DOM: the parser drops a form tag in markup parsed
        // under a host that is inside another form. A native button, because
        // Anta's Button does not act on a click inside an application's
        // shadow root.
        const form = document.createElement('form')
        form.id = `${id}-form`
        form.innerHTML = `<a-input name="${id}-name"></a-input><button id="${id}-save">Save</button>`
        const host = document.createElement('a-form')
        if (keys) host.setAttribute('submit-hotkey', keys)
        host.append(form)
        root.append(host)
        window.watch(root)
      }
    })
    await page.waitForFunction(() => document.getElementById('opted').shadowRoot.querySelector('a-input').shadowRoot)
    await press(page, field('opted-name'), 'Enter')
    const inner = await log(page)
    assert.deepEqual(inner, ['click:opted-save:', 'submit:opted-form:opted-save'], 'the form in the shadow root submits')
    await press(page, field('silent-name'), 'Enter')
    assert.deepEqual(await log(page), [], 'a shadow form without a hotkey does not borrow the outer form')
    await press(page, field('outer-name'), 'Enter')
    assert.deepEqual(await log(page), ['submit:outer:', 'submitdetailed:outer:', 'click:outer-save:'], 'the outer form still has its own')
  })

  test(`${engine.name()}: a composing key, a slotted button, and a button-mode Input do not submit`, async t => {
    const { page } = await fixture(t, engine, `
      <a-form ${allKeys}><form id="form">
        <a-input name="text"><span slot="label">Text</span><button type="button" slot="trailing" id="reveal">Show</button></a-input>
        <a-input name="trigger" button><span slot="label">Trigger</span></a-input>
        ${submit('save', 'priority="primary"')}
      </form></a-form>
    `)
    const send = init => page.locator(field('text')).evaluate((el, init) => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }, init)
    // Browsers that report the key confirming a candidate only as code 229.
    await send({ keyCode: 229 })
    await send({ isComposing: true })
    assert.equal(await send({ keyCode: 229, ctrlKey: true }), false, 'the chord is not cancelled either')
    assert.deepEqual(await log(page), [], 'a composing key is left to the input method')
    await send({ keyCode: 13 })
    assert.equal(count(await log(page), 'submit:form'), 1, 'the same dispatch without composition submits')

    await press(page, '#reveal', 'Enter')
    assert.deepEqual(await log(page), ['click:reveal:'], 'a button inside the Input keeps Enter')
    await press(page, 'a-input[name="trigger"]', 'Enter')
    assert.deepEqual(await log(page), [], 'a button-mode Input keeps Enter')
  })

  test.fast(`${engine.name()}: Form submits on no key by default, and submitHotkey picks Enter or the chord`, async t => {
    const { page, errors } = await fixture(t, engine, '')
    const name = '#jsx a-input >> nth=0 >> input'
    const body = '#jsx a-input >> nth=1 >> textarea'
    const submits = () => page.evaluate(() => window.formLog.splice(0).length)
    const render = async props => {
      await page.evaluate(props => window.renderForm(props), props)
      await page.waitForFunction(() => [...document.querySelectorAll('#jsx a-input')].every(el => el.shadowRoot))
    }
    await render({})
    assert.equal(await page.locator('a-form > form#jsx').count(), 1, 'Form renders a-form around a native form')
    await press(page, name, 'Enter', 'Control+Enter', 'Meta+Enter')
    await press(page, body, 'Control+Enter', 'Meta+Enter')
    assert.equal(await submits(), 0, 'no key submits without submitHotkey')

    await render({ submitHotkey: 'enter' })
    await press(page, name, 'Enter')
    assert.equal(await submits(), 1, 'Enter in a single-line Input')
    await press(page, body, 'Control+Enter', 'Meta+Enter')
    assert.equal(await submits(), 0, 'no chord when the hotkey is Enter')

    await render({ submitHotkey: 'mod+enter' })
    await press(page, name, 'Enter')
    assert.equal(await submits(), 0, 'no Enter when the hotkey is the chord')
    await press(page, body, 'Control+Enter')
    await press(page, name, 'Meta+Enter')
    assert.equal(await submits(), 2, 'the chord from either field')

    await render({ submitHotkey: 'mod+enter', primary: false })
    await press(page, body, 'Control+Enter')
    assert.equal(await submits(), 0, 'no primary Button, no chord')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: onChange on Form hears a change in any field`, async t => {
    const { page, errors } = await fixture(t, engine, '')
    await page.evaluate(() => window.renderForm({}))
    await page.waitForFunction(() => [...document.querySelectorAll('#jsx a-input')].every(el => el.shadowRoot))
    await page.locator('#jsx a-input >> nth=0 >> input').fill('ci-runner')
    await page.keyboard.press('Tab')
    await page.locator('#jsx a-checkbox').click()
    assert.deepEqual(await page.evaluate(() => window.changeLog), ['name', 'remind'], 'one handler on the form, a text field and a checkbox')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: Enter selects a suggestion, commits a date, or submits free text according to the focused control`, async t => {
    const { page, errors } = await fixture(t, engine, '')
    await page.evaluate(() => window.renderControls())
    await page.waitForFunction(() => document.querySelectorAll('#controls > a-input').length === 3 && [...document.querySelectorAll('#controls a-input')].every(el => el.shadowRoot))
    const submits = () => page.evaluate(() => window.formLog.length)
    /** Where focus is: inside a menu, and which control. */
    const focus = () => page.evaluate(() => {
      let active = document.activeElement
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
      const host = active?.getRootNode().host
      return { tag: host?.localName ?? active?.localName, inMenu: !!host?.closest('a-menu'), value: active?.value ?? null }
    })
    const select = page.locator('#controls > a-input[button]')
    const auto = page.locator('#controls > a-input[data-menu-search] input')
    const date = page.locator('#controls > a-input[inputmode] input')

    // Select: its filter field is an Input inside the menu.
    await select.click()
    assert.deepEqual(await focus(), { tag: 'a-input', inMenu: true, value: '' }, 'the open Select has focus in its filter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(await select.evaluate(el => el.value), 'alpha', 'Enter picked the option')
    await page.keyboard.press('Escape')
    await select.click()
    await page.keyboard.type('zzz')
    assert.deepEqual(await focus(), { tag: 'a-input', inMenu: true, value: 'zzz' }, 'a filter with no match has focus')
    await page.keyboard.press('Enter')
    assert.equal(await submits(), 0, 'a Select never submits on Enter')
    await page.keyboard.press('Escape')

    // InputAutocomplete: Enter takes a suggestion; without one it is a text field.
    await auto.click()
    await page.keyboard.type('Re')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.deepEqual(await focus(), { tag: 'a-input', inMenu: false, value: 'React' }, 'Enter took the suggestion')
    assert.equal(await submits(), 0, 'taking a suggestion does not submit')
    await page.keyboard.press('Enter')
    assert.equal(await submits(), 1, 'Enter with no suggestion active submits, as in a text field')

    // InputDate: Enter commits the typed date.
    await date.click()
    await page.keyboard.type('2026-11-18')
    await page.keyboard.press('Enter')
    assert.deepEqual(await focus(), { tag: 'a-input', inMenu: false, value: '11/18/2026' }, 'Enter committed the date')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')

    // InputTime: its segments are not an Input.
    await page.locator('#controls a-input-time').click()
    assert.equal((await focus()).tag, 'a-input-time')
    await page.keyboard.press('Enter')
    assert.equal(await submits(), 1, 'InputDate and InputTime do not submit on Enter')
    assert.deepEqual(errors, [])
  })
}
