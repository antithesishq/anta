import { Database, test, type TestCase } from '@hegeldev/hegel'
import * as gs from '@hegeldev/hegel/generators'
import type { FixtureDescription } from './AppFixture'

export const fixtureTypes = ['button', 'checkbox', 'radio-group', 'switch', 'slider', 'tabs', 'input', 'calendar', 'select', 'dialog', 'expander', 'plot'] as const

export const minimumFixtures = 6
export const maximumFixtures = fixtureTypes.length

function pick<T>(tc: TestCase, values: readonly T[]): T {
  return tc.draw(gs.sampledFrom(values))
}

// Keep most controls usable. These draws are generation preferences, not checks.
function occasionally(tc: TestCase): boolean {
  return tc.draw(gs.integers({ minValue: 0, maxValue: 9 })) === 0
}

function drawFixture(tc: TestCase, id: string, type: typeof fixtureTypes[number]): FixtureDescription {
  switch (type) {
    case 'button': return { id, type, props: { disabled: occasionally(tc), loading: occasionally(tc) } }
    case 'checkbox': return { id, type, props: {
      disabled: occasionally(tc), defaultChecked: pick(tc, [false, true, 'indeterminate'] as const),
    } }
    case 'radio-group': return { id, type, props: {
      disabled: occasionally(tc), defaultValue: pick(tc, ['', 'email', 'push']),
    } }
    case 'switch': return { id, type, props: {
      disabled: occasionally(tc), defaultChecked: tc.draw(gs.booleans()),
    } }
    case 'slider': return { id, type, props: {
      min: pick(tc, [-50, 0, 20]), max: pick(tc, [80, 100]), step: pick(tc, [1, 5, 10]),
      disabled: occasionally(tc),
    } }
    case 'tabs': return { id, type, props: {
      disabled: occasionally(tc), defaultValue: pick(tc, ['overview', 'activity']),
    } }
    case 'input': return { id, type, props: { disabled: occasionally(tc), readOnly: occasionally(tc), clearable: tc.draw(gs.booleans()) } }
    case 'calendar': return { id, type, props: {
      disabled: occasionally(tc), defaultValue: pick(tc, ['2026-06-15', '2026-07-15', '2026-08-15']),
      locale: pick(tc, ['en-US', 'en-GB'] as const),
    } }
    case 'select': return { id, type, props: {
      disabled: occasionally(tc), clearable: tc.draw(gs.booleans()), defaultValue: pick(tc, [null, 'apple', 'orange']),
    } }
    case 'dialog': return { id, type, props: { persistent: tc.draw(gs.booleans()), closable: tc.draw(gs.booleans()) } }
    case 'expander': return { id, type, props: { disabled: occasionally(tc) } }
    case 'plot': return { id, type, props: { zoomPan: !occasionally(tc), height: pick(tc, [180, 240, 320]) } }
  }
}

function drawProps(tc: TestCase, fixture: FixtureDescription): FixtureDescription {
  switch (fixture.type) {
    case 'button': {
      const prop = pick(tc, ['disabled', 'loading'] as const)
      return { ...fixture, props: { ...fixture.props, [prop]: !fixture.props[prop] } }
    }
    case 'input': {
      const prop = pick(tc, ['disabled', 'readOnly', 'clearable'] as const)
      return { ...fixture, props: { ...fixture.props, [prop]: !fixture.props[prop] } }
    }
    case 'select': {
      const prop = pick(tc, ['disabled', 'clearable'] as const)
      return { ...fixture, props: { ...fixture.props, [prop]: !fixture.props[prop] } }
    }
    case 'dialog': {
      const prop = pick(tc, ['persistent', 'closable'] as const)
      return { ...fixture, props: { ...fixture.props, [prop]: !fixture.props[prop] } }
    }
    case 'calendar': {
      const prop = pick(tc, ['disabled', 'locale'] as const)
      return { ...fixture, props: { ...fixture.props, [prop]: prop === 'disabled'
        ? !fixture.props.disabled : fixture.props.locale === 'en-US' ? 'en-GB' : 'en-US' } }
    }
    case 'plot': {
      const prop = pick(tc, ['zoomPan', 'points', 'height'] as const)
      if (prop === 'zoomPan') return { ...fixture, props: { ...fixture.props, zoomPan: !fixture.props.zoomPan } }
      if (prop === 'height') return { ...fixture, props: { ...fixture.props, height: pick(tc, [180, 240, 320].filter(height => height !== fixture.props.height)) } }
      const points = Array.from({ length: tc.draw(gs.integers({ minValue: 3, maxValue: 12 })) }, (_, x) => ({
        x, y: tc.draw(gs.integers({ minValue: 0, maxValue: 100 })),
      }))
      return { ...fixture, props: { ...fixture.props, points } }
    }
    case 'switch':
      return { ...fixture, props: { ...fixture.props, disabled: !fixture.props.disabled } }
    case 'slider':
    case 'checkbox':
    case 'radio-group':
    case 'tabs':
    case 'expander':
      return { ...fixture, props: { ...fixture.props, disabled: !fixture.props.disabled } }
  }
}

export function generateNextFixtures(current: FixtureDescription[], seed: number, revision: number, onlyPlot = false): FixtureDescription[] {
  let next: FixtureDescription[] | undefined
  test((tc) => {
    if (onlyPlot) {
      next = current.length === 0 ? [drawFixture(tc, `fixture-${revision}`, 'plot')]
        : pick(tc, [0, 1, 1, 1, 1, 1]) === 0 ? [] : [drawProps(tc, current[0])]
      return
    }
    if (current.length === 0) {
      const count = tc.draw(gs.integers({ minValue: minimumFixtures, maxValue: maximumFixtures }))
      const available = [...fixtureTypes]
      next = Array.from({ length: count }, (_, index) => {
        const type = pick(tc, available)
        available.splice(available.indexOf(type), 1)
        return drawFixture(tc, `fixture-${revision}-${index}`, type)
      })
      return
    }

    const available = fixtureTypes.filter(type => !current.some(fixture => fixture.type === type))

    const change = pick(tc, [
      'props', 'props', 'props',
      ...(available.length > 0 ? ['mount'] : []),
      ...(current.length > minimumFixtures ? ['unmount'] : []),
    ])
    if (change === 'mount') {
      next = [...current, drawFixture(tc, `fixture-${revision}`, pick(tc, available))]
      return
    }
    const target = pick(tc, current)
    next = change === 'unmount'
      ? current.filter(fixture => fixture.id !== target.id)
      : current.map(fixture => fixture.id === target.id ? drawProps(tc, fixture) : fixture)
  }, { seed, testCases: 1, database: Database.disabled })
  if (!next) throw new Error('Hegel did not generate a fixture list.')
  return next
}
