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

import crypto, { type BinaryToTextEncoding } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import { exit } from 'node:process'
import type { VersionType } from './types.js'

export const DEFAULT_CACHE_FOLDER = `${os.homedir()}/.cache/lightpanda-node`
export const BINARY_NAME = 'lightpanda'

export const USER_EXECUTABLE_PATH = process.env.LIGHTPANDA_EXECUTABLE_PATH
export const DEFAULT_EXECUTABLE_PATH = `${DEFAULT_CACHE_FOLDER}/${BINARY_NAME}`
export const VERSIONS_PATH = 'https://get.lightpanda.io/versions.json'

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
  if (USER_EXECUTABLE_PATH) {
    if (fs.existsSync(USER_EXECUTABLE_PATH)) {
      return USER_EXECUTABLE_PATH
    }

    console.warn(
      '⚠️ Lightpanda binary not found, please check your $LIGHTPANDA_EXECUTABLE_PATH environment variable.',
    )
    exit(1)
  }

  if (fs.existsSync(DEFAULT_EXECUTABLE_PATH)) {
    return DEFAULT_EXECUTABLE_PATH
  }

  console.warn(
    '⚠️ Lightpanda binary not installed, please run `npx @lightpanda/browser install <version>`',
  )
  exit(1)
}

/**
 * Get binary download path
 */
export const getBinaryAttributes = async (v: 'nightly' | string, platformArch: string) => {
  const f = await fetch(VERSIONS_PATH)
  const versionsList: VersionType = (await f.json()) as VersionType

  if (versionsList?.[v]?.[platformArch]) {
    return {
      url: versionsList[v][platformArch].download_url,
      checksum: `sha256:${versionsList[v][platformArch].shasum}`,
      version: versionsList[v].version,
    }
  }

  console.warn(`\x1b[33m⚠️ Provided version \`${v}\` not found\x1b[0m`)
  exit(1)
}

/**
 * Get checksum from file
 */
export const checksumFile = (
  filePath: string,
  algorithm = 'sha256',
  encoding: BinaryToTextEncoding = 'hex',
) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err)
      }

      const hash = crypto.createHash(algorithm).update(data).digest(encoding)
      resolve(`${algorithm}:${hash}`)
    })
  })
}
