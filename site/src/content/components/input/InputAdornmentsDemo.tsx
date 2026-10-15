import { Input, Icon } from '@antadesign/anta'

export default function InputAdornmentsDemo() {
  return (
    <>
      <Input label="Leading icon" placeholder="Search…" leading={<Icon shape="search" />} autoComplete="off" />
      <Input label="Trailing icon" placeholder="Enter a value" trailing={<Icon shape="info" />} autoComplete="off" />
      <Input label="Clear action" placeholder="Search…" clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="All adornments" leading={<Icon shape="search" />} trailing={<Icon shape="info" />} clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="Text adornments" leading="from" trailing="each" defaultValue="$20" autoComplete="off" />
    </>
  )
}
