import { Menu, MenuItem, MenuItemCopy, MenuSeparator, Button } from '@antadesign/anta'

/**
 * Copy-menu demo for the Menu docs — a Share menu mixing copying rows
 * (`MenuItemCopy`) with a link. Hydrated as an island so the rows' icon / tone
 * feedback runs; `data-menu-open` keeps the menu up long enough to see it.
 */
export default function MenuCopyDemo() {
  return (
    <>
      <Button icon="share" iconTrailing="chevron-down" label="Share" />
      <Menu>
        <MenuItemCopy copy="https://anta.design/menu" label="Copy link" kbd="⌘C" data-menu-open />
        <MenuItemCopy
          copy="<a href='https://anta.design/menu'>Anta — Menu</a>"
          icon="braces"
          label="Copy embed"
          data-menu-open
        />
        <MenuSeparator />
        <MenuItem icon="external-link" label="Open in new tab" href="/menu" target="_blank" />
      </Menu>
    </>
  )
}
