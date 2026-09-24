/**
 * Copyright 2023-2025 Lightpanda (Selecy SAS)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type ChildProcess, type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { findBinary } from './binary.js'
import { HOST, hostPort, routableHost, spawnServer, terminate } from './client.js'
import { LightpandaError } from './errors.js'
import type { ServeOptions } from './types.js'
import { validatePort, validateUrl } from './utils.js'

/**
 * @typedef LightpandaServeOptions
 * @type {object}
 * @property {string} host - Host of the CDP server
 * @property {string} port - Port of the CDP server
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {boolean} obeyRobots - Fetches and obeys the robots.txt (if available) of the web pages we make requests towards.
 * @property {boolean} enableExternalStylesheets - Fetch external <link rel=stylesheet> resources so their rules contribute to computed styles (and therefore to visibility checks like display, visibility, opacity, pointer-events). Defaults to false, except in agent mode with an LLM, where it is on.
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaServeOptions = {
  host?: string
  port?: number
  disableHostVerification?: boolean
  obeyRobots?: boolean
  enableExternalStylesheets?: boolean
  httpProxy?: string
}

const defaultOptions: LightpandaServeOptions = {
  host: '127.0.0.1',
  port: 9222,
}

/**
 * Start a websocket CDP server
 * @param {LightpandaServeOptions} options - Options to pass to Lightpanda
 * @returns {Promise<ChildProcessWithoutNullStreams>}
 */
export const serve = (options: LightpandaServeOptions = defaultOptions) => {
  const { host, port, disableHostVerification, obeyRobots, enableExternalStylesheets, httpProxy } =
    options

  if (port) {
    validatePort(port)
  }
  if (httpProxy) {
    validateUrl(httpProxy)
  }

  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    try {
      const executablePath = findBinary()

      const flags = [
        { flag: '--host', value: host },
        { flag: '--port', value: port },
        {
          flag: '--insecure-disable-tls-host-verification',
          value: disableHostVerification,
          flagOnly: true,
        },
        {
          flag: '--obey-robots',
          value: obeyRobots,
          flagOnly: true,
        },
        {
          flag: '--enable-external-stylesheets',
          value: enableExternalStylesheets,
          flagOnly: true,
        },
        { flag: '--http-proxy', value: httpProxy },
      ]
        .flatMap(f => (f.value ? [f.flag, !f.flagOnly ? f.value.toString() : ''] : ''))
        .filter(f => f !== '')

      const process = spawn(executablePath, ['serve', ...flags])

      process.on('spawn', async () => {
        await new Promise(resolve => setTimeout(resolve, 250))
        resolve(process)
      })
      process.on('error', e => reject(e))
    } catch (e) {
      console.error(e)
      reject(e)
    }
  })
}

// `lightpanda serve` for CDP and BiDi clients. These are separate processes
// from `Browser`: one binary cannot serve MCP and CDP at once.

const HTTP_TIMEOUT_MS = 5_000

// Explicit even for CDP, the default, so `args: ['--protocol', ...]` is additive.
const CDP = ['--protocol', 'cdp']
const BIDI = ['--protocol', 'webdriver']

/** `host` is advertised in the endpoints; `local` is where this process reaches the server. */
type Spawned = { proc: ChildProcess; port: number; host: string; local: string }

const spawnServe = async (
  protocol: string[],
  { binary, args = [], host = HOST, advertiseHost, ...options }: ServeOptions = {},
): Promise<Spawned> => {
  const advertise = advertiseHost ? ['--advertise-host', advertiseHost] : []
  const spawned = await spawnServer(findBinary(binary), 'serve', {
    ...options,
    args: [...protocol, ...advertise, ...args],
    host,
  })
  const local = routableHost(host)
  return { ...spawned, host: advertiseHost ?? local, local }
}

/** Base of {@link CDPServer} and {@link BiDiServer}. */
export class ServeProcess {
  #proc: ChildProcess | null
  #port: number
  #host: string
  #local: string

  /** @internal Use the subclasses' `launch`. */
  constructor({ proc, port, host, local }: Spawned) {
    this.#proc = proc
    this.#port = port
    this.#host = host
    this.#local = local
  }

  /** The port the server listens on. */
  get port() {
    return this.#port
  }

  /** The address the endpoints point at: `advertiseHost`, else `host`. */
  get host() {
    return this.#host
  }

