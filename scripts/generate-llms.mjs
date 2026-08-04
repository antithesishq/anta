import { writeFile } from 'node:fs/promises'
import { llmsIndex } from '../site/lib/llms/index-content.mjs'

await writeFile(new URL('../llms.txt', import.meta.url), llmsIndex)

console.log('generated llms.txt')
