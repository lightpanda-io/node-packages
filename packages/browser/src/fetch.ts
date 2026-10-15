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
import { execFileSync } from 'node:child_process'
import { findBinary } from './binary.js'
import { validateUrl } from './utils.js'

/**
 * @typedef LightpandaFetchOptions
 * @type {object}
 * @property {boolean} dump - Export fetched output as string
 * @property {boolean} dumpHtml - Export fetched output as HTML
 * @property {boolean} dumpMarkdown - Export fetched output as Markdown
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {boolean} obeyRobots - Fetches and obeys the robots.txt (if available) of the web pages we make requests towards.
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaFetchOptions = {
  disableHostVerification?: boolean
  obeyRobots?: boolean
  enableExternalStylesheets?: boolean
  httpProxy?: string
  dump?: boolean
  dumpOptions?: { type?: 'html' | 'markdown' }
}

const defaultOptions: LightpandaFetchOptions = {
  dump: true,
  dumpOptions: { type: 'html' },
}

/**
 * Fetch data from a URL
 * @param {string} url - URL to fetch data from
 * @param {LightpandaFetchOptions} options - Additional options to pass to Lightpanda
 * @returns {Promise<Buffer | string>}
 */
export const fetch = (url: string, options: LightpandaFetchOptions = defaultOptions) => {
  const {
    dump,
    dumpOptions,
    disableHostVerification,
    obeyRobots,
    enableExternalStylesheets,
    httpProxy,
  } = options
  validateUrl(url)

  if (httpProxy) {
    validateUrl(httpProxy)
  }

  return new Promise<Buffer | string>((resolve, reject) => {
    try {
      const flags = [
        ...(dump ? ['--dump', dumpOptions?.type ?? 'html'] : []),
        ...(disableHostVerification ? ['--insecure-disable-tls-host-verification'] : []),
        ...(obeyRobots ? ['--obey-robots'] : []),
        ...(enableExternalStylesheets ? ['--enable-external-stylesheets'] : []),
        ...(httpProxy ? ['--http-proxy', httpProxy] : []),
      ]

      // No shell: the bundled binary's path may contain spaces.
      const e = execFileSync(findBinary(), ['fetch', ...flags, url])

      if (dump) {
        resolve(e.toString())
      }

      resolve(e)
    } catch (e) {
      console.error(e)
      reject(e)
    }
  })
}
