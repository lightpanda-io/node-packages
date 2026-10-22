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

/**
 * Holds the names of an error's classes. The symbol is global, so `instanceof`
 * works across the ESM and CJS copies of the package.
 */
const brand = Symbol.for('@lightpanda/browser/errors')

/**
 * Base error of the package, and what usage errors throw directly (a call on
 * a closed server, a mistyped browser option).
 */
export class LightpandaError extends Error {
  /**
   * Set explicitly, since minification renames classes. A subclass without its
   * own `errorName` takes its class name and a plain prototype check instead.
   */
  static readonly errorName: string = 'LightpandaError'

  static [Symbol.hasInstance](value: unknown): boolean {
    // biome-ignore lint/complexity/noThisInStatic: `this` is the class on the right of instanceof, maybe a subclass.
    return isInstance(this, value)
  }

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = Object.hasOwn(new.target, 'errorName') ? new.target.errorName : new.target.name
    const names = [LightpandaError.errorName]
    for (let c = new.target; c !== LightpandaError; c = Object.getPrototypeOf(c))
      if (Object.hasOwn(c, 'errorName')) names.push(c.errorName)
    Object.defineProperty(this, brand, { value: names })
  }
}

const isInstance = (cls: typeof LightpandaError, value: unknown): boolean => {
  // The brand cannot tell a subclass without its own errorName from its parent.
  if (!Object.hasOwn(cls, 'errorName'))
    return Function.prototype[Symbol.hasInstance].call(cls, value)
  if (typeof value !== 'object' || value === null) return false
  const names = (value as { [brand]?: unknown })[brand]
  return Array.isArray(names) && names.includes(cls.errorName)
}

/** The browser binary could not be found, started, or reached. */
export class ProcessError extends LightpandaError {
  static override readonly errorName: string = 'ProcessError'
}

/** Detail of a failed one-shot run. */
export type RunErrorDetail = {
  exitCode: number
  signal?: string
  stdout?: string
  stderr?: string
}

/** A one-shot run of the binary (`dump`, `runScript`) exited with a failure. */
export class RunError extends ProcessError {
  static override readonly errorName: string = 'RunError'

  /** The exit status, or -1 when the binary was killed or could not be run. */
  readonly exitCode: number
  /** The signal that killed the run, when one did (a `timeout`, say). */
  readonly signal?: string
  /** What the run wrote to stdout before failing. */
  readonly stdout: string
  /** What the run wrote to stderr. */
  readonly stderr: string

  constructor(message: string, { exitCode, signal, stdout = '', stderr = '' }: RunErrorDetail) {
    super(message)
    this.exitCode = exitCode
    this.signal = signal
    this.stdout = stdout
    this.stderr = stderr
  }
}

/** A script replay (`runScript`) exited with a failure. */
export class ScriptError extends RunError {
  static override readonly errorName = 'ScriptError'
}

/** JSON-RPC level failure (invalid request, timeout, internal error). */
export class ProtocolError extends LightpandaError {
  static override readonly errorName = 'ProtocolError'

  /** The JSON-RPC error code, when the server sent one. */
  readonly code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.code = code
  }
}

/** A browser tool reported failure (bad selector, JS exception, ...). */
export class ToolError extends LightpandaError {
  static override readonly errorName = 'ToolError'
}
