import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DefaultTheme, JSX } from 'typedoc'

class AntaTheme extends DefaultTheme {}

const asset = (name) => fileURLToPath(new URL(name, import.meta.url))

export function load(app) {
  app.renderer.defineTheme('anta', AntaTheme)

  app.renderer.hooks.on('head.end', (context) => {
    if (!(context.theme instanceof AntaTheme)) return
    return JSX.createElement(JSX.Fragment, null,
      JSX.createElement('link', { rel: 'stylesheet', href: context.relativeURL('assets/anta-theme.css', true) }),
      JSX.createElement('script', { defer: true, src: context.relativeURL('assets/anta-theme.js', true) }),
    )
  })

  app.renderer.postRenderAsyncJobs.push(async ({ outputDirectory }) => {
    if (!(app.renderer.theme instanceof AntaTheme)) return
    const output = join(outputDirectory, 'assets')
    await mkdir(output, { recursive: true })
    await Promise.all([
      copyFile(asset('./theme.css'), join(output, 'anta-theme.css')),
      copyFile(asset('./client.js'), join(output, 'anta-theme.js')),
    ])
  })
}
