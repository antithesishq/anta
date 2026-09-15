import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { configure, Plot } from './components.bundle.mjs'
import { scatter } from '../dist/index.js'

test('Plot uses the configured renderer and preserves configuration identity', () => {
    const plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }], tooltip: true })] }
    configure((type, props) => ({ type, props }), React.Fragment, { useState: initial => [initial, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot() })

    try {
        const result = Plot({ plotArgs, className: 'example', id: 'plot' })
        assert.equal(result.type, 'a-plot')
        assert.equal(result.props.plotArgs, plotArgs)
        assert.equal(result.props.class, 'example')
        assert.equal(result.props.id, 'plot')
        assert.equal(result.props.ref, undefined)
    } finally {
        configure(React.createElement, React.Fragment, { useState: React.useState, useSyncExternalStore: React.useSyncExternalStore })
    }
})

test('Plot server rendering leaves configuration and lifecycle to the browser', () => {
    let calls = 0
    const plotArgs = {
        series: [scatter({ data: [{ x: 1, y: 2 }] })],
        axis: { x: { tick_label: { format: () => { calls++; return 'x' } } } },
    }
    const markup = renderToString(React.createElement(Plot, { plotArgs }))
    assert.match(markup, /<a-plot/)
    assert.doesNotMatch(markup, /plotArgs|plotargs|canvas/)
    assert.equal(calls, 0)
    assert.equal(typeof globalThis.customElements, 'undefined')
})
