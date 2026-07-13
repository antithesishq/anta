import { InputTime } from "@antadesign/anta"
import type { InputTimeProps } from "@antadesign/anta"

/**
 * Hydrated interactive `InputTime` for the docs previews — used as a
 * `client:only="preact"` island so the spinbutton segments (arrow stepping,
 * digit auto-advance, AM/PM toggle, min/max clamping) actually run; a static
 * `<Preview>` has no client runtime. `client:only` also avoids an SSR/hydration
 * mismatch from `navigator.language` differing server vs client.
 *
 * Forwards every prop to `InputTime`, so each example passes its own
 * `defaultValue` / `locale` / `hour12` / `min` / `max` / `size` / `status` / etc.
 */
export default function InputTimeDemo(props: InputTimeProps) {
  return <InputTime {...props} />
}
