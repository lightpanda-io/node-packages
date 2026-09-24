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
import { LightpandaError } from './errors.js'

/**
 * Browser settings every launcher and run takes, each the `lightpanda` flag of
 * the same name (`obeyRobots` → `--obey-robots`). Other flags go in `args`.
 */
export type BrowserFlags = {
  /** Fetch and obey the target site's robots.txt. */
  obeyRobots?: boolean
  /** Accept any TLS certificate. For self-signed test servers only. */
  insecureDisableTlsHostVerification?: boolean
  /** Block requests to private and internal addresses, checked after DNS resolution. */
  blockPrivateNetworks?: boolean
  /** Proxy URL for all requests; `username:password@` may be included for basic auth. */
  httpProxy?: string
  /** Sent as `Proxy-Authorization: Bearer <token>`. */
  proxyBearerToken?: string
  /**
   * Replace the User-Agent entirely. The browser refuses values that
   * impersonate other browsers (containing "Mozilla").
   */
  userAgent?: string
  /** Appended to the default User-Agent. */
  userAgentSuffix?: string
  /** BCP 47 tag for `navigator.language`, `Accept-Language` and `Intl`, `en-US` by default. */
  locale?: string
  /** IANA time zone for `Date` and `Intl`, e.g. `Europe/Paris`; the host's by default. */
  timezone?: string
  /** Directory for a persistent HTTP cache. */
  httpCacheDir?: string
  /** Milliseconds a transfer may take, 15000 by default; 0 means never time out. */
  httpTimeout?: number
  /**
   * Sub-resources to actually request; none by default. `'stylesheet'` makes
   * external CSS count for computed styles and visibility.
   */
  loadResources?: Array<'image' | 'iframe' | 'worker' | 'stylesheet'>
  /** URL patterns to block, matched case-insensitively against the full URL, `*` as wildcard. */
  blockUrls?: string[]
  /** Extra headers on every request. `User-Agent` goes through `userAgent` instead. */
  httpHeaders?: Record<string, string>
}

type FlagKind = 'bool' | 'string' | 'number' | 'list' | 'repeat' | 'headers'

const BROWSER_FLAGS: Record<keyof BrowserFlags, [flag: string, kind: FlagKind]> = {
  obeyRobots: ['--obey-robots', 'bool'],
  insecureDisableTlsHostVerification: ['--insecure-disable-tls-host-verification', 'bool'],
  blockPrivateNetworks: ['--block-private-networks', 'bool'],
  httpProxy: ['--http-proxy', 'string'],
  proxyBearerToken: ['--proxy-bearer-token', 'string'],
  userAgent: ['--user-agent', 'string'],
  userAgentSuffix: ['--user-agent-suffix', 'string'],
  locale: ['--locale', 'string'],
  timezone: ['--timezone', 'string'],
  httpCacheDir: ['--http-cache-dir', 'string'],
  httpTimeout: ['--http-timeout', 'number'],
  loadResources: ['--load-resources', 'list'],
  blockUrls: ['--block-urls', 'repeat'],
  httpHeaders: ['--http-header', 'headers'],
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(v => typeof v === 'string')

/** The argv for the {@link BrowserFlags} in `options`. Throws `LightpandaError` on a mistyped value. */
export const browserFlagArgs = (options: BrowserFlags & Record<string, unknown>): string[] => {
  const argv: string[] = []
  for (const [key, [flag, kind]] of Object.entries(BROWSER_FLAGS)) {
    const value = options[key]
    if (value === undefined || value === null) continue
    const invalid = (expected: string) =>
      new LightpandaError(`option ${key} must be ${expected}, got ${JSON.stringify(value)}`)
    switch (kind) {
      case 'bool':
        if (typeof value !== 'boolean') throw invalid('a boolean')
        if (value) argv.push(flag)
        break
      case 'string':
        if (typeof value !== 'string') throw invalid('a string')
        argv.push(flag, value)
        break
      case 'number':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          throw invalid('a non-negative integer')
        }
        argv.push(flag, String(value))
        break
      case 'list':
        if (!isStringArray(value)) throw invalid('an array of strings')
        if (value.length > 0) argv.push(flag, value.join(','))
        break
      case 'repeat':
        if (!isStringArray(value)) throw invalid('an array of strings')
        for (const item of value) argv.push(flag, item)
        break
      case 'headers':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw invalid('an object of header names to values')
        }
        for (const [name, header] of Object.entries(value)) {
          if (typeof header !== 'string')
            throw invalid('an object of header names to string values')
          argv.push(flag, `${name}: ${header}`)
        }
        break
    }
  }
  return argv
}
