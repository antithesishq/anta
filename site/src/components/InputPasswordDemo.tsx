import { useEffect, useState } from 'preact/hooks'
import { Input, Button } from '@antadesign/anta'

/**
 * Another trailing-control composition (next to the select dropdown): a password
 * field with a reveal toggle. The eye <Button> flips the field's `type` between
 * `password` and `text` — native masking when hidden, plain text when shown, so
 * password managers and autofill keep working. The value (uncontrolled here) is
 * preserved across the toggle.
 */
export default function InputPasswordDemo() {
  const [reveal, setReveal] = useState(false)

  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <Input
      label="Password"
      autoComplete="current-password"
      type={reveal ? 'text' : 'password'}
      defaultValue="hunter2"
      dimActions
      style={{ width: '300px' }}
      trailing={
        <Button
          priority="tertiary"
          icon={reveal ? 'eye-closed' : 'eye'}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          onClick={() => setReveal((v) => !v)}
        />
      }
    />
  )
}
