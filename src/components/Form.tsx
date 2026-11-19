import { lengthStyle } from "../anta_helpers"
import type { BaseProps, DOMEventHandlers } from "../general_types"

export interface FormProps extends BaseProps, DOMEventHandlers {
  /** Width of the label column. Use a number for pixels or a CSS length or
   *  percentage. Use `'100%'` to stack the labels of `Input`, `InputTime`, and
   *  `RadioGroup`.
   *  @defaultValue 140 */
  labelWidth?: number | string
  /** Sets the target minimum width for a control beside its label and for each
   *  grid column. A single column can shrink to fit its container. Use a number
   *  for pixels or a CSS length.
   *  @defaultValue 200 */
  fieldMin?: number | string
  /** Maximum number of columns. The form uses fewer when a column would be
   *  narrower than `fieldMin`.
   *  @defaultValue 1 */
  columns?: number
  /** The key that submits the form. `'mod+enter'` is Ctrl+Enter or Cmd+Enter in
   *  any field, including a multiline `Input`, and uses the enabled primary
   *  submit `Button`. `'enter'` is Enter in a single-line `Input` and uses the
   *  form's first submit button. Without it no key submits. */
  submitHotkey?: 'mod+enter' | 'enter'
  /** Keeps the row of actions in view at the bottom of the nearest scrolling
   *  ancestor while the form scrolls. Place the submit `Button` directly inside
   *  a `Box` that is a direct child of `Form`. */
  stickyActions?: boolean
  /** Native `action` attribute: the URL the form submits to. */
  action?: string
  /** Native `method` attribute. */
  method?: "get" | "post" | "dialog"
  /** Native `name` attribute. */
  name?: string
  /** Native `novalidate` attribute. Skips the browser's validation on submit. */
  noValidate?: boolean
  /** Native `autocomplete` attribute. A field can set its own. */
  autoComplete?: "on" | "off"
  /** Native `target` attribute. */
  target?: string
  /** Native `enctype` attribute. */
  encType?: string
  /** Native `dir` attribute. The layout follows it. */
  dir?: "ltr" | "rtl" | "auto"
  /** Native `lang` attribute. */
  lang?: string
}

/**
 * Use `Form` for a form with responsive field labels, an optional submit
 * hotkey, and animated column changes. It renders `<a-form>` around a native
 * `<form>`. `className` and `style` go to `<a-form>`. Native attributes such
 * as `id`, `action`, and `method` go to the form, and `onSubmit` handles its
 * `submit` event.
 *
 * @example Basic usage
 * ```tsx
 * <Form submitHotkey="mod+enter" onSubmit={save}>
 *   <Input name="name" label="Name" required />
 *   <Input name="notes" label="Notes" multiline />
 *   <Button type="submit" priority="primary" label="Save" />
 * </Form>
 * ```
 *
 * @example Two columns with a sticky row of actions
 * ```tsx
 * <Form columns={2} stickyActions>
 *   <Input name="source" label="Source" />
 *   <Input name="hours" label="Max compute hours" />
 *   <Box display="flex" gap={8}>
 *     <Button type="submit" priority="primary" label="Launch" />
 *     <Button type="reset" label="Clear" />
 *   </Box>
 * </Form>
 * ```
 */
export const Form = ({ labelWidth, fieldMin, columns, submitHotkey, stickyActions, className, style, children, ...rest }: FormProps) => {
  const columnStyle = columns != null && Number.isFinite(columns) ? { ...style, '--form-columns': Math.max(1, Math.floor(columns)) } : style
  return (
    <a-form
      submit-hotkey={submitHotkey}
      sticky-actions={stickyActions ? '' : undefined}
      class={className}
      style={lengthStyle(labelWidth, '--form-label-width', lengthStyle(fieldMin, '--form-field-min', columnStyle as React.CSSProperties))}
    >
      <form {...rest as any}>
        {children}
      </form>
    </a-form>
  )
}
