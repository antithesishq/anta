import type { BoxProps } from '../src/components/Box'

const single: BoxProps = { observe: 'size' }
const everySelection: BoxProps = {
  observe: ['width', 'height', 'size', 'context', 'overflow', 'edges', 'scroll', 'all'],
}
const readonlySelections = ['edges', 'size'] as const
const combined: BoxProps = { observe: readonlySelections, throttle: 100 }

// @ts-expect-error Misspelled selections must not compile.
const typo: BoxProps = { observe: 'widht' }
// @ts-expect-error Every array entry must be checked.
const arrayTypo: BoxProps = { observe: ['size', 'edge'] }
// @ts-expect-error JSX combinations use typed arrays, not unchecked strings.
const spaceSeparated: BoxProps = { observe: 'size edges' }
// @ts-expect-error Only the eight public selections are supported.
const individualField: BoxProps = { observe: 'clippedX' }
// @ts-expect-error The old draft name is not a supported selection.
const oldName: BoxProps = { observe: 'hiddenEdges' }

void [single, everySelection, combined, typo, arrayTypo, spaceSeparated, individualField, oldName]
