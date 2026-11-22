import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { componentTest as test } from './component-tier.mjs'
import { engines, startForm, stopForm, formPage as fixture, input, frames } from './form-harness.mjs'

before(startForm)
after(stopForm)

/** Boxes of each direct child, relative to its form: the host and, for an
 *  Input, its label, field, and hint parts. */
const measure = (page, selector) => page.locator(selector).evaluate(form => {
  const origin = form.getBoundingClientRect()
  const box = el => {
    const rect = el?.getBoundingClientRect()
    if (!rect || !rect.width) return null
    return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
  }
  return [...form.children].map(el => ({
    tag: el.localName,
    host: box(el),
    label: box(el.shadowRoot?.querySelector('[part~="label"]')),
    field: box(el.shadowRoot?.querySelector('[part~="field"]')),
    hint: box(el.shadowRoot?.querySelector('[part~="hint"]')),
  }))
})

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1, `${message}: ${actual} is not within 1px of ${expected}`)

for (const engine of engines) {
  test.fast(`${engine.name()}: a label sits beside its field when both fit and above it when they do not`, async t => {
    const fields = input('name', 'Name', { hint: 'A hint.' }) + '<a-checkbox role="checkbox" tabindex="0" name="agree"><a-checkbox-label>Agree</a-checkbox-label></a-checkbox>'
    const { page, errors } = await fixture(t, engine, `
      <form data-anta id="wide" style="width:560px">${fields}</form>
      <form data-anta id="narrow" style="width:300px">${fields}</form>
    `)
    const [wide, wideCheckbox] = await measure(page, '#wide')
    near(wide.label.width, 140, 'label column')
    near(wide.field.x, 152, 'field starts after the label and gap')
    near(wide.field.y, 0, 'field shares the label row')
    near(wide.field.width, 408, 'field fills the rest')
    near(wide.hint.x, 152, 'hint starts in the field column')
    near(wideCheckbox.host.x, 152, 'checkbox starts in the field column')

    const [narrow, narrowCheckbox] = await measure(page, '#narrow')
    near(narrow.label.width, 300, 'label takes the row')
    near(narrow.field.x, 0, 'field starts at the edge')
    assert.ok(narrow.field.y >= narrow.label.height, 'field sits below the label')
    near(narrow.field.width, 300, 'field fills the row')
    near(narrow.hint.x, 0, 'hint starts at the edge')
    near(narrowCheckbox.host.x, 0, 'checkbox starts at the edge')
    assert.deepEqual(errors, [])
  })

  test.fast(`${engine.name()}: label, field, and hint agree on both sides of the wrap threshold`, async t => {
    const { page } = await fixture(t, engine, `<form data-anta id="form">${input('name', 'Name', { hint: 'A hint.' })}</form>`)
    // 140 label + 12 gap + 200 field = 352. The layout allows 1px under that,
    // so the samples sit on either side of 351.
    for (const [width, beside] of [[340, false], [350.5, false], [351.2, true], [351.6, true], [352, true], [352.4, true], [400, true]]) {
      await page.locator('#form').evaluate((form, width) => { form.style.width = `${width}px` }, width)
      const [row] = await measure(page, '#form')
      assert.equal(row.field.y < 1, beside, `field at ${width}px`)
      assert.equal(row.label.width < 200, beside, `label at ${width}px`)
      assert.equal(row.hint.x > 100, beside, `hint at ${width}px`)
      assert.ok(row.field.width >= 199, `field collapsed at ${width}px`)
    }
  })

  test(`${engine.name()}: a label taller than its field leaves the hint under the field`, async t => {
    const { page } = await fixture(t, engine, `<form data-anta id="form" style="width:560px">
      ${input('email', 'Notify by email when the run finishes (optional)', { hint: 'Separate multiple addresses with commas.' })}
    </form>`)
    const [row] = await measure(page, '#form')
    assert.ok(row.label.height > row.field.height, 'the label wraps taller than the field')
    near(row.hint.y, row.field.height + 4, 'hint follows the field')
    near(row.host.height, row.label.height, 'the row is as tall as its label')
  })

  test(`${engine.name()}: public variables apply from the form or an ancestor`, async t => {
    const { page } = await fixture(t, engine, `
      <div style="--form-label-width:96px"><form data-anta id="ancestor" style="width:560px">${input('a', 'Name')}</form></div>
      <form data-anta id="above" style="width:560px;--form-label-width:100%">${input('b', 'Name')}</form>
      <form data-anta id="min" style="width:560px;--form-field-min:480px">${input('c', 'Name')}</form>
    `)
    near((await measure(page, '#ancestor'))[0].label.width, 96, 'ancestor label width')
    const [above] = await measure(page, '#above')
    near(above.label.width, 560, 'a full-width label column keeps the label above')
    near(above.field.x, 0, 'field under a full-width label')
    near((await measure(page, '#min'))[0].field.x, 0, 'a larger minimum moves the label above')
  })

  test(`${engine.name()}: columns fill only while each stays wider than the minimum field`, async t => {
    const fields = input('a', 'One', { hint: 'Required.', attrs: 'status="critical"' }) + input('b', 'Two') + input('c', 'Three') + input('d', 'Four')
      + '<a-button role="button" tabindex="0" type="submit"><a-button-label>Save</a-button-label></a-button>'
    const { page } = await fixture(t, engine, `
      <form data-anta id="two" style="width:900px;--form-columns:2">${fields}</form>
      <form data-anta id="one" style="width:380px;--form-columns:2">${fields}</form>
    `)
    const two = await measure(page, '#two')
    near(two[0].host.width, 438, 'column width')
    near(two[1].host.x, 462, 'second column')
    near(two[1].host.y, 0, 'second field shares the first row')
    near(two[2].host.x, 0, 'third field starts the next row')
    near(two[3].host.y, two[2].host.y, 'a taller first row moves the whole next row')
    assert.ok(two[2].host.y > two[1].host.height + 16, 'the next row clears the taller field')
    near(two[4].host.x, two[0].field.x, 'button lines up with the first column of fields')

    const one = await measure(page, '#one')
    for (const row of one.slice(0, 4)) near(row.host.x, 0, 'one column when two do not fit')
    assert.ok(await page.locator('#one').evaluate(form => form.scrollWidth <= form.clientWidth), 'no overflow')
  })

  test(`${engine.name()}: a Box that holds the submit button is one row in the field column`, async t => {
    const save = '<a-button role="button" tabindex="0" type="submit"><a-button-label>Save</a-button-label></a-button>'
    const other = '<a-button role="button" tabindex="0"><a-button-label>Clear filter</a-button-label></a-button>'
    const row = `<a-box display="flex" style="gap:8px">${save}${other}</a-box>`
    const { page } = await fixture(t, engine, `
      <form data-anta id="wide" style="width:560px">${input('name', 'Name')}${row}</form>
      <form data-anta id="narrow" style="width:300px">${input('name', 'Name')}${row}</form>
      <form data-anta id="columns" style="width:900px;--form-columns:2">${input('a', 'One')}${input('b', 'Two')}${row}</form>
      <form data-anta id="other" style="width:560px">${input('name', 'Name')}<a-box padding style="--box-padding:12px">${other}</a-box></form>
    `)
    const buttons = id => page.locator(`#${id}`).evaluate(form => {
      const origin = form.getBoundingClientRect()
      const box = form.querySelector('a-box').getBoundingClientRect()
      return { box: { x: box.x - origin.x, width: box.width }, buttons: [...form.querySelectorAll('a-button')].map(el => {
        const rect = el.getBoundingClientRect()
        return { x: rect.x - origin.x, y: rect.y - origin.y }
      }) }
    })
    const wide = await buttons('wide')
    near(wide.buttons[0].x, 152, 'first button in the field column')
    near(wide.buttons[1].y, wide.buttons[0].y, 'buttons share a row')
    assert.ok(wide.buttons[1].x > wide.buttons[0].x, 'second button follows the first')
    near(wide.box.width, 560, 'in one column the row spans the form')
    near((await buttons('narrow')).buttons[0].x, 0, 'no offset when labels are above')
    const columns = await buttons('columns')
    near(columns.box.width, 438, 'with columns the row takes the first column')
    near(columns.buttons[0].x, 152, 'and lines up with that column of fields')
    const padding = await page.locator('#other a-box').evaluate(el => getComputedStyle(el).paddingInlineStart)
    assert.equal(padding, '12px', 'a Box without the submit button keeps its own padding')
  })

  test.fast(`${engine.name()}: fields glide from their old place when the number of columns changes`, async t => {
    const fields = input('a', 'One') + input('b', 'Two') + input('c', 'Three', { attrs: 'style="transform:scale(0.5)"' }) + input('d', 'Four')
    const { page, errors } = await fixture(t, engine, `
      <a-form id="host"><form id="form" style="width:900px;--form-columns:2">${fields}<p id="app">Application content</p></form></a-form>
      <form data-anta id="plain" style="width:900px;--form-columns:2">${fields}</form>
      <a-form><form id="wraps" style="width:900px;--form-columns:2;--form-label-width:100%">
        ${input('e', 'One', { hint: 'A hint that is long enough to fit on one line in a wide column and to wrap in a narrow one.' })}${input('f', 'Two')}${input('g', 'Three')}${input('h', 'Four')}</form></a-form>
    `)
    const wrapsRow = await page.locator('#wraps').evaluate(form => form.children[2].getBoundingClientRect().y - form.children[0].getBoundingClientRect().y)
    const resize = async (id, width) => {
      await page.locator(id).evaluate((form, width) => { form.style.width = `${width}px` }, width)
      // Two frames: the observer runs after layout, then the animations exist.
      await frames(page)
      return page.locator(id).evaluate(form => [...form.children].map(el => el.getAnimations().length))
    }
    const rects = () => page.locator('#form').evaluate(form => [...form.children].map(el => {
      const rect = el.getBoundingClientRect()
      return [rect.x, rect.y]
    }))
    await frames(page)
    assert.deepEqual(await resize('#form', 880), [0, 0, 0, 0, 0], 'the second column only tracks its edge')
    const before = await rects()

    // Pause each glide at its first frame: every field must still be where it was.
    await page.locator('#form').evaluate(form => { form.style.width = '380px' })
    await frames(page)
    await page.locator('#form').evaluate(form => form.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 0 }))
    const started = await rects()
    assert.deepEqual(await page.locator('#form').evaluate(form => [...form.children].map(el => el.getAnimations().length)), [0, 1, 1, 1, 0], 'moved fields glide; the first field and application content do not')
    near(started[1][0], before[1][0], 'the second field starts at its old x')
    near(started[1][1], before[1][1], 'the second field starts at its old y')
    near(started[3][1], before[3][1], 'the fourth field starts at its old y')
    const scaled = await page.locator('#form a-input').nth(2).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
    near(scaled * 100, 50, 'a field keeps its own transform while it glides')
    assert.equal(await page.locator('#form a-input').nth(1).evaluate(el => el.getAttribute('style')), null, 'no inline style is written')

    // At the end each field rests at its new layout place.
    await page.locator('#form').evaluate(form => form.getAnimations({ subtree: true }).forEach(animation => animation.finish()))
    const ended = await rects()
    near(ended[1][0], ended[0][0], 'the second field ends in the one column')
    assert.ok(ended[1][1] > ended[0][1], 'below the first')

    await page.locator('#form a-input').first().evaluate(el => { el.style.minHeight = '80px' })
    await frames(page)
    assert.deepEqual(await page.locator('#form').evaluate(form => [...form.children].map(el => el.getAnimations().length)), [0, 0, 0, 0, 0], 'a field that grows does not glide the rest')

    assert.deepEqual(await resize('#plain', 380), [0, 0, 0, 0], 'a native form outside a-form never glides')

    // Still two columns at 520px, but the long hint wraps and pushes the next row down.
    assert.deepEqual(await resize('#wraps', 520), [0, 0, 0, 0], 'a row pushed down by a wrapped hint does not glide')
    const pushed = await page.locator('#wraps').evaluate(form => form.children[2].getBoundingClientRect().y - form.children[0].getBoundingClientRect().y)
    assert.ok(pushed > wrapsRow + 10, `the hint did wrap and move the row: ${pushed} from ${wrapsRow}`)

    await page.locator('#host').evaluate(host => host.replaceWith(host.firstElementChild))
    assert.deepEqual(await resize('#form', 900), [0, 0, 0, 0, 0], 'a form taken out of its a-form stops gliding')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: reduced motion turns the glide off`, async t => {
    const fields = input('a', 'One') + input('b', 'Two') + input('c', 'Three')
    const { page } = await fixture(t, engine, `<a-form><form id="form" style="width:900px;--form-columns:2">${fields}</form></a-form>`)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await frames(page)
    await page.locator('#form').evaluate(form => { form.style.width = '380px' })
    await frames(page)
    assert.deepEqual(await page.locator('#form').evaluate(form => [...form.children].map(el => el.getAnimations().length)), [0, 0, 0])
  })

  test(`${engine.name()}: an Input keeps its arrangement when it upgrades`, async t => {
    const markup = `<form data-anta id="wide" style="width:560px">${input('name', 'Name', { attrs: 'placeholder="Ada"' })}</form>
      <form data-anta id="narrow" style="width:300px">${input('name', 'Name', { attrs: 'placeholder="Ada"' })}</form>`
    const { page } = await fixture(t, engine, markup, { upgrade: false })
    const standIn = id => page.locator(`#${id} a-input`).evaluate(el => {
      const host = el.getBoundingClientRect()
      const label = el.querySelector('[slot="label"]').getBoundingClientRect()
      const after = getComputedStyle(el, '::after')
      return { labelWidth: label.width, labelX: label.x - host.x, fieldIndent: parseFloat(after.marginInlineStart), fieldWidth: parseFloat(after.width), height: host.height }
    })
    const wide = await standIn('wide')
    near(wide.labelWidth, 140, 'label column before upgrade')
    near(wide.fieldIndent, 152, 'stand-in field starts in the field column')
    near(wide.height, 28, 'one row before upgrade')
    const narrow = await standIn('narrow')
    near(narrow.labelWidth, 300, 'label takes the row before upgrade')
    near(narrow.fieldIndent, 0, 'stand-in field at the edge')
    near(narrow.fieldWidth, 300, 'stand-in field fills the row')
    near(narrow.height, 52, 'label row, gap, and field before upgrade')

    const { page: upgraded } = await fixture(t, engine, markup)
    const [wideRow] = await measure(upgraded, '#wide')
    const [narrowRow] = await measure(upgraded, '#narrow')
    near(wideRow.host.height, wide.height, 'the wide field keeps its height on upgrade')
    near(narrowRow.host.height, narrow.height, 'the narrow field keeps its height on upgrade')
  })

  test(`${engine.name()}: a plain child of an Input sits under its field`, async t => {
    const { page } = await fixture(t, engine, `<form data-anta id="form" style="width:560px">
      <a-input name="name"><span slot="label">Name</span><div id="extra">Strength: weak</div><span slot="hint">A hint.</span></a-input>
    </form>`)
    const [row] = await measure(page, '#form')
    const extra = await page.locator('#extra').evaluate(el => {
      const origin = el.closest('form').getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      return { x: rect.x - origin.x, y: rect.y - origin.y, bottom: rect.bottom - origin.y }
    })
    near(extra.x, 152, 'the child starts in the field column')
    assert.ok(extra.y >= row.field.height, 'below the field')
    assert.ok(row.hint.y >= extra.bottom, 'and above the hint')
  })

  test(`${engine.name()}: a sticky row of actions stays in view while the form scrolls`, async t => {
    const fields = input('a', 'One') + input('b', 'Two') + input('c', 'Three') + input('d', 'Four') + input('e', 'Five')
    const row = '<a-box display="flex" style="gap:8px"><a-button role="button" tabindex="0" type="submit"><a-button-label>Save</a-button-label></a-button></a-box>'
    const { page } = await fixture(t, engine, `
      <div id="sticky" style="width:520px;height:160px;overflow:auto"><a-form sticky-actions><form>${fields}${row}</form></a-form></div>
      <div id="plain" style="width:520px;height:160px;overflow:auto"><form data-anta>${fields}${row}</form></div>
    `)
    const rowInView = id => page.locator(`#${id}`).evaluate(el => {
      const view = el.getBoundingClientRect()
      const box = el.querySelector('a-box').getBoundingClientRect()
      return { fromBottom: Math.round(view.bottom - box.bottom), width: Math.round(box.width), canScroll: el.scrollHeight > el.clientHeight, opaque: getComputedStyle(el.querySelector('a-box')).backgroundColor !== 'rgba(0, 0, 0, 0)' }
    })
    assert.deepEqual(await rowInView('sticky'), { fromBottom: 0, width: 520, canScroll: true, opaque: true }, 'the row sits at the bottom of the scroll box before scrolling')
    assert.ok((await rowInView('plain')).fromBottom < 0, 'in a native form the row is below the fold')
    await page.locator('#sticky').evaluate(el => { el.scrollTop = 40 })
    assert.equal((await rowInView('sticky')).fromBottom, 0, 'and stays there while the form scrolls')
    await page.locator('#sticky').evaluate(el => { el.scrollTop = el.scrollHeight })
    assert.equal((await rowInView('sticky')).fromBottom, 0, 'and at the end of the form')
  })

  test(`${engine.name()}: Form passes its props to a-form as variables and attributes`, async t => {
    const { page, errors } = await fixture(t, engine, '')
    const host = page.locator('a-form:has(> #jsx)')
    await page.evaluate(() => window.renderForm({ columns: 1, labelWidth: 96, slot: 'footer' }))
    await page.waitForFunction(() => [...document.querySelectorAll('#jsx a-input')].every(el => el.shadowRoot))
    assert.deepEqual(await host.evaluate(el => ({
      hotkey: el.getAttribute('submit-hotkey'), sticky: el.hasAttribute('sticky-actions'), slot: el.slot, form: el.firstElementChild.localName, formAttributes: el.firstElementChild.getAttributeNames(),
      columns: el.style.getPropertyValue('--form-columns'), labelWidth: el.style.getPropertyValue('--form-label-width'),
    })), { hotkey: null, sticky: false, slot: 'footer', form: 'form', formAttributes: ['id'], columns: '1', labelWidth: '96px' })
    const [name] = await measure(page, '#jsx')
    near(name.label.width, 96, 'label column from the prop')
    await page.evaluate(() => window.renderForm({ submitHotkey: 'mod+enter', stickyActions: true }))
    assert.equal(await host.getAttribute('submit-hotkey'), 'mod+enter')
    assert.equal(await host.getAttribute('sticky-actions'), '')
    assert.equal(await page.locator('#jsx > a-box').evaluate(el => getComputedStyle(el).position), 'sticky')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: a field inside another element keeps its own layout`, async t => {
    const { page } = await fixture(t, engine, `<form data-anta id="form" style="width:560px"><div>${input('nested', 'Name')}</div></form>`)
    const nested = await page.locator('#form a-input').evaluate(el => {
      const label = el.shadowRoot.querySelector('[part~="label"]').getBoundingClientRect()
      const field = el.shadowRoot.querySelector('[part~="field"]').getBoundingClientRect()
      return { labelWidth: label.width, fieldBelow: field.y >= label.bottom }
    })
    near(nested.labelWidth, 560, 'label spans the field')
    assert.ok(nested.fieldBelow, 'field stays below its label')
  })

  test(`${engine.name()}: right-to-left mirrors the label column`, async t => {
    const { page } = await fixture(t, engine, `<form data-anta id="form" dir="rtl" style="width:560px">${input('name', 'Name', { hint: 'A hint.' })}</form>`)
    const [row] = await measure(page, '#form')
    near(row.label.x, 420, 'label on the inline start side')
    near(row.field.x, 0, 'field fills to the inline end')
    near(row.hint.x, 0, 'hint under the field')
  })
}
