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
 * Base error of the package, and what usage errors throw directly (a call on
 * a closed server, a mistyped browser option).
 */
export class LightpandaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
  }
}

/** The browser binary could not be found, started, or reached. */
export class ProcessError extends LightpandaError {}

/** Detail of a failed one-shot run. */
export type RunErrorDetail = {
  exitCode: number
  signal?: string
  stdout?: string
  stderr?: string
}

/** A one-shot run of the binary (`dump`, `runScript`) exited with a failure. */
export class RunError extends ProcessError {
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
export class ScriptError extends RunError {}

/** JSON-RPC level failure (invalid request, timeout, internal error). */
export class ProtocolError extends LightpandaError {
  /** The JSON-RPC error code, when the server sent one. */
  readonly code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.code = code
  }
}

/** A browser tool reported failure (bad selector, JS exception, ...). */
export class ToolError extends LightpandaError {}
