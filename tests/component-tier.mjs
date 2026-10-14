import { test as nodeTest } from 'node:test'

export const componentTier = process.env.ANTA_COMPONENT_TEST_TIER ?? 'slow'
if (!['fast', 'slow'].includes(componentTier)) {
  throw new Error(`Unknown component test tier: ${componentTier}`)
}

export function componentEngines(engines) {
  if (componentTier === 'fast') return engines.filter(engine => engine.name() === 'chromium')
  return process.env.ANTA_TEST_WEBKIT === '0' ? engines.filter(engine => engine.name() === 'chromium') : engines
}

// Slow includes the fast regressions. Unselected cases are not registered, so
// node:test does not run their callbacks or report skips.
export function componentTest(name, options, fn) {
  if (typeof options === 'function') [options, fn] = [{}, options]
  const { tier = 'slow', ...nodeOptions } = options
  if (!['fast', 'slow'].includes(tier)) throw new Error(`Unknown test tier: ${tier}`)
  if (componentTier === 'fast' && tier !== 'fast') return
  return nodeTest(name, nodeOptions, fn)
}

componentTest.fast = (name, fn) => componentTest(name, {tier: 'fast'}, fn)
