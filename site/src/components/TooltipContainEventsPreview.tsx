import { Tooltip, Button, Checkbox, Text } from '@antadesign/anta'
import { useEffect, useRef, useState } from 'preact/hooks'
import styles from './TooltipContainEventsPreview.module.css'
import { useElements } from './useElements'

export function TooltipContainEventsPreview() {
  useElements()
  const parent = useRef<HTMLDivElement>(null)
  const [contain, setContain] = useState(true)
  const [wheels, setWheels] = useState(0)
  const [clicks, setClicks] = useState(0)

  useEffect(() => {
    const element = parent.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setWheels(count => count + 1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className={styles.demo}>
      <Checkbox checked={contain} onStateChange={(_, { next }) => setContain(next === true)}>
        Contain tooltip events
      </Checkbox>
      <div ref={parent} className={styles.parent} onClick={() => setClicks(count => count + 1)}>
        <Button label="Event containment help">
          <Tooltip interactive containEvents={contain ? 'native' : false} className={styles.tooltip}>
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
