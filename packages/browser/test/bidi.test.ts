import { afterAll, describe, expect, test } from 'vitest'
import { BiDiServer } from '../index.js'
import { NO_BINARY, binary } from './helpers.js'

const BIDI_CAPS = { capabilities: { alwaysMatch: { webSocketUrl: true } } }

let shared: Promise<BiDiServer> | undefined
const getServer = () => {
  shared ??= BiDiServer.launch({ binary })
  return shared
}
afterAll(async () => {
  if (shared) await (await shared).close()
})

const request = async (method: string, url: string, body?: unknown) => {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload: any = response.ok ? await response.json() : null
  return { status: response.status, payload }
}

/** The `POST /session` value and a closer for it. */
const withSession = async (server: BiDiServer) => {
  const { status, payload } = await request('POST', `${server.httpEndpoint}/session`, BIDI_CAPS)
  expect(status).toBe(200)
  const value = payload.value
  return {
    value,
    done: () => request('DELETE', `${server.httpEndpoint}/session/${value.sessionId}`),
  }
}

describe.skipIf(NO_BINARY)('BiDiServer', () => {
  test('endpoints and /status', async () => {
    const server = await getServer()
    expect(server.port).toBeGreaterThan(0)
    expect(server.bidiEndpoint).toBe(`ws://127.0.0.1:${server.port}/session`)
    expect(server.httpEndpoint).toBe(`http://127.0.0.1:${server.port}`)
    expect(await server.status()).toEqual({ ready: true, message: '' })
  })

  test('the session bootstrap advertises the BiDi endpoint', async () => {
    const server = await getServer()
    const { value, done } = await withSession(server)
    try {
      expect(value.capabilities.browserName).toBe('Lightpanda')
      expect(value.capabilities.webSocketUrl).toBe(`${server.bidiEndpoint}/${value.sessionId}`)
    } finally {
      expect(await done()).toEqual({ status: 200, payload: { value: null } })
    }
  })

  test('BiDi commands run over the WebSocket', async () => {
    const server = await getServer()
    const socket = new WebSocket(server.bidiEndpoint)
    await new Promise((resolve, reject) => {
      socket.onopen = resolve
      socket.onerror = reject
    })
    try {
      const reply = new Promise<any>(resolve => {
        socket.onmessage = event => resolve(JSON.parse(String(event.data)))
      })
      socket.send(JSON.stringify({ id: 1, method: 'session.status', params: {} }))
      expect(await reply).toMatchObject({ id: 1, type: 'success' })
    } finally {
      socket.close()
    }
  })

  test('--protocol is additive', async () => {
    const server = await getServer()
    // CDP is off by default.
    expect((await request('GET', `${server.httpEndpoint}/json/version`)).status).toBe(404)
    const both = await BiDiServer.launch({
      binary,
      args: ['--protocol', 'cdp', '--advertise-host', 'localhost'],
    })
    try {
      const { status, payload } = await request('GET', `${both.httpEndpoint}/json/version`)
      expect(status).toBe(200)
      expect(payload.Browser).toMatch(/^Lightpanda/)
      const { value, done } = await withSession(both)
      await done()
      expect(
        value.capabilities.webSocketUrl.startsWith(`ws://localhost:${both.port}/session/`),
      ).toBe(true)
    } finally {
      await both.close()
    }
  })
})
