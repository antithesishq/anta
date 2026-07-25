/**
 * copy-theme-anta.mjs — copy the built @antadesign/anta/theme-anta.css into
 * site/public/ so the sidebar theme switcher can toggle it as a `<link>` at
 * `/theme-anta.css`. Runs as part of the `docs` pre-step, and re-runs on every
 * package rebuild via the root dev watcher, so it tracks the source.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../node_modules/@antadesign/anta/dist/theme-anta.css', import.meta.url))
const dest = fileURLToPath(new URL('../public/theme-anta.css', import.meta.url))

if (!existsSync(src)) {
  console.error(`theme-anta.css not found at ${src} — build @antadesign/anta first (pnpm run build)`)
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`copied theme-anta.css → ${dest}`)
