import { execSync } from 'node:child_process'
import { getExecutablePath, validateUrl } from './utils'
/**
 * @typedef LightpandaFetchOptions
 * @type {object}
 * @property {boolean} dump - Export fetched output as string
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaFetchOptions = {
  dump?: boolean
  disableHostVerification?: boolean
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
  const { dump, disableHostVerification, httpProxy } = options
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
