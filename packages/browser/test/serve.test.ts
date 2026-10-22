import net from 'node:net'
import { describe, expect, test } from 'vitest'
import { BiDiServer, CDPServer } from '../index.js'
import { reservePort } from '../src/client.js'
import { NO_BINARY, alive, binary } from './helpers.js'

const CLASSES = [
  {
    name: 'CDPServer',
    launch: CDPServer.launch,
    probe: (s: any) => s.version(),
    endpoint: (s: any) => s.wsEndpoint,
  },
  {
    name: 'BiDiServer',
    launch: BiDiServer.launch,
    probe: (s: any) => s.status(),
    endpoint: (s: any) => s.bidiEndpoint,
  },
]

describe.skipIf(NO_BINARY)('serve lifecycle', () => {
  for (const { name, launch, probe, endpoint } of CLASSES) {
    test(`${name}: close kills the process, then calls fail`, async () => {
      const server = await launch({ binary })
      const pid = server.pid
      expect(alive(pid)).toBe(true)
      expect(endpoint(server).startsWith(`ws://127.0.0.1:${server.port}/`)).toBe(true)
      expect(await probe(server)).toBeTruthy()

      await server.close()
      expect(alive(pid)).toBe(false)
      await expect(probe(server)).rejects.toMatchObject({
        name: 'LightpandaError',
        message: expect.stringMatching(/closed/),
      })
      await server.close()
    })

    test(`${name}: a pinned port is honoured`, async () => {
      const port = await reservePort()
      await using server = await launch({ binary, port })
      expect(server.port).toBe(port)
    })

    test(`${name}: a port in use fails fast`, async () => {
      const taken = net.createServer()
      await new Promise<void>(resolve => taken.listen(0, '127.0.0.1', resolve))
      const { port } = taken.address() as net.AddressInfo
      try {
        await expect(launch({ binary, port })).rejects.toMatchObject({
          name: 'ProcessError',
          message: expect.stringMatching(/in use/),
        })
      } finally {
        taken.close()
      }
    })
  }

  test('concurrent launches never share a port', async () => {
    // The second reserves once the first released the port, before its browser binds it.
    const port = await reservePort()
    const launches = [CDPServer.launch({ binary, port })]
    await new Promise(resolve => setTimeout(resolve, 5))
    launches.push(CDPServer.launch({ binary, port }))
    const [first, second] = await Promise.allSettled(launches)
    expect(first.status).toBe('fulfilled')
    expect(second).toMatchObject({ status: 'rejected', reason: { name: 'ProcessError' } })
    if (first.status === 'fulfilled') await first.value.close()
  })

  // `host`/`advertiseHost` are handled in the shared spawn, so one class covers both.
  for (const [options, expected] of [
    [{ host: '0.0.0.0' }, '127.0.0.1'],
    [{ host: '0.0.0.0', advertiseHost: 'localhost' }, 'localhost'],
  ] as const) {
    test(`host ${JSON.stringify(options)} is advertised as ${expected}`, async () => {
      await using server = await CDPServer.launch({ binary, ...options })
      expect(server.host).toBe(expected)
      expect(server.httpEndpoint).toBe(`http://${expected}:${server.port}`)
      expect(server.wsEndpoint).toBe(`ws://${expected}:${server.port}/`)
      expect(await server.version()).toBeTruthy()
    })
  }

  test('an IPv6 host is bracketed in the endpoints', async () => {
    await using server = await CDPServer.launch({ binary, host: '::1' })
    expect(server.httpEndpoint).toBe(`http://[::1]:${server.port}`)
    expect(server.wsEndpoint).toBe(`ws://[::1]:${server.port}/`)
    expect(await server.version()).toBeTruthy()
  })

  test('an advertiseHost unreachable from here does not break version()', async () => {
    // 192.0.2.0/24 is reserved for documentation: nothing answers there.
    await using server = await CDPServer.launch({ binary, advertiseHost: '192.0.2.1' })
    expect(server.wsEndpoint).toBe(`ws://192.0.2.1:${server.port}/`)
    expect(await server.version()).toBeTruthy()
  })
})
