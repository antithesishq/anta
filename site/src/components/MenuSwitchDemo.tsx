import { useState } from 'preact/hooks'
import { Button, Menu, MenuItem } from '@antadesign/anta'

export default function MenuSwitchDemo() {
  const [notifications, setNotifications] = useState(true)
  const [automaticUpdates, setAutomaticUpdates] = useState(false)

  return (
    <>
      <Button>Settings</Button>
      <Menu>
        <MenuItem
          selectionIndicator="switch"
          label="Notifications"
          selected={notifications}
          onSelect={() => setNotifications((value) => !value)}
        />
        <MenuItem
          selectionIndicator="switch"
          label="Automatic updates"
          hint="Install new versions automatically"
          selected={automaticUpdates}
          onSelect={() => setAutomaticUpdates((value) => !value)}
        />
      </Menu>
    </>
  )
}
