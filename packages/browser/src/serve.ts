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
import { getExecutablePath, validatePort, validateUrl } from './utils.js'

/**
 * @typedef LightpandaServeOptions
 * @type {object}
 * @property {string} host - Host of the CDP server
 * @property {string} port - Port of the CDP server
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {boolean} obeyRobots - Fetches and obeys the robots.txt (if available) of the web pages we make requests towards.
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaServeOptions = {
  host?: string
  port?: number
  disableHostVerification?: boolean
  obeyRobots?: boolean
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
  const { host, port, disableHostVerification, obeyRobots, httpProxy } = options

  if (port) {
    validatePort(port)
  }
  if (httpProxy) {
    validateUrl(httpProxy)
  }

  return new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
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
  })
}
