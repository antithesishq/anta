import { useEffect, useState } from 'preact/hooks'
import { Loader } from '@antadesign/anta'

/** Docs-only preview of a slow, repeating determinate Loader cycle. */
export default function AnimatedLoader() {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setValue((current) => (current + 1) % 101), 100)
    return () => clearInterval(id)
  }, [])

  return <Loader value={value} label="Processing records" />
}
