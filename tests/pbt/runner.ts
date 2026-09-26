import type { Page } from 'playwright'
import { caseCount, decode } from './axes'
import button from './components/button'

async function preview(page: Page, caseId: number) {
  const stage = page.locator(`[data-compile-status="ready"][data-model="Button"][data-case="${caseId}"]`)
  await stage.waitFor()
  return stage
}

export async function run(
  page: Page,
  origin: string,
  snapshot: (value: { caseId: number; action: string; dom: string; violations: { property: string; message: string }[] }) => void | Promise<void> = () => {},
  caseLimit = Infinity,
  caseStart = 0,
  caseStep = 1,
) {
  const totalCases = caseCount(button)
  if (caseStart >= totalCases) return { cases: 0, actions: 0 }
  const cases = Math.min(Math.ceil((totalCases - caseStart) / caseStep), caseLimit)
  let actionCount = 0
  const url = new URL('/test/', origin)
  url.searchParams.set('model', 'Button')
  url.searchParams.set('case', String(caseStart))
  url.searchParams.set('navigation', 'true')
  url.searchParams.set('navigationStep', String(caseStep))
  await page.goto(url.href)

  for (let caseId = caseStart, completed = 0; caseId < totalCases && completed < cases; caseId += caseStep, completed++) {
    const stage = await preview(page, caseId)
    const root = stage.locator('#harness-target')
    await root.waitFor()
    const props = decode(button, caseId)
    const check = async (action: string) => {
      const violations: { property: string; message: string }[] = []
      for (const property of button.properties) {
        try {
          const message = await property.run({ control: root, props, action })
          if (message) violations.push({ property: property.name, message })
        } catch (error) {
          violations.push({ property: property.name, message: String(error) })
        }
      }
      if (violations.length) {
        const dom = await root.evaluate(element => element.outerHTML)
        await snapshot({ caseId, action, dom, violations })
      }
    }

    await check('render')
    for (const action of button.actions) {
      await action.run(page, root)
      await check(action.name)
      actionCount++
    }
    if (caseId + caseStep < totalCases && completed + 1 < cases)
      await page.getByRole('navigation', { name: 'Case navigation' }).getByRole('button', { name: 'Next' }).click()
  }

  return { cases, actions: actionCount }
}
