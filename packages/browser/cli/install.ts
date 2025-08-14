#!/usr/bin/env node

import { constants, chmodSync, createWriteStream } from 'node:fs'
import https from 'node:https'
import { arch, exit, platform } from 'node:process'

const FOLDER = 'dist'
const BINARY_NAME = 'lightpanda'
const BINARY_PATH = `${FOLDER}/${BINARY_NAME}`
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

const get = (url: string, resolve: (value?: unknown) => void, reject: (reason: any) => void) => {
  const file = createWriteStream(BINARY_PATH)

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

const main = async () => {
  const path = PLATFORMS?.[platform]?.[arch]

  if (path) {
    try {
      await downloadBinary(
        `https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-${path}`,
      )
      chmodSync(BINARY_PATH, constants.S_IRWXU)
      exit(0)
    } catch (e) {
      console.log('error', e)
      console.warn(`Lightpanda's postinstall script failed to download the binary file "${path}".`)
      exit(1)
    }
  } else {
    console.warn("Lightpanda package doesn't ship with prebuilt binaries for your platform yet. ")
    exit(1)
  }
}

main()
