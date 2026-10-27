export default `import { Tooltip, Button } from '@antadesign/anta'

function Demo() {
  return (
    <div className="container">
      <Button label="Hover me">
        <Tooltip delay={300}>Edit my props or code</Tooltip>
      </Button>
    </div>
  )
}
`

export const containEventsDemoCode = `import { Tooltip, Button, Checkbox, Text } from '@antadesign/anta'
import { useEffect, useRef, useState } from 'preact/hooks'

function Demo() {
  const parent = useRef(null)
  const [contain, setContain] = useState(true)
  const [wheels, setWheels] = useState(0)
  const [clicks, setClicks] = useState(0)

  useEffect(() => {
    const element = parent.current
    const onWheel = event => {
      event.preventDefault()
      setWheels(count => count + 1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="event-demo">
      <Checkbox checked={contain} onStateChange={(_, { next }) => setContain(next === true)}>
        Contain tooltip events
      </Checkbox>
      <div ref={parent} className="event-parent" onClick={() => setClicks(count => count + 1)}>
        <Button label="Event containment help">
          <Tooltip interactive containEvents={contain} className="event-tooltip">
            <div>
              <a href="#tooltip-end">Jump to the final note</a>
              {Array.from({ length: 12 }, (_, index) => (
                <p>{'Note ' + (index + 1) + ': Scroll inside this bubble to compare event containment.'}</p>
              ))}
              <p id="tooltip-end">You reached the final note.</p>
            </div>
          </Tooltip>
        </Button>
        <p>This parent cancels wheel events and counts clicks.</p>
        <Text>Parent wheel events: {wheels}</Text>
        <Text>Parent clicks: {clicks}</Text>
      </div>
    </div>
  )
}
`
