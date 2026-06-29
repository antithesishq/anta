import { Calendar } from "@antadesign/anta"

/**
 * Hydrated interactive Calendar for the docs "Selecting a date" preview. Rendered
 * as a `client:only="preact"` island so the wrapper actually runs — month-switch
 * (chevrons), edge keyboard navigation, and selection all re-render live, which a
 * static `<Preview>` (no client runtime) can't do. `client:only` also avoids an
 * SSR/hydration mismatch from `Temporal.Now` / `navigator.language` differing
 * between the server render and the browser.
 *
 * `defaultValue` is a non-today date so the preview shows both states at once:
 * the selected day (tertiary + selected) and today (a secondary Button).
 */
export default function CalendarDemo() {
  return <Calendar defaultValue="2026-06-12" />
}
