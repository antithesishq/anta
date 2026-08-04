#!/usr/bin/env node
/**
 * Stops the `pnpm run dev` trees this repo started, including the optional
 * parallel instance. It never uses a blanket process-name match.
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const PIDFILES = ['.dev.pid', '.dev.parallel.pid']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function commandOf(pid) {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function descendants(root) {
  const childrenByParent = new Map()
  for (const line of execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)$/)
    if (!match) continue
    const pid = Number(match[1])
    const parent = Number(match[2])
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, [])
    childrenByParent.get(parent).push(pid)
  }

  const tree = []
  const walk = (pid) => {
    for (const child of childrenByParent.get(pid) ?? []) walk(child)
    tree.push(pid)
  }
  walk(root)
  return tree
}

async function stop(pidfile) {
  if (!existsSync(pidfile)) return false

  const root = Number.parseInt(readFileSync(pidfile, 'utf8').trim(), 10)
  if (!Number.isInteger(root) || root <= 0) {
    console.error(`${pidfile} did not contain a valid PID — removing it.`)
    unlinkSync(pidfile)
    return true
  }

  if (!alive(root)) {
    console.log(`Recorded dev process (pid ${root}) is not running — clearing stale ${pidfile}.`)
    unlinkSync(pidfile)
    return true
  }

  const rootCommand = commandOf(root)
  if (!/nodemon|anta-site|astro|pnpm/.test(rootCommand)) {
    console.log(`pid ${root} doesn't look like the dev server (\`${rootCommand || 'unknown'}\`) — refusing to kill it. Clearing stale ${pidfile}.`)
    unlinkSync(pidfile)
    return true
  }

  const tree = descendants(root)
  const signal = (name) => {
    for (const pid of tree) {
      try {
        process.kill(pid, name)
      } catch {
        // The process may already have exited.
      }
    }
  }

  console.log(`Stopping dev tree rooted at pid ${root} (${tree.length} process${tree.length === 1 ? '' : 'es'})…`)
  signal('SIGTERM')

  const deadline = Date.now() + 3000
  while (Date.now() < deadline && tree.some(alive)) await sleep(100)
  const survivors = tree.filter(alive)
  if (survivors.length) {
    console.log(`Force-killing ${survivors.length} straggler${survivors.length === 1 ? '' : 's'}…`)
    signal('SIGKILL')
  }

  if (existsSync(pidfile)) unlinkSync(pidfile)
  console.log('Dev stopped.')
  return true
}

const stopped = await Promise.all(PIDFILES.map(stop))
if (!stopped.some(Boolean)) console.log('No tracked dev server found.')
