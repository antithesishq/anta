import { render } from 'preact'
import Playground from './Playground'

type PlaygroundProps = Parameters<typeof Playground>[0]

function mountPlaygrounds() {
  for (const host of document.querySelectorAll<HTMLElement>('[data-anta-playground]')) {
    if (host.dataset.antaPlaygroundMounted) continue

    const serializedProps = host.dataset.antaPlayground
    if (!serializedProps) continue

    try {
      const props = JSON.parse(serializedProps) as PlaygroundProps
      host.dataset.antaPlaygroundMounted = ''
      render(<Playground {...props} />, host)
    } catch (error) {
      // Preserve an empty host rather than breaking the rest of the docs page
      // if a hand-authored page happens to contain malformed serialized props.
      console.error('Could not mount the Playground.', error)
    }
  }
}

// The docs client router executes a script URL only once per session. Listen
// for every navigation so this one runtime mounts fresh Playground hosts after
// each page swap as well as on the first document.
document.addEventListener('astro:page-load', mountPlaygrounds)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPlaygrounds, { once: true })
} else {
  mountPlaygrounds()
}
