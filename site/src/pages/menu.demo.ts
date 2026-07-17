/**
 * Demo source code for the Menu playground. Kept in a sibling .ts file so
 * Astro's MDX pipeline doesn't mangle the template literal's indentation
 * (see progress.demo.ts for the full rationale).
 */
export default `import { Menu, MenuItem, MenuSeparator, Button } from '@antadesign/anta'

<Button>Actions</Button>
<Menu>
  <MenuItem icon="share" label="Share" submenu>
    <Menu>
      <MenuItem icon="link" label="Copy link" />
      <MenuItem icon="send" label="Email" />
    </Menu>
  </MenuItem>
  <MenuItem icon="copy" label="Duplicate" submenu>
    <Menu>
      <MenuItem label="Duplicate here" />
      <MenuItem label="Duplicate to…" />
    </Menu>
  </MenuItem>
  <MenuItem icon="edit" label="Edit" submenu>
    <Menu>
      <MenuItem label="Rename" />
      <MenuItem label="Edit metadata" />
    </Menu>
  </MenuItem>
  <MenuSeparator />
  {/* A real link: href renders a native <a>, so it navigates, opens in a new
      tab on ⌘/middle-click, and offers "copy link address". */}
  <MenuItem icon="file" label="Documentation" href="/menu" target="_blank" iconTrailing="external-link" />
  <MenuSeparator />
  <MenuItem tone="critical" icon="trash" label="Delete" kbd="⌘⌫" />
</Menu>
`
