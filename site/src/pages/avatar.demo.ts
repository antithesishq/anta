export default `import { Avatar } from '@antadesign/anta'

/**
 * @playground Generator
 * The avatar's JSON-like generation settings. Nested values become editable
 * fields in the Props panel.
 */
const generator = {
  // Every dimension takes one mode: 'off' | 'any' | 'range' | 'list'.
  bgColor: { mode: 'range', l: [0.55, 0.72], c: [0.05, 0.12], h: [0, 360] },
  headColor: { mode: 'any' },
  bodyColor: { mode: 'any' },
  // Corner radius: 0 square, 1 fully round, above 1 elongated into an oval.
  // The bottom is never rounded less than the top, so an egg leans jaw-down.
  headRadiusTop: { mode: 'range', min: 0.5, max: 1.15 },
  headRadiusBottom: { mode: 'range', min: 0.6, max: 1.35 },
  bodyBorderRadius: { mode: 'any' },
  // Space between head and body, as a fraction of head height (0 to 1).
  figureGap: { mode: 'range', min: 0, max: 0.3 },
  figureScale: { mode: 'any' },
  headAngle: { mode: 'any' },
  bodyAngle: { mode: 'any' },
  harmony: true,
}

/** @playground Avatar */
<Avatar
  seed="user-42"
  name="Vlad Korobov"
  size={96}
  badge="success"
  round
  generator={generator}
/>
`
