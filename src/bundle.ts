/**
 * Full browser entry point for applications that prefer one Anta runtime and
 * stylesheet over granular imports. It registers every custom element and
 * re-exports the JSX API from `@antadesign/anta/bundle`.
 *
 * Pair it with `@antadesign/anta/bundle.css`.
 */
import "./tokens.css"
import "./reset.css"
import "./elements"

export * from "./index"
