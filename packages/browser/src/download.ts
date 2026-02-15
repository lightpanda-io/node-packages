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
import { constants, chmodSync, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import https from 'node:https'
import { arch, exit, platform } from 'node:process'
import {
  DEFAULT_CACHE_FOLDER,
  DEFAULT_EXECUTABLE_PATH,
  USER_EXECUTABLE_PATH,
  checksumFile,
} from './utils'

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

/**
 * Download Lightpanda's binary
 * @returns {Promise<void>}
 */
export const download = async (): Promise<void> => {
  const platformPath = PLATFORMS?.[platform]?.[arch]

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

  const getGithubHash = async (path: string) => {
    try {
      const f = await fetch(path)
      const data = await f.json()

      const asset: GH_ASSET = data.assets.find(
        (a: GH_ASSET) => a.name === `lightpanda-${platformPath}`,
      )

      if (asset) {
        return asset.digest
      }

      return ''
    } catch (e) {
      throw new Error(e)
    }
  }

  if (platformPath) {
    if (USER_EXECUTABLE_PATH) {
      console.info('$LIGHTPANDA_EXECUTABLE_PATH found, skipping binary download…')
      exit(0)
    }

    try {
      console.info('⏳ Downloading latest version of Lightpanda browser…')

      await downloadBinary(
        `https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-${platformPath}`,
      )
      const ghChecksum = await getGithubHash(
        'https://api.github.com/repos/lightpanda-io/browser/releases/tags/nightly',
      )
      const lpChecksum = await checksumFile(DEFAULT_EXECUTABLE_PATH)

      if (ghChecksum !== lpChecksum) {
        throw new Error("Checksums don't match!")
      }

      chmodSync(DEFAULT_EXECUTABLE_PATH, constants.S_IRWXU)

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
