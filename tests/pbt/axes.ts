type Component = { fixture: Record<string, unknown>; axes: Record<string, readonly unknown[]> }

export function caseCount(component: Component) {
  return Object.values(component.axes).reduce((total, values) => total * values.length, 1)
}

export function decode(component: Component, caseId: number) {
  let remainder = caseId
  const props = { ...component.fixture }
  const axes = Object.entries(component.axes)
  for (let index = axes.length - 1; index >= 0; index--) {
    const [name, values] = axes[index]
    props[name] = values[remainder % values.length]
    remainder = Math.floor(remainder / values.length)
  }
  return props
}
