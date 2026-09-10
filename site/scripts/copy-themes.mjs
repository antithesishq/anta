import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const dest = new URL('../public/themes/', import.meta.url)
mkdirSync(dest, { recursive: true })
rmSync(new URL('anta.css', dest), { force: true })

for (const theme of ['antune', 'antithesis']) {
  const src = new URL(`../node_modules/@antadesign/anta/dist/theme-${theme}.css`, import.meta.url)
  if (!existsSync(src)) {
    console.error(`theme-${theme}.css not found at ${src.pathname} — build @antadesign/anta first (pnpm run build)`)
    process.exit(1)
  }
  copyFileSync(src, new URL(`${theme}.css`, dest))
  console.log(`copied theme-${theme}.css → public/themes/${theme}.css`)
}
