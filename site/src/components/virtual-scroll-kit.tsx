import { useEffect } from 'preact/hooks'

/** Registers `<a-virtual-scroll>` from its package, after the island mounts in the browser. */
export function useVirtualScrollElement() {
  useEffect(() => { import('@antadesign/virtual-scroll/elements/a-virtual-scroll') }, [])
}

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ')

/** Deterministic text per row, so a row always has the same height. About one row in seven wraps over several lines. */
export function rowText(index: number, words = 0): string {
  let s = (index * 2654435761) % 2 ** 32
  const length = words || 3 + (s % 7 === 0 ? 50 : s % 16)
  const out: string[] = []
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    out.push(WORDS[s % WORDS.length])
  }
  return out.join(' ')
}
