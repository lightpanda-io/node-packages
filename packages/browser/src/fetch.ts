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
import { execSync } from 'node:child_process'
import { getExecutablePath, validateUrl } from './utils'

/**
 * @typedef LightpandaFetchOptions
 * @type {object}
 * @property {boolean} dump - Export fetched output as string
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {boolean} obeyRobots - Fetches and obeys the robots.txt (if available) of the web pages we make requests towards.
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaFetchOptions = {
  dump?: boolean
  disableHostVerification?: boolean
  obeyRobots?: boolean
  httpProxy?: string
}

const defaultOptions: LightpandaFetchOptions = {
  dump: true,
}

/**
 * Fetch data from a URL
 * @param {string} url - URL to fetch data from
 * @param {LightpandaFetchOptions} options - Additional options to pass to Lightpanda
 * @returns {Promise<Buffer | string>}
 */
export const fetch = (url: string, options: LightpandaFetchOptions = defaultOptions) => {
  const { dump, disableHostVerification, obeyRobots, httpProxy } = options
  validateUrl(url)

  if (httpProxy) {
    validateUrl(httpProxy)
  }

  return new Promise<Buffer | string>((resolve, reject) => {
    try {
      const executablePath = getExecutablePath()
      const flags = [
        { flag: '--dump', condition: dump },
        { flag: '--insecure_disable_tls_host_verification', condition: disableHostVerification },
        { flag: '--obey_robots', condition: obeyRobots },
        { flag: `--http_proxy ${httpProxy}`, condition: httpProxy },
      ]
        .map(f => (f.condition ? f.flag : ''))
        .join(' ')

      const e = execSync(`${executablePath} fetch ${flags} ${url}`)

      if (dump) {
        resolve(e.toString())
      }

      resolve(e)
    } catch (error) {
      reject(error)
    }
  })
}
