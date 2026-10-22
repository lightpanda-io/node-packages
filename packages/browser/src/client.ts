/**
 * Copyright 2023-2026 Lightpanda (Selecy SAS)
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

/**
 * Subprocesses, and JSON-RPC to `lightpanda mcp --port`: one POST per message,
 * sessions keyed by the `Mcp-Session-Id` header. An unknown id creates its
 * session, so the client mints the ids; DELETE tears one down.
 */
import { type ChildProcess, execFile, spawn } from 'node:child_process'
import net from 'node:net'
import { findBinary } from './binary.js'
import { ProcessError, ProtocolError, RunError } from './errors.js'
import { type BrowserFlags, browserFlagArgs } from './flags.js'
import type { LaunchOptions, RunOptions, ServeOptions } from './types.js'

// The IP literal is deliberate: the server accepts only an IP-literal or
// `localhost` Host header, and `localhost` may resolve to ::1 first.
export const HOST = '127.0.0.1'

/** Where to reach a server bound to `host`: the loopback for a wildcard bind. */
export const routableHost = (host: string) => (host === '0.0.0.0' || host === '::' ? HOST : host)

/** `host:port` for a URL, bracketing an IPv6 literal (`[::1]:9222`). */
export const hostPort = (host: string, port: number) =>
  host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`

const SPAWN_ATTEMPTS = 3
const READY_TIMEOUT_MS = 15_000
const TERMINATE_GRACE_MS = 5_000

/**
 * Bind-and-release `port` (0: any free one) on `host` and return it. libuv sets
 * SO_REUSEADDR like the browser does, so a TIME_WAIT leftover is no collision.
 */
export const reservePort = (port = 0, host = HOST): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', err =>
      reject(new ProcessError(`port ${port} is already in use`, { cause: err })),
    )
    server.listen({ host, port }, () => {
      const { port: chosen } = server.address() as net.AddressInfo
      server.close(() => resolve(chosen))
    })
  })

// Ports reserved for a browser that has not bound them yet. The readiness
// probe cannot tell who accepted its connection, so launches must not share one.
const pending = new Set<number>()

/** {@link reservePort}, skipping ports another launch in flight is about to bind. */
const reserveUnclaimed = async (port: number, host: string) => {
  for (let tries = 0; tries < 10; tries++) {
    const chosen = await reservePort(port, host)
    if (!pending.has(chosen)) return chosen
    if (port !== 0) break
  }
  throw new ProcessError(`port ${port || 'reservation'} is already in use`)
}

const tryConnect = (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const socket = net.connect({ host, port })
    socket.setTimeout(250)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const exited = (proc: ChildProcess) => proc.exitCode !== null || proc.signalCode !== null

const waitReady = async (proc: ChildProcess, port: number, host: string) => {
  let spawnError: Error | undefined
  proc.once('error', err => {
    spawnError = err
  })
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (spawnError) throw new ProcessError(`could not start lightpanda: ${spawnError.message}`)
    if (exited(proc)) {
      throw new ProcessError(`lightpanda exited during startup (code ${proc.exitCode})`)
    }
    // A child that lost the bind exits even though the probe connected.
    if ((await tryConnect(port, host)) && !exited(proc)) return
    await sleep(5) // a refused localhost connect fails instantly
  }
  throw new ProcessError('timed out waiting for lightpanda to listen')
}

/** SIGTERM, then SIGKILL if the process is still around after a grace period. */
export const terminate = async (proc: ChildProcess) => {
  if (exited(proc)) return
  const gone = new Promise(resolve => proc.once('exit', resolve))
  proc.kill('SIGTERM')
  const hammer = setTimeout(() => proc.kill('SIGKILL'), TERMINATE_GRACE_MS)
  await gone
  clearTimeout(hammer)
}

type RunOnceOptions = {
  /** What is running, for the error message. */
  what: string
  env?: Record<string, string>
  /** Milliseconds before the child is killed. */
  timeout?: number
  /** The class to reject with. */
  error?: typeof RunError
}

/** Run the binary once, without a shell, and resolve its stdout as bytes so `png`/`pdf` dumps survive. */
export const runOnce = (
  binary: string,
  argv: string[],
  { what, env, timeout, error: ErrorClass = RunError }: RunOnceOptions,
): Promise<Buffer> => {
  const killSignal = 'SIGTERM'
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      argv,
      {
        env: env ? { ...process.env, ...env } : process.env,
        timeout,
        killSignal,
        // The default 1 MB maxBuffer would truncate a large page or script output.
        maxBuffer: Number.POSITIVE_INFINITY,
        encoding: 'buffer',
      },
      (err, stdout, stderr) => {
        if (err === null) return resolve(stdout)
        // `killed` means we sent the signal: the browser traps SIGTERM on
        // Linux and exits 1, leaving `err.signal` null.
        const exitCode = typeof err.code === 'number' ? err.code : -1
        const signal = err.killed ? (err.signal ?? killSignal) : undefined
        const why = signal ? `killed (${signal})` : `exit ${exitCode}`
        const out = stdout.toString('utf8')
        const errors = stderr.toString('utf8')
        const detail = errors.trim() || out.trim() || err.message
        reject(
          new ErrorClass(`${what} failed (${why}): ${detail}`, {
            exitCode,
            signal,
            stdout: out,
            stderr: errors,
          }),
        )
      },
    )
  })
}

/** `lightpanda <command...> <browser flags> <args> <target>`, through {@link runOnce}. */
export const runWithFlags = (
  command: string[],
  target: string,
  options: RunOptions & BrowserFlags,
  what: string,
  error?: typeof RunError,
): Promise<Buffer> => {
  const { binary, env, args = [], timeout } = options
  const argv = [...command, ...browserFlagArgs(options), ...args, target]
  return runOnce(findBinary(binary), argv, { what, env, timeout, error })
}

// Servers to take down with this process. Best effort, as Node has no
// PDEATHSIG: a SIGKILL of this process leaves them running. SIGINT reaches
// them from the terminal, as they share the process group.
const children = new Set<ChildProcess>()
let hooksInstalled = false

const installExitHooks = () => {
  if (hooksInstalled) return
  hooksInstalled = true
  process.once('exit', () => {
    for (const child of children) child.kill('SIGTERM')
  })
  for (const signal of ['SIGTERM', 'SIGHUP'] as const) {
    const handler = () => {
      for (const child of children) child.kill(signal)
      process.removeListener(signal, handler)
      // Re-raise only when nobody else handles it, so the process still exits.
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal)
    }
    process.on(signal, handler)
  }
}

const track = (proc: ChildProcess) => {
  children.add(proc)
  proc.once('exit', () => children.delete(proc))
  proc.on('error', () => {}) // a failed kill() must not become an uncaught exception
  proc.unref() // a browser nobody closed must not keep the event loop alive
  installExitHooks()
}

type SpawnOptions = Omit<ServeOptions, 'advertiseHost'>

/**
 * Start `lightpanda <mode> --port N --host H <flags> <args>` and wait until it
 * listens. Without `port`, a browser that exits during startup is retried on
 * a fresh port.
 */
export const spawnServer = async (
  binary: string,
  mode: 'mcp' | 'serve',
  options: SpawnOptions = {},
): Promise<{ proc: ChildProcess; port: number }> => {
  const { args = [], env, verbose = false, port, host = HOST } = options
  const flags = [...browserFlagArgs(options), ...args]
  let lastError: Error | undefined
  for (let attempts = port === undefined ? SPAWN_ATTEMPTS : 1; attempts > 0; attempts--) {
    const chosen = await reserveUnclaimed(port ?? 0, host)
    pending.add(chosen)
    const proc = spawn(binary, [mode, '--port', String(chosen), '--host', host, ...flags], {
      // Never a piped-but-unread stderr: the browser would block once it fills.
      stdio: ['ignore', 'ignore', verbose ? 'inherit' : 'ignore'],
      env: env ? { ...process.env, ...env } : process.env,
    })
    track(proc)
    try {
      await waitReady(proc, chosen, routableHost(host))
      return { proc, port: chosen }
    } catch (err) {
      lastError = err as Error
      await terminate(proc)
    } finally {
      pending.delete(chosen)
    }
  }
  throw new ProcessError(
    `failed to start \`lightpanda ${mode}\`: ${lastError?.message}; pass verbose: true to see the browser log`,
  )
}

