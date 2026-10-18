/** @internal Replay consumer inputs during custom-element construction, including detached upgrades.
 * Deleting the own property exposes the element's reflecting setter. */
export function upgradeValueProperties(element: HTMLElement) {
  const inputs = element as unknown as Record<string, unknown>
  for (const name of ['value', 'defaultValue']) {
    if (!Object.prototype.hasOwnProperty.call(inputs, name)) continue
    const value = inputs[name]
    delete inputs[name]
    inputs[name] = value
  }
}
