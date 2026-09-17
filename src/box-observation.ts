import type { BoxMeasurement } from './box-types'

const groups = {
  width: ['width'],
  height: ['height'],
  size: ['width', 'height'],
  overflow: [
    'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight',
    'overflowX', 'overflowY', 'clippedX', 'clippedY',
    'scrollableX', 'scrollableY',
  ],
  edges: ['hiddenStartX', 'hiddenEndX', 'hiddenStartY', 'hiddenEndY'],
  scroll: ['scrollLeft', 'scrollTop'],
} satisfies Record<string, readonly (keyof BoxMeasurement)[]>

const measurementFields = new Set<keyof BoxMeasurement>(Object.values(groups).flat())

/** Resolves the same observation vocabulary for JSX handlers and raw attributes. */
export function boxObservation(value: string | null) {
  const fields = new Set<keyof BoxMeasurement>()
  let context = false
  // A bare HTML attribute retains the existing `all` shorthand.
  const tokens = value === '' ? ['all'] : value?.trim().split(/\s+/) ?? []
  for (const token of tokens) {
    if (token === 'all') {
      for (const field of measurementFields) fields.add(field)
      context = true
    } else if (token === 'context') {
      context = true
    } else if (Object.hasOwn(groups, token)) {
      for (const field of groups[token as keyof typeof groups]) fields.add(field)
    }
  }
  const content = [...fields].some(field => field !== 'width' && field !== 'height')
  const scroll = [...groups.scroll, ...groups.edges].some(field => fields.has(field))
  return { fields, context, content, scroll }
}
