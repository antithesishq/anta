import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Anta's component modules are consumed through a bundler, including during SSR.
await build({
    stdin: {
        contents: `
            export { configure } from '@antadesign/anta/jsx-runtime'
            export { Plot, PlotSurface, scatter } from './dist/index.js'
            export { PlotHost } from './src/integrations/plot_host.ts'
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['react'],
    outfile: fileURLToPath(new URL('../.build/components-test.mjs', import.meta.url)),
})
export const { configure, Plot, PlotSurface, scatter, PlotHost } = await import('../.build/components-test.mjs')
