import { Calendar } from "@antadesign/anta"
import type { CalendarProps } from "@antadesign/anta"

/**
 * Hydrated interactive `Calendar` for the docs previews — used as a
 * `client:only="preact"` island so month-switch (chevrons), keyboard navigation,
 * and day selection actually run (a static `<Preview>` has no client runtime and
 * can't re-render a new month). `client:only` also avoids an SSR/hydration
 * mismatch from `Temporal.Now` / `navigator.language` differing server vs client.
 */
export default function CalendarDemo(props: CalendarProps) {
  return <Calendar {...props} />
}