  /** The server process id. */
  get pid() {
    return this.#proc?.pid
  }

  /**
   * `http://<host>:<port>`: Puppeteer's `browserURL`, Playwright's
   * `connectOverCDP` URL, Selenium's server URL.
   */
  get httpEndpoint() {
    return `http://${hostPort(this.#host, this.#port)}`
  }

  /** GET `path` over the local address and parse the JSON body. */
  protected async getJson(path: string): Promise<any> {
    if (this.#proc === null) throw new LightpandaError('server closed')
    const url = `http://${hostPort(this.#local, this.#port)}${path}`
    try {
      const response = await globalThis.fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      throw new LightpandaError(`GET ${url} failed: ${err instanceof Error ? err.message : err}`, {
        cause: err,
      })
    }
  }

  /** Stop the server process. Idempotent. */
  async close() {
    const proc = this.#proc
    if (proc === null) return
    this.#proc = null
    await terminate(proc)
  }

  /** {@link close}, for `await using`. */
  async [Symbol.asyncDispose]() {
    await this.close()
  }
}

/**
 * A lightpanda process serving the Chrome DevTools Protocol, on a free
 * 127.0.0.1 port unless `port`/`host` say otherwise.
 *
 * ```ts
 * import puppeteer from 'puppeteer-core'
 * const server = await CDPServer.launch()
 * const browser = await puppeteer.connect({ browserWSEndpoint: server.wsEndpoint })
 * ```
 *
 * Every connected client gets its own browser; up to 16 connect at once by
 * default (`args: ['--cdp-max-connections', 'N']` to change).
 */
export class CDPServer extends ServeProcess {
  /**
   * Start `lightpanda serve --protocol cdp` and wait until it accepts
   * connections. Rejects with `ProcessError` when the binary is missing, does
   * not start or a pinned `port` is taken, and with `LightpandaError` on a
   * mistyped browser option.
   */
  static async launch(options: ServeOptions = {}): Promise<CDPServer> {
    return new CDPServer(await spawnServe(CDP, options))
  }

  /**
   * The CDP WebSocket URL, `ws://<host>:<port>/`. Keep it as is: the server
   * only upgrades on path `/` and only accepts an IP-literal or `localhost` host.
   */
  get wsEndpoint() {
    return `ws://${hostPort(this.host, this.port)}/`
  }

  /** The `/json/version` document (browser, protocol version, `webSocketDebuggerUrl`). */
  version(): Promise<Record<string, string>> {
    return this.getJson('/json/version')
  }
}

/**
 * A lightpanda process serving WebDriver BiDi, on a free 127.0.0.1 port unless
 * `port`/`host` say otherwise.
 *
 * ```ts
 * import { Builder } from 'selenium-webdriver'
 * const server = await BiDiServer.launch()
 * const driver = await new Builder()
 *   .usingServer(server.httpEndpoint)
 *   .withCapabilities({ browserName: 'lightpanda', webSocketUrl: true })
 *   .build()
 * ```
 *
 * The browser serves the BiDi modules (`session`, `browser`, `browsingContext`,
 * `script`, `input`) over the WebSocket plus the classic session bootstrap
 * (`GET /status`, `POST /session` with the `webSocketUrl` capability,
 * `DELETE /session/<id>`); other classic WebDriver commands are not served.
 * Pass `args: ['--protocol', 'cdp']` to serve CDP on the same port as well.
 */
export class BiDiServer extends ServeProcess {
  /**
   * Start `lightpanda serve --protocol webdriver` and wait until it accepts
   * connections. Rejects like {@link CDPServer.launch}.
   */
  static async launch(options: ServeOptions = {}): Promise<BiDiServer> {
    return new BiDiServer(await spawnServe(BIDI, options))
  }

  /**
   * The session-less BiDi WebSocket URL, `ws://<host>:<port>/session`, for
   * clients that speak BiDi directly. A session bootstrapped through
   * `POST /session` gets its own socket at `<bidiEndpoint>/<sessionId>`,
   * returned as the `webSocketUrl` capability.
   */
  get bidiEndpoint() {
    return `ws://${hostPort(this.host, this.port)}/session`
  }

  /** The `GET /status` value, `{ ready: true, message: '' }`. */
  async status(): Promise<{ ready: boolean; message: string }> {
    return (await this.getJson('/status')).value
  }
}
