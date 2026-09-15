import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { Plot } from './components.bundle.mjs'
import { scatter } from '../dist/index.js'

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
