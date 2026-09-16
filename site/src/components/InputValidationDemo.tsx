import { useEffect, useState } from 'preact/hooks'
import { Input, Button } from '@antadesign/anta'

/**
 * Shows native constraint validation surfaced as Anta's *own* error UI. The
 * form is `noValidate` (so the browser's default bubbles are suppressed); on
 * submit we read each field's `validationMessage` (computed natively from
 * `type` / `required` / `min` / `max`) into `hint`, and flag the field with
 * `status="critical"`.
 */
export default function InputValidationDemo() {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  const validate = (e: SubmitEvent) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const next: Record<string, string | undefined> = {}
    form.querySelectorAll('a-input').forEach((el: any) => {
      if (!el.checkValidity()) next[el.name] = el.validationMessage
    })
    setErrors(next)
  }
  // Clear a field's error as soon as the user edits it.
  const clear = (name: string) => setErrors((p) => ({ ...p, [name]: undefined }))

  return (
    <form
      noValidate
      onSubmit={validate}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '300px' }}
    >
      <Input
        name="email"
        type="email"
        autoComplete="email"
        label="Email"
        placeholder="you@example.com"
        required
        hint={errors.email}
        status={errors.email ? 'critical' : undefined}
        onInput={() => clear('email')}
      />
      <Input
        name="site"
        type="url"
        autoComplete="url"
        label="Website"
        placeholder="https://…"
        hint={errors.site}
        status={errors.site ? 'critical' : undefined}
        onInput={() => clear('site')}
      />
      <Input
        name="age"
        type="number"
        autoComplete="off"
        label="Age"
        placeholder="18 – 120"
        min="18"
        max="120"
        hint={errors.age}
        status={errors.age ? 'critical' : undefined}
        onInput={() => clear('age')}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button type="submit" tone="brand" label="Submit" />
        <Button type="reset" priority="tertiary" label="Reset" onClick={() => setErrors({})} />
      </div>
    </form>
  )
}
