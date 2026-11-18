// Shared by JSX wrappers and UI elements without registering any element.
export const CLEAR_TRIGGER = 'clearrequest'
export const CLEAR_CLICK_EVENT = 'clearclick'
export const CLEAR_INPUT_EVENT = 'clearinput'
export const INPUT_FORM_RESET_EVENT = 'inputformreset'

/** Submitted value independent of an Input's displayed text. Arrays submit
 * repeated entries under the field name; null omits the field. */
export type InputFormValue = string | number | boolean | readonly (string | number | boolean)[] | null

export function ownsInputClearRequest(host: Element, event: Event): boolean {
  return event.composedPath().find(node => {
    const name = (node as Element)?.localName
    return name === 'a-input' || name === 'a-input-time'
  }) === host
}

/** @internal JSX property assignment need not reflect a value attribute.
 * The wrapper declares ownership, including release after SSR; raw elements use
 * attribute presence. Composed fields declare their outer owner's mode. */
export function inputValueIsControlled(host: Element): boolean {
  const mode = host.getAttribute('data-anta-value-mode')
  return mode === 'controlled' || (mode !== 'uncontrolled' && host.hasAttribute('value'))
}
