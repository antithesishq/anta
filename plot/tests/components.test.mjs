import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { Plot, PlotHost } from './components.bundle.mjs'
import { scatter } from './components.bundle.mjs'

test('Plot server rendering leaves configuration and lifecycle to the browser', () => {
    let calls = 0
    const plotArgs = {
        series: [scatter({ data: [{ x: 1, y: 2 }] })],
        axis: { x: { tick_label: { format: () => { calls++; return 'x' } } } },
    }
    const markup = renderToString(React.createElement(Plot, { plotArgs }))
    assert.match(markup, /<div/)
    assert.doesNotMatch(markup, /plotArgs|plotargs|<canvas/)
    assert.equal(calls, 0)
    assert.equal(typeof globalThis.customElements, 'undefined')
})

for (const initiallyValid of [false, true]) {
    test(`failed template updates are attempted once per reference (initially valid: ${initiallyValid})`, () => {
        const errors = []
        const host = new PlotHost({
            commit_mode: 'throttled',
            resolve_hover: input => input,
            schedule() {},
            hover() {},
            clear_hover() {},
            pointer() {},
            viewport() {},
            error: failure => errors.push(failure),
        })
        const valid = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
        if (initiallyValid) assert.equal(host.update(valid), true)
        const previous = host.controller?.template
        let attempts = 0
        const invalid = {
            ...valid,
            get axis() {
                attempts++
                return { y: { scale: 'log', min: 0 } }
            },
        }

        assert.equal(host.update(invalid), false)
        const firstAttemptReads = attempts
        assert.ok(firstAttemptReads > 0)
        assert.equal(errors.length, 1)
        assert.equal(errors[0].phase, 'template')
        assert.match(errors[0].error.message, /axis\.y\.min/)

        for (const width of [400, 600, 800]) {
            host.measurement = { width, height: 300 }
            host.environment = { color_theme: 'light', device_pixel_ratio: 2 }
            assert.equal(host.update(invalid), false)
        }
        host.disconnect()
        assert.equal(host.update(invalid), false)
        assert.equal(attempts, firstAttemptReads)
        assert.equal(errors.length, 1)
        assert.equal(host.controller?.template, previous)

        // A new reference gets its own attempt, even if its contents are equally invalid.
        assert.equal(host.update({ ...invalid }), false)
        assert.equal(errors.length, 2)

        assert.equal(host.update(valid), true)
        assert.equal(host.update(valid), true)
        assert.equal(host.controller.plot_args, valid)
        assert.equal(errors.length, 2)
        // Returning to an earlier rejected reference after another update is a fresh attempt.
        assert.equal(host.update(invalid), false)
        assert.equal(errors.length, 3)
        host.disconnect()
    })
}

for (const dimension of ['width', 'height']) {
    test(`non-positive ${dimension} reports once until size recovers`, () => {
        const errors = []
        const host = new PlotHost({
            commit_mode: 'throttled',
            resolve_hover: input => input,
            schedule() {}, hover() {}, clear_hover() {}, pointer() {}, viewport() {},
            error: failure => errors.push(failure),
        })
        host.update({ series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] })
        host.environment = { color_theme: 'light', device_pixel_ratio: 1 }

        assert.equal(host.render(), null)
        assert.equal(errors.length, 0, 'unmeasured plots stay silent')

        host.measurement = { width: 400, height: 300, [dimension]: 0 }
        assert.equal(host.render(), null)
        assert.equal(errors.length, 1)
        assert.equal(errors[0].phase, 'compose')
        assert.match(errors[0].error.message, /canvas resolved to.*0px/)
        assert.match(errors[0].error.message, /parent container/)

        host.measurement = { width: 500, height: 350, [dimension]: -1 }
        host.render()
        host.render()
        assert.equal(errors.length, 1, 'continuous invalid sizing does not repeat errors')

        host.measurement = { width: 400, height: 300 }
        assert.ok(host.render(), 'positive measurements recover without new arguments')
        host.measurement = { width: 400, height: 300, [dimension]: 0 }
        assert.equal(host.render(), null)
        assert.equal(errors.length, 2, 'a new invalid-size episode reports again')
        host.disconnect()
    })
}
