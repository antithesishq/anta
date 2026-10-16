// Shared by JSX wrappers and UI elements without registering any element.
export const CLEAR_TRIGGER = 'clearrequest'
export const CLEAR_CLICK_EVENT = 'clearclick'
export const CLEAR_INPUT_EVENT = 'clearinput'

export function ownsInputClearRequest(host: Element, event: Event): boolean {
  return event.composedPath().find(node => {
    const name = (node as Element)?.localName
    return name === 'a-input' || name === 'a-input-time'
  }) === host
}
