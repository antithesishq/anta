import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import ts from 'typescript'

test('Box accepts the eight observation selections and rejects unchecked JSX values', () => {
  const config = ts.readConfigFile('src/tsconfig.json', ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve('src'))
  const program = ts.createProgram(['tests/box-types.fixture.ts'], {
    ...parsed.options, rootDir: resolve('.'), noEmit: true,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => '\n',
  }))
})
