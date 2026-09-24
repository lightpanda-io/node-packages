// Shared fixtures. Vitest runs each file in its own worker, so the browser and
// the fixture server are memoized per file and closed by `afterAll`.

import { readFile } from 'node:fs/promises'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll } from 'vitest'
import { Browser, findBinary } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
export const FIXTURES = join(here, 'fixtures')
export const ECHO = join(FIXTURES, 'echo-argv.mjs')

/** The binary findBinary resolves, or `undefined`. */
const binaryPath = () => {
  try {
    return findBinary()
  } catch {
    return undefined
  }
}

export const binary = binaryPath()

/** The first bytes of a PNG file. */
export const PNG_MAGIC = Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')

/** Pass to `describe.skipIf`: suites skip (not fail) without a binary. */
export const NO_BINARY = binary === undefined

let browser: Promise<Browser> | undefined

/** One browser per test file. */
export const getBrowser = () => {
  browser ??= Browser.launch({ binary })
  return browser
}

const servers: Server[] = []
let fixtureUrl: Promise<string> | undefined

/** A static server for test/fixtures on a free localhost port. */
export const fixtureServer = () => {
  fixtureUrl ??= new Promise(resolve => {
    const server = createServer(async (req, res) => {
      // The request headers back as JSON, for checking what the browser sent.
      if (req.url === '/echo-headers') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end(JSON.stringify(req.headers))
        return
      }
      const path = normalize(join(FIXTURES, new URL(req.url ?? '/', 'http://fixture').pathname))
      if (!path.startsWith(FIXTURES)) {
        res.writeHead(403).end()
        return
      }
      try {
        const body = await readFile(path)
        res.writeHead(200, { 'content-type': 'text/html' }).end(body)
      } catch {
        res.writeHead(404).end()
      }
    })
    server.listen(0, '127.0.0.1', () => {
      servers.push(server)
      const { port } = server.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
  return fixtureUrl
}

afterAll(async () => {
  if (browser) await (await browser).close()
  for (const server of servers) await new Promise(done => server.close(done))
})

/** Whether a process is alive. */
export const alive = (pid: number | undefined) => {
  if (pid === undefined) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Poll until `check` is true or `ms` elapse. */
export const eventually = async (check: () => boolean | Promise<boolean>, ms = 5000) => {
  const deadline = Date.now() + ms
  while (!(await check())) {
    if (Date.now() > deadline) return false
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return true
}
