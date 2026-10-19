// `lightpanda.fetch` against a stand-in binary whose output and exit code the
// tests choose.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ProcessError } from '../src/errors.js'
import { fetch } from '../src/fetch.js'

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'output.mjs')
const KEYS = ['LIGHTPANDA_EXECUTABLE_PATH', 'LP_FIXTURE_BYTES', 'LP_FIXTURE_EXIT'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
  process.env.LIGHTPANDA_EXECUTABLE_PATH = OUTPUT
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

test('a dump larger than the 1 MiB exec buffer comes back whole', async () => {
  process.env.LP_FIXTURE_BYTES = String(5 * 1024 * 1024)
  const out = await fetch('https://example.com')
  expect(out).toHaveLength(5 * 1024 * 1024)
})

test('a failing binary rejects with ProcessError and its stderr', async () => {
  process.env.LP_FIXTURE_EXIT = '3'
  const err = await fetch('https://example.com').catch(e => e)
  expect(err).toBeInstanceOf(ProcessError)
  expect(err.message).toMatch(/exited with code 3: boom/)
})
