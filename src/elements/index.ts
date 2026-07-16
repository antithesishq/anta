/**
 * Barrel: registers ALL Anta custom elements (the convenience path).
 *
 * Each `a-{name}` module self-registers and imports its own CSS when loaded,
 * so re-exporting them here (which evaluates each module) registers the whole
 * set + injects every element's CSS. Importing this barrel for side effects —
 * `import '@antadesign/anta/elements'` — gives you everything.
 *
 * For a SMALLER footprint, import just the element(s) you use instead:
 *   import '@antadesign/anta/elements/a-tooltip'   // registers a-tooltip + its CSS, nothing else
 * That granular path pulls in only that element's code and CSS, nothing else.
 *
 * Must only be imported client-side — registration is guarded against missing
 * `customElements` (SSR), but there's no reason to load it server-side.
 */
export { AProgressElement, register_a_progress } from './a-progress'
export { ATextElement, register_a_text } from './a-text'
export { AIconElement, register_a_icon } from './a-icon'
export { AButtonElement, register_a_button } from './a-button'
export { ACheckboxElement, register_a_checkbox } from './a-checkbox'
export { AExpanderElement, register_a_expander } from './a-expander'
export { ATooltipElement, register_a_tooltip } from './a-tooltip'
export { AInputElement, register_a_input } from './a-input'
export { AInputTimeElement, register_a_input_time } from './a-input-time'
export { ACalendarElement, register_a_calendar } from './a-calendar'
export { ARadioElement, register_a_radio } from './a-radio'
export { ARadioGroupElement, register_a_radio_group } from './a-radio-group'
export { AMenuElement, register_a_menu } from './a-menu'
export { AMenuItemElement, register_a_menu_item } from './a-menu-item'
export { AMenuSeparatorElement, register_a_menu_separator } from './a-menu-separator'
export { AMenuGroupElement, register_a_menu_group } from './a-menu-group'
export { ATabElement, register_a_tab } from './a-tab'
export { ATabsElement, register_a_tabs } from './a-tabs'
export { ATabPanelElement, register_a_tabpanel } from './a-tabpanel'
export { ADialogElement, register_a_dialog } from './a-dialog'
export { ACardElement, register_a_card } from './a-card'

// `a-title` and `a-tag` are CSS-only styled tags (no JS / no element module), so
// their styles can't ride along on a module import — load them here directly.
import './a-title.css'
import './a-tag.css'
