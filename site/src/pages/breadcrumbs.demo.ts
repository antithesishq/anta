/** Demo source for the Breadcrumbs playground. */
export default `import { Breadcrumbs, type BreadcrumbItem } from '@antadesign/anta'

const items = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects', icon: 'folder-open' },
  { label: 'Anta', href: '/projects/anta' },
  {
    label: 'Button.tsx',
    current: true,
    copy: 'src/components/Button.tsx',
    iconPlacement: 'trailing',
    copiedLabel: 'Path copied',
  },
] satisfies BreadcrumbItem[];

/** @play props Breadcrumbs */
<Breadcrumbs
  aria-label="File path"
  items={items}
  maxItems={3}
  underline="solid"
  underlineOnHover
/>
`
