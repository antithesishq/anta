/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Form } from '../src/components/Form'
import { Input } from '../src/components/Input'
import { InputAutocomplete } from '../src/components/InputAutocomplete'
import { InputDate } from '../src/components/InputDate'
import { InputTime } from '../src/components/InputTime'
import { Select } from '../src/components/Select'
import { Button } from '../src/components/Button'
import { Box } from '../src/components/Box'
import { Checkbox } from '../src/components/Checkbox'
import '../src/elements'
import '../src/tokens.css'
import '../src/theme-antune.css'

type Scene = { submitHotkey?: 'mod+enter' | 'enter'; stickyActions?: boolean; slot?: string; columns?: number; labelWidth?: number | string; primary?: boolean }

Object.assign(window, {
  /** Render the JSX components into `#mount` and record submissions. */
  renderForm({ primary = true, ...props }: Scene = {}) {
    const log = ((window as any).formLog ??= [])
    render(
      <Form id="jsx" style={{ width: 560 }} {...props} onSubmit={event => { event.preventDefault(); log.push('submit') }} onChange={event => { ((window as any).changeLog ??= []).push((event.target as Element).getAttribute('name')) }}>
        <Input id="jsx-name" name="name" label="Name" />
        <Input id="jsx-notes" name="notes" label="Notes" multiline />
        <Checkbox name="remind" label="Remind me" />
        <Box display="flex" gap={8}>
          <Button id="jsx-save" type="submit" priority={primary ? 'primary' : undefined} label="Save" />
          <Button id="jsx-clear" type="reset" label="Clear" />
        </Box>
      </Form>,
      document.querySelector('#mount')!,
    )
  },
  /** The controls that use Enter themselves, in one `Form`. */
  renderControls() {
    const log = ((window as any).formLog ??= [])
    render(
      <Form id="controls" submitHotkey="enter" style={{ width: 560 }} onSubmit={event => { event.preventDefault(); log.push('submit') }}>
        <Select label="Field" filter options={[{ value: 'alpha' }, { value: 'beta' }]} />
        <InputAutocomplete label="Framework" suggestions={['React', 'Preact', 'Solid']} />
        <InputDate label="Date" />
        <InputTime label="Start" defaultValue="09:30" />
        <Button id="controls-save" type="submit" priority="primary" label="Save" />
      </Form>,
      document.querySelector('#mount')!,
    )
  },
})
