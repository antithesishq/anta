import { Button, Input, Menu, MenuItem, MenuSeparator } from '@antadesign/anta'

export default function MenuRegionsDemo() {
  return (
    <>
      <Button>Filter</Button>
      <Menu inset={8}>
        <a-menu-header slot="header" data-menu-open="">
          <Input size="small" placeholder="Filter…" aria-label="Filter items" />
        </a-menu-header>
        <MenuItem label="Design" />
        <MenuItem label="Engineering" />
        <MenuSeparator slot="footer" />
        <a-menu-footer slot="footer">
          <MenuItem icon="x" label="Clear filters" data-menu-open="" />
        </a-menu-footer>
      </Menu>
    </>
  )
}
