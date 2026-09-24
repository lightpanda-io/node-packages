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
import { findBinary } from './binary.js'
import { runOnce } from './client.js'
import { validateUrl } from './utils.js'

/**
 * @typedef LightpandaFetchOptions
 * @type {object}
 * @property {boolean} dump - Export fetched output as string
 * @property {object} dumpOptions - `{ type: 'html' | 'markdown' }`, the dump format (html by default)
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

  const flags = [
    ...(dump ? ['--dump', dumpOptions?.type ?? 'html'] : []),
    ...(disableHostVerification ? ['--insecure-disable-tls-host-verification'] : []),
    ...(obeyRobots ? ['--obey-robots'] : []),
    ...(enableExternalStylesheets ? ['--enable-external-stylesheets'] : []),
    ...(httpProxy ? ['--http-proxy', httpProxy] : []),
  ]

  const run = async () => {
    const out = await runOnce(findBinary(), ['fetch', ...flags, url], { what: `fetch ${url}` })
    return dump ? out.toString() : out
  }
  return run().catch(e => {
    console.error(e)
    throw e
  })
}
