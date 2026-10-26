/** Track the assigned actions without observing their labels or descendants. */
export function inputTrailingActions(
  host: HTMLElement,
  slot: HTMLSlotElement,
  groupTag: string,
  apply: (actions: boolean) => void,
) {
  let observer: MutationObserver | undefined

  const sync = () => {
    if (!host.isConnected) return
    observer?.disconnect()
    let hasAction = false
    const onlyActions = (nodes: Iterable<Node>): boolean => {
      for (const node of nodes) {
        if (node.nodeType === 3 && node.textContent?.trim()) return false
        if (node.nodeType !== 1) continue
        const element = node as Element
        if (element.localName === groupTag) {
          const view = host.ownerDocument.defaultView ?? window
          observer ??= new view.MutationObserver(sync)
          observer.observe(element, { childList: true })
          // Direct text can change in place without changing the child list.
          for (const child of element.childNodes) {
            if (child.nodeType === 3) observer.observe(child, { characterData: true })
          }
          if (!onlyActions(element.childNodes)) return false
        } else if (element.localName === 'a-button' || element.localName === 'button' || element.matches('a[role="button"][data-anta]')) {
          hasAction = true
        } else return false
      }
      return true
    }
    apply(onlyActions(slot.assignedNodes()) && hasAction)
  }

  return {
    sync,
    disconnect() {
      observer?.disconnect()
      observer = undefined
    },
  }
}
