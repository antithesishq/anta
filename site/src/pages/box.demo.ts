/**
 * Playground source for Box. Kept beside the page so MDX preserves the
 * template literal's whitespace.
 */
export default `import { Box, Slider, Tag, Text } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [width, setWidth] = useState(200)
  const [m, setM] = useState(null)
  const [context, setContext] = useState(null)

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <Slider
        label="Box width"
        value={width}
        min={120}
        max={420}
        valueSuffix="px"
        onValueChange={(_, { value }) => setWidth(value)}
      />

      <Box
        display="flex"
        style={{
          width: \`\${width}px\`,
          gap: 8,
          padding: 12,
          overflowX: 'auto',
          border: '1px solid var(--border-4)',
          borderRadius: 8,
        }}
        onMeasureChange={(_, { current }) => setM(current)}
        onContextChange={(_, { current }) => setContext(current)}
      >
        <Text style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          A child that is wider than a narrow Box.
        </Text>
      </Box>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Tag size="small" label={\`client \${m?.clientWidth ?? 0}px\`} />
        <Tag size="small" label={\`scroll \${m?.scrollWidth ?? 0}px\`} />
        <Tag
          size="small"
          tone={m?.overflowX ? 'warning' : 'success'}
          label={m?.overflowX ? 'overflowX' : 'content fits'}
        />
        {m?.scrollableX && <Tag size="small" tone="info" label="scrollableX" />}
        <Tag size="small" tone="brand" label={\`mode \${context?.mode ?? '…'}\`} />
        <Tag size="small" label={\`pointer \${context?.pointer ?? '…'}\`} />
      </div>
    </div>
  )
}
`
