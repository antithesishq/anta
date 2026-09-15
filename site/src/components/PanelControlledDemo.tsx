import { useState } from 'preact/hooks'
import { Box, Button, Input, Panel } from '@antadesign/anta'

export default function PanelControlledDemo() {
  const [maximized, setMaximized] = useState(false)

  return (
    <Panel
      style={{ background: 'var(--bg-3)' }}
      maximized={maximized}
      onStateChange={(_event, { next }) => setMaximized(next)}
    >
      <Box
        display="flex"
        gap={16}
        padding={16}
      >
        <Input aria-label="Workspace note" placeholder="Write a note" />
        <Button onClick={() => setMaximized(value => !value)}>
          {maximized ? 'Restore panel' : 'Maximize panel'}
        </Button>
      </Box>
    </Panel>
  )
}
