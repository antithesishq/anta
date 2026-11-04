import { useLayoutEffect, useState, type ComponentProps } from 'react'
import { fixtureTypes, generateNextFixtures } from './generate'
import { Button } from './button/Button'
import { Checkbox } from './checkbox/Checkbox'
import { RadioGroup } from './radio-group/RadioGroup'
import { Switch } from './switch/Switch'
import { Slider } from './slider/Slider'
import { Tabs } from './tabs/Tabs'
import { Input } from './input/Input'
import { Calendar } from './calendar/Calendar'
import { Select } from './select/Select'
import { Dialog } from './dialog/Dialog'
import { Expander } from './expander/Expander'
import { Plot } from './plot/Plot'
import './AppFixture.css'

const fixtureNames = {
  button: 'Button', checkbox: 'Checkbox', 'radio-group': 'RadioGroup',
  switch: 'Switch', slider: 'Slider', tabs: 'Tabs', input: 'Input',
  calendar: 'Calendar', select: 'Select', dialog: 'Dialog',
  expander: 'Expander', plot: 'Plot',
} satisfies Record<typeof fixtureTypes[number], string>

type PropsByType = {
  'button': Omit<ComponentProps<typeof Button>, 'id'>
  'checkbox': Omit<ComponentProps<typeof Checkbox>, 'id'>
  'radio-group': Omit<ComponentProps<typeof RadioGroup>, 'id'>
  'switch': Omit<ComponentProps<typeof Switch>, 'id'>
  'slider': Omit<ComponentProps<typeof Slider>, 'id'>
  'tabs': Omit<ComponentProps<typeof Tabs>, 'id'>
  'input': Omit<ComponentProps<typeof Input>, 'id'>
  'calendar': Omit<ComponentProps<typeof Calendar>, 'id'>
  'select': Omit<ComponentProps<typeof Select>, 'id'>
  'dialog': Omit<ComponentProps<typeof Dialog>, 'id'>
  'expander': Omit<ComponentProps<typeof Expander>, 'id'>
  'plot': Omit<ComponentProps<typeof Plot>, 'id'>
}

export type FixtureDescription = {
  [K in keyof PropsByType]: { id: string; type: K; props: PropsByType[K] }
}[keyof PropsByType]

function renderFixture(fixture: FixtureDescription) {
  switch (fixture.type) {
    case 'button': return <Button {...fixture.props} id={fixture.id} />
    case 'checkbox': return <Checkbox {...fixture.props} id={fixture.id} />
    case 'radio-group': return <RadioGroup {...fixture.props} id={fixture.id} />
    case 'switch': return <Switch {...fixture.props} id={fixture.id} />
    case 'slider': return <Slider {...fixture.props} id={fixture.id} />
    case 'tabs': return <Tabs {...fixture.props} id={fixture.id} />
    case 'input': return <Input {...fixture.props} id={fixture.id} />
    case 'calendar': return <Calendar {...fixture.props} id={fixture.id} />
    case 'select': return <Select {...fixture.props} id={fixture.id} />
    case 'dialog': return <Dialog {...fixture.props} id={fixture.id} />
    case 'expander': return <Expander {...fixture.props} id={fixture.id} />
    case 'plot': return <Plot {...fixture.props} id={fixture.id} />
  }
}

type AppState = {
  fixtures: FixtureDescription[]
  revision: number
  seed: number
  onlyPlot: boolean
}
export default function AppFixture() {
  const [state, setState] = useState<AppState>(() => {
    const params = new URLSearchParams(location.search)
    const input = params.get('seed')
    const onlyPlot = params.get('only') === 'plot'
    const parsed = input?.trim() ? Number(input) : NaN
    const seed = Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 0xffff_ffff
      ? parsed
      : crypto.getRandomValues(new Uint32Array(1))[0]
    return { fixtures: generateNextFixtures([], seed, 0, onlyPlot), revision: 0, seed, onlyPlot }
  })
  useLayoutEffect(() => {
    function advance() {
      setState(current => {
        const revision = current.revision + 1
        return {
          ...current,
          fixtures: generateNextFixtures(current.fixtures, (current.seed + revision) >>> 0, revision, current.onlyPlot),
          revision,
        }
      })
    }
    window.addEventListener('fixture:advance', advance)
    return () => window.removeEventListener('fixture:advance', advance)
  }, [])

  return <main data-app-fixture data-app-revision={state.revision}>
    <header>
      <h1>Component fixtures</h1>
      <output>Seed: {state.seed} · App updates: {state.revision}</output>
    </header>
    <form data-fixture-form onSubmit={event => event.preventDefault()}>
      <div data-fixture-list>
        {state.fixtures.map((fixture) => <article key={fixture.id} data-fixture-card={fixture.id} data-fixture-type={fixture.type}>
          <h2>{fixtureNames[fixture.type]}</h2>
          {renderFixture(fixture)}
        </article>)}
      </div>
    </form>
  </main>
}
