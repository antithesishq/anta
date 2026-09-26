export const axis = (id: string, values: readonly unknown[]) => ({
  id,
  choices: values.map(value => ({ id: String(value), props: { [id]: value } })),
})

export function caseCount(component: { axes: { choices: unknown[] }[] }) {
  return component.axes.reduce((total, item) => total * item.choices.length, 1)
}

export function decode(component: { fixture: Record<string, unknown>; axes: { choices: { props: Record<string, unknown> }[] }[] }, caseId: number) {
  let remainder = caseId
  const props = { ...component.fixture }
  for (let index = component.axes.length - 1; index >= 0; index--) {
    const item = component.axes[index]
    const choice = item.choices[remainder % item.choices.length]
    remainder = Math.floor(remainder / item.choices.length)
    Object.assign(props, choice.props)
  }
  return props
}
