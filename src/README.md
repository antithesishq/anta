# Anta

Anta provides UI components for React, Preact, and custom JSX runtimes. It combines
CSS-only components with custom elements for browser behavior.

In a client-only React application, load the full bundle and its stylesheet:

```tsx
import '@antadesign/anta/bundle.css'
import { Progress } from '@antadesign/anta/bundle'

<Progress value={42} max={100} label="Upload" />
```

Follow [Install and configure](../docs/install-config.md) for Preact, server
rendering, custom runtime hooks, granular imports, and raw HTML usage.

See [the component architecture guide](AGENTS.md) for source and build conventions.
