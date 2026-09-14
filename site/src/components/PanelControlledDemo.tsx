import { useState } from 'preact/hooks'
import { Box, Button, Input, Panel } from '@antadesign/anta'

export default function PanelControlledDemo() {
  const [maximized, setMaximized] = useState(false)

  return (
    <Panel
      maximized={maximized}
      onStateChange={(_event, { next }) => setMaximized(next)}
      style={{ width: '100%' }}
    >
      <Box
        display="flex"
        gap={16}
        style={{ minHeight: '100%', boxSizing: 'border-box', padding: 16, alignItems: 'flex-start', background: 'var(--bg-2)' }}
      >
        <Input aria-label="Workspace note" placeholder="Write a note" />
        <Button onClick={() => setMaximized(value => !value)}>
          {maximized ? 'Restore panel' : 'Maximize panel'}
        </Button>
      </Box>
    </Panel>
  )
}
