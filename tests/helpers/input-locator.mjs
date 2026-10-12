export function fieldByLabel(page, name) {
  const text = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  return page.locator('a-input').filter({
    has: page.locator(':scope > [slot="label"]').filter({ hasText: text }),
  })
}

export function inputByLabel(page, name) {
  return fieldByLabel(page, name).locator(':scope > [part="field"] > [part="input"]')
}
