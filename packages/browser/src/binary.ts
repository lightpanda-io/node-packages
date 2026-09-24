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
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, join } from 'node:path'
import { ProcessError } from './errors.js'
import { BINARY_NAME, DEFAULT_EXECUTABLE_PATH, VERSION_MARKER } from './utils.js'

const require = createRequire(import.meta.url)

/** The npm package that carries the binary for the current platform. */
const platformPackage = () => `@lightpanda/browser-${process.platform}-${process.arch}`

const isFile = (path: string) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** The platform package's binary, found through its manifest so any package manager layout works. */
export const bundledBinary = (): { path: string; version: string } | undefined => {
  let manifest: string
  try {
    // Built at runtime on purpose: a literal specifier gets inlined by bundlers.
    manifest = require.resolve(`${platformPackage()}/package.json`)
  } catch {
    return undefined
  }
  const path = join(dirname(manifest), BINARY_NAME)
  return isFile(path) ? { path, version: require(manifest).version } : undefined
}

/** The bundled browser release, or `undefined` without a platform package. */
export const bundledBrowserVersion = (): string | undefined => bundledBinary()?.version

/** True for a Node script, such as this package's own `lightpanda` CLI on PATH. */
const isNodeScript = (path: string): boolean => {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    const head = Buffer.alloc(128)
    const n = readSync(fd, head, 0, head.length, 0)
    const firstLine = head.toString('latin1', 0, n).split('\n')[0]
    return firstLine.startsWith('#!') && firstLine.includes('node')
  } catch {
    return false
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

/** Where {@link lookupBinary} looks, besides the explicit path. */
export type BinarySources = {
  env: Record<string, string | undefined>
  /**
   * The binary `install` downloads. It beats the bundled one only next to a
   * {@link VERSION_MARKER}; without one it is a 1.x leftover.
   */
  cachePath: string
  bundledPath?: string
}

/** {@link findBinary}, over explicit sources. */
export const lookupBinary = (explicit: string | undefined, sources: BinarySources): string => {
  if (explicit) {
    if (isFile(explicit)) return explicit
    throw new ProcessError(`lightpanda binary not found at ${explicit}`)
  }

  const { env, cachePath, bundledPath } = sources
  const userPath = env.LIGHTPANDA_EXECUTABLE_PATH
  if (userPath) {
    if (isFile(userPath)) return userPath
    throw new ProcessError(
      'Lightpanda binary not found, please check your $LIGHTPANDA_EXECUTABLE_PATH environment variable.',
    )
  }

  const installed = existsSync(join(dirname(cachePath), VERSION_MARKER))
  const found = [
    env.LIGHTPANDA_BIN,
    installed ? cachePath : undefined,
    bundledPath,
    installed ? undefined : cachePath,
  ].find(path => path && isFile(path))
  if (found) return found
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, BINARY_NAME)
    if (isFile(candidate) && !isNodeScript(candidate)) return candidate
  }

  throw new ProcessError(
    [
      `Lightpanda binary not found: ${platformPackage()} is not installed and neither`,
      '$LIGHTPANDA_EXECUTABLE_PATH, $LIGHTPANDA_BIN nor PATH point at one. Run',
      '`npx @lightpanda/browser install <version>`, or check that optional dependencies',
      'were installed (not --omit=optional, and a lockfile generated for this platform).',
      'Linux (glibc) and macOS on x64 and arm64 are supported.',
    ].join(' '),
  )
}

/**
 * Locate the lightpanda binary, in order:
 *
 * 1. `explicit`, the `binary` option;
 * 2. `$LIGHTPANDA_EXECUTABLE_PATH`;
 * 3. `$LIGHTPANDA_BIN`;
 * 4. the binary `npx @lightpanda/browser install` put in `~/.cache/lightpanda-node`;
 * 5. the bundled platform package (`@lightpanda/browser-<platform>-<arch>`);
 * 6. a binary a 1.x `install` left in `~/.cache/lightpanda-node`;
 * 7. `PATH`, skipping Node scripts such as this package's own CLI.
 *
 * Throws `ProcessError` when `explicit` or `$LIGHTPANDA_EXECUTABLE_PATH` is
 * set but not a file, or when none of the others is.
 */
export const findBinary = (explicit?: string): string =>
  lookupBinary(explicit, {
    env: process.env,
    cachePath: DEFAULT_EXECUTABLE_PATH,
    bundledPath: bundledBinary()?.path,
  })
