import os from 'node:os'

const BINARY_NAME = 'lightpanda'

/**
 * Validate a URL structure
 * @param {string} url URL to validate
 */
export const validateUrl = (url: string): void => {
  if (!url || typeof url !== 'string') {
    throw new Error(`URL is required and must be a string ${url}`)
  }

  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL format ${url}`)
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`URL must use http or https protocol ${url}`)
  }
}

/**
 * Validate a port number
 * @param {number} port Port number to validate
 */
export const validatePort = (port: number): void => {
  if (!port || typeof port !== 'number') {
    throw new Error(`Port is required and must be a number ${port}`)
  }

  if (port <= 0) {
    throw new Error(`Port should be a positive number ${port}`)
  }
}

/**
 * Get executable path
 */
export const getExecutablePath = () => {
  return (
    process.env.LIGHTPANDA_EXECUTABLE_PATH ?? `${os.homedir()}/.cache/lightpanda-node${BINARY_NAME}`
  )
}
