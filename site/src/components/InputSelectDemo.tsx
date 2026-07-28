import { useEffect, useState } from 'preact/hooks'
import { Input, Icon, Menu, MenuItem } from '@antadesign/anta'
import styles from './InputSelectDemo.module.css'

/**
 * A *composition* demo: a select-like "dropdown input" built from <Input> +
 * <Menu>. The field is read-only (not clearable) and shows the chosen value; a
 * <Menu> placed right after it anchors to the field, opens on click, and closes
 * on select. A dedicated <Select> (full keyboard/type-ahead) is still to come —
 * this shows the field already provides the trigger and the value display.
 */
const OPTIONS = ['Brand', 'Critical', 'Info', 'Success', 'Warning']

export default function InputSelectDemo() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <div style={{ width: '280px' }}>
      <Input
        label="Tone"
        placeholder="Select a tone…"
        value={value}
        readOnly
        dimActions
        trailing={
          <Icon
            shape="chevron-down"
            className={open ? `${styles.chevron} ${styles.open}` : styles.chevron}
          />
        }
      />

      {/* Anchors to its previous sibling (the field), opens on click, closes on
          select. Uncontrolled — we only observe onStateChange to rotate the
          chevron; the menu sets aria-expanded on the field itself. */}
      <Menu
        style={{ '--menu-min-width': '280px' } as any}
        onStateChange={(_e, { next }) => setOpen(next)}
      >
        {OPTIONS.map((o) => (
          <MenuItem key={o} label={o} onSelect={() => setValue(o)} />
        ))}
      </Menu>
    </div>
  )
}
