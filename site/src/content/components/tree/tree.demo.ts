export default `import { Icon, Menu, MenuItem, Tree } from '@antadesign/anta'

function Demo() {
  const file = name => ({ id: name, label: name.split('/').pop(), indicator: <Icon shape="file" /> })
  const items = [
    {
      id: 'src', label: 'src',
      actions: [{ icon: 'more', label: 'More actions', opensMenu: true }],
      children: [
        file('src/index.ts'),
        { id: 'src/ledger', label: 'ledger', children: [file('src/ledger/transfer.ts'), file('src/ledger/balance.ts')] },
        { id: 'src/fixtures', label: 'fixtures', children: [] },
      ],
    },
    { id: 'workload', label: 'workload', children: [file('workload/driver.ts')] },
    file('README.md'),
  ]
  return (
    <>
      <Tree
        aria-label="Project files"
        items={items}
        defaultOpen={['src']}
        indicator={{ closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> }}
      />
      <Menu context>
        <MenuItem label="Rename" />
        <MenuItem label="Delete" tone="critical" />
      </Menu>
    </>
  )
}
`
