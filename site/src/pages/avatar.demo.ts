export default `import { Avatar } from '@antadesign/anta'

<Avatar
  seed="user-42"
  name="Vlad Korobov"
  size={96}
  generator={{
    // Every dimension takes one mode: 'off' | 'any' | 'range' | 'list'.
    bgColor: { mode: 'range', l: [0.55, 0.72], c: [0.05, 0.12], h: [0, 360] },
    headColor: { mode: 'any' },
    bodyColor: { mode: 'any' },
    // Corner radius runs 0 (square) to 1 (fully round). A round top over a
    // squarer bottom — or the reverse — gives an egg-shaped head.
    headRadiusTop: { mode: 'any' },
    headRadiusBottom: { mode: 'any' },
    bodyBorderRadius: { mode: 'any' },
    // Space between head and body, as a fraction of head height (0 to 1).
    figureGap: { mode: 'range', min: 0, max: 0.3 },
    figureScale: { mode: 'any' },
    headAngle: { mode: 'any' },
    bodyAngle: { mode: 'any' },
    harmony: true,
  }}
/>
`
