import { useState } from 'preact/hooks'
import { Menu, MenuItem, MenuSeparator, Button, Text } from '@antadesign/anta'

/**
 * Live demo for the Menu docs: a whole row is clickable (it "opens" the file),
 * with a kebab Menu in the corner. Selecting an item never fires the row's
 * `onClick` — the activation click is contained at the menu surface — so the
 * in-row counter only moves when the row itself is clicked. The props-driven
 * playground can't express an ancestor `onClick`, so this is a hydrated island.
 */
export default function MenuContainmentDemo() {
  const [rowClicks, setRowClicks] = useState(0)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setRowClicks((n) => n + 1)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        border: '1px solid var(--border-3)',
        borderRadius: '10px',
        background: 'var(--bg-2)',
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: '1' }}>Quarterly report.pdf</span>
      <Text size="small" style={{ color: 'var(--text-4)' }}>
        Click row: {rowClicks}
      </Text>
      {/* The trigger is an ordinary button inside the row, so its own click
          bubbles — stop it so opening the menu isn't counted as a row click.
          The menu items need no such handling; the menu contains them. */}
      <Button
        priority="tertiary"
        icon="dots-vertical"
        aria-label="File actions"
        onClick={(e: any) => e.stopPropagation()}
      />
      <Menu>
        <MenuItem icon="edit" label="Rename" />
        <MenuItem icon="copy" label="Duplicate" />
        <MenuSeparator />
        <MenuItem icon="trash" tone="critical" label="Delete" />
      </Menu>
    </div>
  )
}
