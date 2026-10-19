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
import { spawn } from 'node:child_process'
import { findBinary } from './binary.js'
import { ProcessError } from './errors.js'
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

  const flags = [
    ...(dump ? ['--dump', dumpOptions?.type ?? 'html'] : []),
    ...(disableHostVerification ? ['--insecure-disable-tls-host-verification'] : []),
    ...(obeyRobots ? ['--obey-robots'] : []),
    ...(enableExternalStylesheets ? ['--enable-external-stylesheets'] : []),
    ...(httpProxy ? ['--http-proxy', httpProxy] : []),
  ]

  return new Promise<Buffer | string>((resolve, reject) => {
    // A spawn error is followed by close, so only the first failure counts.
    let failed = false
    const fail = (e: unknown) => {
      if (failed) return
      failed = true
      console.error(e)
      reject(e)
    }

    let binary: string
    try {
      binary = findBinary()
    } catch (e) {
      return fail(e)
    }

    // No shell: the bundled binary's path may contain spaces. The output is
    // collected in chunks, since a page dump can be larger than any buffer.
    const child = spawn(binary, ['fetch', ...flags, url])
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    // Also written to our stderr, as execSync did.
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
      process.stderr.write(chunk)
    })

    child.on('error', e =>
      fail(new ProcessError(`lightpanda failed to start: ${e.message}`, { cause: e })),
    )
    child.on('close', (code, signal) => {
      if (code !== 0) {
        const reason = signal ? `was killed by ${signal}` : `exited with code ${code}`
        const details = Buffer.concat(stderr).toString().trim()
        return fail(new ProcessError(`lightpanda fetch ${reason}${details ? `: ${details}` : ''}`))
      }
      const output = Buffer.concat(stdout)
      resolve(dump ? output.toString() : output)
    })
  })
}
