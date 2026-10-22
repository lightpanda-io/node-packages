// The 1.x API must keep its exports, argv and return types. The argv checks
// run a stand-in binary that echoes its arguments.

import { beforeAll, describe, expect, test } from 'vitest'
import * as mod from '../index.js'
import { ECHO } from './helpers.js'

const { lightpanda } = mod

beforeAll(() => {
  // The legacy API predates the `binary` option.
  process.env.LIGHTPANDA_EXECUTABLE_PATH = ECHO
})

const argvOf = (out: Buffer | string) => JSON.parse(out.toString())

describe('exports', () => {
  test('the lightpanda object keeps fetch and serve', () => {
    expect(Object.keys(mod)).toContain('lightpanda')
    expect(Object.keys(mod.lightpanda).sort()).toEqual(['fetch', 'serve'])
  })
})

describe('lightpanda.fetch', () => {
  test('defaults to an html dump returned as a string', async () => {
    const out = await lightpanda.fetch('https://example.com')
    expect(typeof out).toBe('string')
    expect(argvOf(out)).toEqual(['fetch', '--dump', 'html', 'https://example.com'])
  })

  test('returns a Buffer without dump', async () => {
    const out = await lightpanda.fetch('https://example.com', {})
    expect(Buffer.isBuffer(out)).toBe(true)
    expect(argvOf(out)).toEqual(['fetch', 'https://example.com'])
  })

  test('maps every option to its flag', async () => {
    const out = await lightpanda.fetch('https://example.com', {
      dump: true,
      dumpOptions: { type: 'markdown' },
      disableHostVerification: true,
      obeyRobots: true,
      enableExternalStylesheets: true,
      httpProxy: 'http://proxy.test:3128',
    })
    expect(argvOf(out)).toEqual([
      'fetch',
      '--dump',
      'markdown',
      '--insecure-disable-tls-host-verification',
      '--obey-robots',
      '--enable-external-stylesheets',
      '--http-proxy',
      'http://proxy.test:3128',
      'https://example.com',
    ])
  })

  test('rejects a non-http url before running anything', async () => {
    expect(() => lightpanda.fetch('file:///etc/passwd')).toThrow(/http or https/)
  })
})

describe('lightpanda.serve', () => {
  const argvOfServe = async (options?: Parameters<typeof lightpanda.serve>[0]) => {
    const proc = await lightpanda.serve(options)
    const chunks: Buffer[] = []
    for await (const chunk of proc.stdout) chunks.push(chunk)
    return argvOf(Buffer.concat(chunks))
  }

  test('defaults to 127.0.0.1:9222', async () => {
    expect(await argvOfServe()).toEqual(['serve', '--host', '127.0.0.1', '--port', '9222'])
  })

  test('maps every option to its flag', async () => {
    expect(
      await argvOfServe({
        host: '0.0.0.0',
        port: 9333,
        disableHostVerification: true,
        obeyRobots: true,
        enableExternalStylesheets: true,
        httpProxy: 'http://proxy.test:3128',
      }),
    ).toEqual([
      'serve',
      '--host',
      '0.0.0.0',
      '--port',
      '9333',
      '--insecure-disable-tls-host-verification',
      '--obey-robots',
      '--enable-external-stylesheets',
      '--http-proxy',
      'http://proxy.test:3128',
    ])
  })

  test('resolves a child process with piped stdio', async () => {
    const proc = await lightpanda.serve()
    expect(proc.pid).toBeTypeOf('number')
    expect(proc.stdout).toBeDefined()
    expect(proc.stderr).toBeDefined()
    proc.kill()
  })
})
