import { InputDate } from "@antadesign/anta"
import type { InputDateProps } from "@antadesign/anta"

/**
 * Hydrated interactive `InputDate` for the docs previews — used as a
 * `client:only="preact"` island so typing, parse-on-commit, and the calendar
 * menu actually run (a static `<Preview>` has no client runtime). `client:only`
 * also avoids an SSR/hydration mismatch from `navigator.language` differing
 * server vs client.
 *
 * It forwards every prop to `InputDate`, so each example passes its own
 * `defaultValue` / `min` / `max` / `locale` / `size` / `label` / `disabled`.
 */
export default function InputDateDemo(props: InputDateProps) {
  return <InputDate {...props} />
}
