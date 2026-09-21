import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildSearchIndex } from '../scripts/build-search-index.mjs'
import { buildSearchWorker } from '../scripts/build-search-worker.mjs'
import { copySitemapIndex } from '../scripts/copy-sitemap-index.mjs'

function prepare(root) {
  // Astro sets NODE_ENV before loading integrations. Keep preparation in the
  // same environment as the standalone publishing and dev-watcher commands.
  const env = { ...process.env }
  delete env.NODE_ENV
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('scripts/prepare.mjs', root)), 'docs'], {
      cwd: root, env, stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`Site preparation failed (${signal ?? code})`))
    })
  })
}

/** Complete the static site through Astro's build and development lifecycle. */
export default function siteBuild() {
  let command
  let config
  return {
    name: 'anta-site-build',
    hooks: {
      'astro:config:setup': (options) => { command = options.command },
      'astro:config:done': async (options) => {
        config = options.config
        // Generated imports must exist before content sync, which precedes
        // astro:build:start. Preview only serves the already-built output.
        if (['build', 'dev', 'sync'].includes(command)) await prepare(config.root)
      },
      'astro:build:done': async ({ dir }) => {
        // Keep this integration after Sitemap. Await every writer even when
        // one fails, so a failed build cannot leave background output writes.
        const results = await Promise.allSettled([
          buildSearchIndex({ outDir: dir, publicDir: config.publicDir }),
          buildSearchWorker({ root: config.root, outDir: dir }),
          copySitemapIndex({ outDir: dir }),
        ])
        const failed = results.find(result => result.status === 'rejected')
        if (failed) throw failed.reason
      },
    },
  }
}
