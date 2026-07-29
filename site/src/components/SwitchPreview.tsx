import { useState } from 'preact/hooks'
import { Checkbox, Icon, Switch } from '@antadesign/anta'

/**
 * First visual Switch specimen. This is deliberately a small live settings
 * cluster rather than the eventual API playground: it lets us assess the
 * control's proportions, label placement, tones, and free-area icons before
 * documenting every prop.
 */
export default function SwitchPreview() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [automaticUpdates, setAutomaticUpdates] = useState(true)
  const [diagnostics, setDiagnostics] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '20px',
        width: 'min(100%, 420px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Switch
          checked={emailNotifications}
          onStateChange={(_event, { next }) => setEmailNotifications(next)}
          checkedChildren={<Icon shape="check" />}
          label="Email notifications"
        />
        <Checkbox
          checked={emailNotifications}
          onStateChange={(_event, { next }) => setEmailNotifications(next === true)}
          label="Checkbox"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Switch
          checked={automaticUpdates}
          onStateChange={(_event, { next }) => setAutomaticUpdates(next)}
          checkedChildren={<Icon shape="check" />}
          tone="success"
          size="small"
          label="Automatic updates"
        />
        <Checkbox
          checked={automaticUpdates}
          onStateChange={(_event, { next }) => setAutomaticUpdates(next === true)}
          label="Checkbox"
          size="small"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Switch
          checked={diagnostics}
          onStateChange={(_event, { next }) => setDiagnostics(next)}
          checkedChildren={<Icon shape="check" />}
          tone="warning"
          size="large"
          labelPosition="start"
          label="Share diagnostic data"
        />
        <Checkbox
          checked={diagnostics}
          onStateChange={(_event, { next }) => setDiagnostics(next === true)}
          label="Checkbox"
          size="large"
        />
      </div>
    </div>
  )
}
