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
import {
  constants,
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import https from 'node:https'
import { arch, exit, platform } from 'node:process'
import {
  DEFAULT_CACHE_FOLDER,
  DEFAULT_EXECUTABLE_PATH,
  USER_EXECUTABLE_PATH,
  VERSION_MARKER,
  checksumFile,
  getBinaryAttributes,
} from './utils.js'

type GH_ASSET = {
  name: string
  digest: string
}

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
const CURRENT_PLATFORM = platform as 'darwin' | 'linux'
const CURRENT_ARCH = arch as 'arm64' | 'x64'

/**
 * Download Lightpanda's binary
 * @returns {Promise<void>}
 */
export const download = async (version: 'nightly' | string = 'nightly'): Promise<void> => {
  if (!['linux', 'darwin'].includes(platform)) {
    throw new Error('Architecture or platform is not compatible with Lightpanda')
  }

  const platformArch = PLATFORMS?.[CURRENT_PLATFORM]?.[CURRENT_ARCH]
  if (!platformArch) {
    console.warn("Lightpanda package doesn't ship with prebuilt binaries for your platform yet. ")
    exit(1)
  }
  const binaryAttributes = await getBinaryAttributes(version, platformArch)

  if (!existsSync(DEFAULT_CACHE_FOLDER)) {
    mkdirSync(DEFAULT_CACHE_FOLDER, { recursive: true })
  }

  const get = (url: string, resolve: (value?: unknown) => void, reject: (reason: any) => void) => {
    const file = createWriteStream(DEFAULT_EXECUTABLE_PATH)

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

  if (USER_EXECUTABLE_PATH) {
    console.info('$LIGHTPANDA_EXECUTABLE_PATH found, skipping binary download…')
    exit(0)
  }

  // Dropped first so a failed download never passes for an installed binary.
  const marker = `${DEFAULT_CACHE_FOLDER}/${VERSION_MARKER}`
  rmSync(marker, { force: true })

  try {
    console.info(`⏳ Downloading version ${binaryAttributes.version} of Lightpanda browser…`, '\n')
    await downloadBinary(binaryAttributes.url)

    console.info('🔐 Getting and comparing checksums…', '\n')
    const ghChecksum = binaryAttributes.checksum
    const lpChecksum = await checksumFile(DEFAULT_EXECUTABLE_PATH)

    if (ghChecksum !== lpChecksum) {
      throw new Error("🚫 Checksums don't match!")
    }

    chmodSync(DEFAULT_EXECUTABLE_PATH, constants.S_IRWXU)
    writeFileSync(marker, `${binaryAttributes.version}\n`)

    console.info('✅ Done!')
    exit(0)
  } catch (e) {
    console.log(e)
    console.warn(`Lightpanda's failed to download the binary file for "${platformArch}".`)
    exit(1)
  }
}
