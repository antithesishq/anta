// Shared across independently compiled entries, with listeners owned by the
// connected document and released after its last field disconnects.
export const MODALITY = Symbol.for('anta.input-focus-modality')
type Modality = { keyboard: boolean; readers: Set<() => void>; active?: () => void; key: () => void; pointer: () => void; refresh: () => void; frame?: number }
export type InputDocument = Document & { [MODALITY]?: Modality }
export function trackFocusModality(doc: InputDocument, reader: () => void) {
  let state = doc[MODALITY]
  if (!state) {
    const readers = new Set<() => void>()
    state = { keyboard: false, readers, key: () => {}, pointer: () => {}, refresh: () => {} }
    const current = state
    current.refresh = () => {
      if (!current.active || current.frame !== undefined) return
      current.frame = doc.defaultView?.requestAnimationFrame(() => {
        current.frame = undefined
        current.active?.()
      })
    }
    current.key = () => { current.keyboard = true; current.refresh() }
    current.pointer = () => { current.keyboard = false; current.refresh() }
    doc[MODALITY] = current
    doc.addEventListener('keydown', current.key, true)
    doc.addEventListener('pointerdown', current.pointer, true)
  }
  state.readers.add(reader)
  return () => {
    state.readers.delete(reader)
    if (state.active === reader) state.active = undefined
    if (state.readers.size) return
    if (state.frame !== undefined) doc.defaultView?.cancelAnimationFrame(state.frame)
    doc.removeEventListener('keydown', state.key, true)
    doc.removeEventListener('pointerdown', state.pointer, true)
    delete doc[MODALITY]
  }
}

