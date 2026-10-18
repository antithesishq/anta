import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import ts from 'typescript'
import { componentTest as test } from './component-tier.mjs'

test.fast('Select callbacks account for clearing without widening ordinary picks or multiple arrays', () => {
  const config = ts.readConfigFile('src/tsconfig.json', ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve('src'))
  const consumer = process.env.ANTA_SELECT_CONSUMER_ROOT
  const program = ts.createProgram(['tests/select-types.fixture.tsx'], {
    ...parsed.options, rootDir: resolve('.'), noEmit: true,
    ...(consumer ? { paths: {
      '@antadesign/anta': [resolve(consumer, 'node_modules/@antadesign/anta/dist/index.d.ts')],
      '@antadesign/anta/*': [resolve(consumer, 'node_modules/@antadesign/anta/dist/*')],
    } } : {}),
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => '\n',
  }))
})
