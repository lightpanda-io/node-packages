import { constants, chmodSync, createWriteStream } from 'node:fs'
import https from 'node:https'
import { arch, exit, platform } from 'node:process'
import { getExecutablePath } from './utils'

const PLATFORMS = {
  darwin: {
    x64: 'x86_64-macos',
    arm64: 'aarch64-macos',
  },
  linux: {
    x64: 'x86_64-linux',
    arm64: 'aarch64-linux',
  },
}

/**
 * Download Lightpanda's binary
 * @returns {Promise<void>}
 */
export const download = async (): Promise<void> => {
  const platformPath = PLATFORMS?.[platform]?.[arch]
  const executablePath = getExecutablePath()

  const get = (url: string, resolve: (value?: unknown) => void, reject: (reason: any) => void) => {
    const file = createWriteStream(executablePath)

    https.get(url, res => {
      if (
        res.headers.location &&
        (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307)
      ) {
        return get(res.headers.location, resolve, reject)
      }

      res
        .pipe(file)
        .on('finish', () => {
          resolve()
        })
        .on('error', error => {
          reject(error)
        })
    })
  }

  const downloadBinary = async (url: string) => {
    return new Promise((resolve, reject) => get(url, resolve, reject))
  }

  if (platformPath) {
    try {
      console.info('⏳ Downloading latest version of Lightpanda browser…')

      await downloadBinary(
        `https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-${platformPath}`,
      )
      chmodSync(executablePath, constants.S_IRWXU)

      console.info('✅ Done!')
      exit(0)
    } catch (e) {
      console.log('error', e)
      console.warn(`Lightpanda's failed to download the binary file "${platformPath}".`)
      exit(1)
    }
  } else {
    console.warn("Lightpanda package doesn't ship with prebuilt binaries for your platform yet. ")
    exit(1)
  }
}