const describe = (err: unknown) => {
  if (err instanceof Error) {
    return err.cause instanceof Error ? err.cause.message : err.message
  }
  return String(err)
}

/** Owns one `lightpanda mcp` subprocess and speaks JSON-RPC to it. */
export class Client {
  #proc: ChildProcess | null
  #port: number
  #timeout: number
  #id = 0

  private constructor(proc: ChildProcess, port: number, timeout: number) {
    this.#proc = proc
    this.#port = port
    this.#timeout = timeout
  }

  /** Spawn `lightpanda mcp` and wait until it accepts connections. */
  static async launch({ binary, timeout = 300_000, ...options }: LaunchOptions = {}) {
    const { proc, port } = await spawnServer(findBinary(binary), 'mcp', options)
    return new Client(proc, port, timeout)
  }

  get pid() {
    return this.#proc?.pid
  }

  /** True once {@link close} was called. */
  get closed() {
    return this.#proc === null
  }

  #state() {
    if (this.#proc === null) return 'closed'
    if (exited(this.#proc)) return `exited (code ${this.#proc.exitCode})`
    return 'running'
  }

  async #http(method: 'POST' | 'DELETE', body: string | undefined, sessionId?: string) {
    // Never reach the port once closed: another browser may have it by now.
    if (this.#proc === null) throw new ProcessError('lightpanda is closed')
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (sessionId) headers['mcp-session-id'] = sessionId
    let response: Response
    try {
      response = await globalThis.fetch(`http://${HOST}:${this.#port}/`, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(this.#timeout),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ProtocolError(`no response within ${this.#timeout} ms`)
      }
      throw new ProcessError(`lost connection to lightpanda (${this.#state()}): ${describe(err)}`, {
        cause: err,
      })
    }
    return { status: response.status, body: await response.text() }
  }

  /** Send one JSON-RPC request and return its `result`. */
  async request(method: string, params?: Record<string, unknown>, sessionId?: string) {
    const message: Record<string, unknown> = { jsonrpc: '2.0', id: ++this.#id, method }
    if (params !== undefined) message.params = params
    const { status, body } = await this.#http('POST', JSON.stringify(message), sessionId)
    if (!body) throw new ProtocolError(`empty response (HTTP ${status}) for ${method}`)
    let payload: any
    try {
      payload = JSON.parse(body)
    } catch {
      throw new ProtocolError(`invalid JSON-RPC response for ${method}: ${body.slice(0, 200)}`)
    }
    if (payload.error) {
      throw new ProtocolError(
        `${payload.error.message ?? 'error'} (code ${payload.error.code})`,
        payload.error.code,
      )
    }
    return payload.result
  }

  async notify(method: string, sessionId?: string) {
    await this.#http('POST', JSON.stringify({ jsonrpc: '2.0', method }), sessionId)
  }

  async deleteSession(sessionId: string) {
    await this.#http('DELETE', undefined, sessionId)
  }

  /** Stop the browser process. Idempotent. */
  async close() {
    const proc = this.#proc
    if (proc === null) return
    this.#proc = null
    await terminate(proc)
  }
}
