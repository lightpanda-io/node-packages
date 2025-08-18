import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { getExecutablePath, validatePort, validateUrl } from './utils'
/**
 * @typedef LightpandaServeOptions
 * @type {object}
 * @property {string} host - Host of the CDP server
 * @property {string} port - Port of the CDP server
 * @property {number} timeout - Inactivity timeout in seconds before disconnecting clients
 * @property {boolean} disableHostVerification - Disables host verification on all HTTP requests
 * @property {string} httpProxy - The HTTP proxy to use for all HTTP requests
 */
export type LightpandaServeOptions = {
  host?: string
  port?: number
  timeout?: number
  disableHostVerification?: boolean
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
  const { host, port, timeout, disableHostVerification, httpProxy } = options

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
      { flag: '--timeout', value: timeout },
      {
        flag: '--insecure_disable_tls_host_verification',
        value: disableHostVerification,
        flagOnly: true,
      },
      { flag: '--http_proxy', value: httpProxy },
    ]
      .flatMap(f => (f.value ? [f.flag, !f.flagOnly ? f.value.toString() : ''] : ''))
      .filter(f => f !== '')

    const process = spawn(executablePath, ['serve', ...flags])

    process.on('spawn', async () => {
      console.info("🐼 Running Lightpanda's CDP server…", {
        pid: process.pid,
      })

      await new Promise(resolve => setTimeout(resolve, 250))
      resolve(process)
    })
    process.on('error', e => reject(e))
  })
}
