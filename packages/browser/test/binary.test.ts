// Every source is explicit, so no case depends on what this machine has installed.

import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import { lookupBinary } from '../src/binary.js'

const root = mkdtempSync(join(tmpdir(), 'lightpanda-node-'))

const executable = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  chmodSync(path, 0o755)
  return path
}

const fake = (name: string) => executable(join(root, name, 'lightpanda'), '\x7fELF not really')

// Node scripts on PATH (this package's own `lightpanda` CLI) are skipped.
const shimDir = dirname(executable(join(root, 'shim', 'lightpanda'), '#!/usr/bin/env node\n'))
const pathDir = dirname(fake('path'))
const missing = join(root, 'nope')

test('the lookup order', () => {
  const env: Record<string, string> = { PATH: shimDir }
  const sources = { env, cachePath: missing }
  expect(() => lookupBinary(undefined, sources)).toThrow(/binary not found/)

  env.PATH = [shimDir, pathDir].join(delimiter)
  expect(lookupBinary(undefined, sources)).toBe(join(pathDir, 'lightpanda'))

  const bundled = fake('bundled')
  expect(lookupBinary(undefined, { ...sources, bundledPath: bundled })).toBe(bundled)

  // A 1.x install left no version marker: it only beats PATH, not the bundled binary.
  const cached = fake('cache')
  expect(lookupBinary(undefined, { env, cachePath: cached, bundledPath: bundled })).toBe(bundled)
  expect(lookupBinary(undefined, { env, cachePath: cached })).toBe(cached)

  writeFileSync(join(dirname(cached), 'version'), '0.4.1\n')
  expect(lookupBinary(undefined, { env, cachePath: cached, bundledPath: bundled })).toBe(cached)

  env.LIGHTPANDA_BIN = fake('bin')
  expect(lookupBinary(undefined, { env, cachePath: cached })).toBe(env.LIGHTPANDA_BIN)

  env.LIGHTPANDA_EXECUTABLE_PATH = fake('legacy')
  expect(lookupBinary(undefined, { env, cachePath: cached })).toBe(env.LIGHTPANDA_EXECUTABLE_PATH)

  const explicit = fake('explicit')
  expect(lookupBinary(explicit, { env, cachePath: cached })).toBe(explicit)
})

test('a missing LIGHTPANDA_EXECUTABLE_PATH or explicit path is an error', () => {
  const sources = { env: { LIGHTPANDA_EXECUTABLE_PATH: missing }, cachePath: fake('cache') }
  expect(() => lookupBinary(undefined, sources)).toThrow(/LIGHTPANDA_EXECUTABLE_PATH/)
  expect(() => lookupBinary(missing, sources)).toThrow(/not found at/)
})
