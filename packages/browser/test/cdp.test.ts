import puppeteer from 'puppeteer-core'
import { afterAll, describe, expect, test } from 'vitest'
import { CDPServer, lightpanda } from '../index.js'
import { NO_BINARY, binary, eventually, fixtureServer } from './helpers.js'

let shared: Promise<CDPServer> | undefined
const getServer = () => {
  shared ??= CDPServer.launch({ binary })
  return shared
}
afterAll(async () => {
  if (shared) await (await shared).close()
})

describe.skipIf(NO_BINARY)('CDPServer', () => {
  test('endpoints and /json/version', async () => {
    const server = await getServer()
    expect(server.port).toBeGreaterThan(0)
    expect(server.wsEndpoint).toBe(`ws://127.0.0.1:${server.port}/`)
    expect(server.httpEndpoint).toBe(`http://127.0.0.1:${server.port}`)

    const version = await server.version()
    expect(version.Browser).toMatch(/^Lightpanda/)
    expect(version.webSocketDebuggerUrl).toBe(server.wsEndpoint)
  })

  test('extra args reach lightpanda serve', async () => {
    await using server = await CDPServer.launch({
      binary,
      args: ['--advertise-host', 'localhost'],
    })
    expect((await server.version()).webSocketDebuggerUrl).toBe(`ws://localhost:${server.port}/`)
  })

  test('puppeteer connects over CDP', async () => {
    await using server = await CDPServer.launch({ binary, userAgentSuffix: 'cdp-test/1.0' })
    const browser = await puppeteer.connect({ browserWSEndpoint: server.wsEndpoint })
    try {
      const page = await browser.newPage()
      await page.goto(`${await fixtureServer()}/index.html`)
      expect(await page.title()).toBe('Fixture Home')
      // The typed options reach `lightpanda serve` too.
      expect(await page.evaluate('navigator.userAgent')).toMatch(/^Lightpanda\/\S+ cdp-test\/1\.0$/)
    } finally {
      await browser.disconnect()
    }
  })

  test('the 1.x lightpanda.serve still serves CDP', async () => {
    const { port } = await getServer()
    await (await getServer()).close()
    shared = undefined
    // A known-free port: the one the closed server just released.
    const proc = await lightpanda.serve({ host: '127.0.0.1', port })
    try {
      let version: any
      await eventually(async () => {
        version = await fetch(`http://127.0.0.1:${port}/json/version`)
          .then(r => r.json())
          .catch(() => undefined)
        return version !== undefined
      }, 10_000)
      expect(version.Browser).toMatch(/^Lightpanda/)
    } finally {
      proc.kill()
    }
  })
})
