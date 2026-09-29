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
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { once } from 'node:events'
import { getExecutablePath, validatePort, validateUrl } from './utils.js'

/**
 * @typedef LightpandaServeOptions
 * @type {object}
 * @property {string} host - Host of the CDP server
 * @property {string} port - Port of the CDP server
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {boolean} obeyRobots - Fetches and obeys the robots.txt (if available) of the web pages we make requests towards.
 * @property {boolean} enableExternalStylesheets - Fetch external <link rel=stylesheet> resources so their rules contribute to computed styles (and therefore to visibility checks like display, visibility, opacity, pointer-events). Defaults to false, except in agent mode with an LLM, where it is on.
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 * @property {string[]} args - Extra `lightpanda serve` flags, passed verbatim after the options above (e.g. `['--load-resources', 'iframe']`)
 */
export type LightpandaServeOptions = {
  host?: string
  port?: number
  disableHostVerification?: boolean
  obeyRobots?: boolean
  enableExternalStylesheets?: boolean
  httpProxy?: string
  args?: string[]
}

const defaultOptions: LightpandaServeOptions = {
  host: '127.0.0.1',
  port: 9222,
}

const READY_TIMEOUT_MS = 10_000
const READY_POLL_MS = 100

/**
 * URL the server answers once it accepts CDP connections
 * @param {string} host - Host the server listens on
 * @param {number} port - Port the server listens on
 */
const versionUrl = (host = '127.0.0.1', port = 9222) => {
  const h =
    host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host
  return `http://${h}:${port}/json/version`
}

/**
 * Last lines Lightpanda wrote to stderr, for error messages. Stops the process
 * and reads its stderr to the end.
 * @param {ChildProcessWithoutNullStreams} proc - Lightpanda process
 * @param {() => void} buffer - The 'readable' listener that kept stderr buffered
 */
const stderrTail = async (proc: ChildProcessWithoutNullStreams, buffer: () => void) => {
  const chunks: Buffer[] = []
  proc.stderr.off('readable', buffer)
  proc.stderr.on('data', (chunk: Buffer) => chunks.push(chunk))
  if (proc.exitCode === null && proc.signalCode === null) {
    proc.kill()
  }
  if (!proc.stderr.closed) {
    await once(proc.stderr, 'close')
  }
  const out = Buffer.concat(chunks).toString().trim()
  return out ? `\n${out.split('\n').slice(-20).join('\n')}` : ''
}

/**
 * Start a websocket CDP server
 * Resolves once the server answers on /json/version.
 * @param {LightpandaServeOptions} options - Options to pass to Lightpanda
 * @returns {Promise<ChildProcessWithoutNullStreams>}
 */
export const serve = (options: LightpandaServeOptions = defaultOptions) => {
  const {
    host,
    port,
    disableHostVerification,
    obeyRobots,
    enableExternalStylesheets,
    httpProxy,
    args = [],
  } = options

  if (port) {
    validatePort(port)
  }
  if (httpProxy) {
    validateUrl(httpProxy)
  }

  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
    try {
      const executablePath = getExecutablePath()

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

      const process = spawn(executablePath, ['serve', ...flags, ...args])
      // A 'readable' listener makes the stream buffer stderr without consuming
      // it: read for error messages, left in place for the caller once ready.
      const buffer = () => {}
      process.stderr.on('readable', buffer)

      process.on('spawn', async () => {
        const url = versionUrl(host, port)
        const deadline = Date.now() + READY_TIMEOUT_MS
        while (Date.now() < deadline) {
          if (process.exitCode !== null || process.signalCode !== null) {
            reject(
              new Error(
                `Lightpanda exited (${process.exitCode ?? process.signalCode}) before serving on ${url}${await stderrTail(process, buffer)}`,
              ),
            )
            return
          }
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
            await res.arrayBuffer()
            if (res.ok) {
              process.stderr.off('readable', buffer)
              resolve(process)
              return
            }
          } catch {
            // Not listening yet.
          }
          await new Promise(resolve => setTimeout(resolve, READY_POLL_MS))
        }
        reject(
          new Error(
            `Lightpanda did not answer on ${url} within ${READY_TIMEOUT_MS}ms${await stderrTail(process, buffer)}`,
          ),
        )
      })
      process.on('error', e => reject(e))
    } catch (e) {
      console.error(e)
      reject(e)
    }
  })
}
