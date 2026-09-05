import { h, render } from 'preact'
import { configure } from '../src/jsx-runtime'
import { Box } from '../src/components/Box'
import '../src/elements/a-box'

configure(h)

// Test-only renderer bridge. Production consumers keep all configuration declarative.
Object.assign(window, { renderBox: (props: object) => render(h(Box, props), document.body) })
