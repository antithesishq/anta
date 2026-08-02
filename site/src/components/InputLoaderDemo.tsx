import { Icon, Input } from '@antadesign/anta'

/** Documents a decorative loader in Input's trailing slot. */
export default function InputLoaderDemo() {
  return (
    <Input
      label="Workspace"
      defaultValue="Anta"
      hint="Checking availability"
      dimActions
      style={{ width: '220px' }}
      trailing={<Icon shape="loader" aria-hidden="true" />}
    />
  )
}
