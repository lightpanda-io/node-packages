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
import { fetch } from './src/fetch.js'
import { serve } from './src/serve.js'

export type { LightpandaFetchOptions } from './src/fetch.js'
export type { LightpandaServeOptions } from './src/serve.js'

/** The 1.x API: one-shot `fetch` and a CDP `serve` process. */
export const lightpanda = {
  fetch,
  serve,
}

export { Browser, Session, runScript } from './src/browser.js'
export { CDPServer, BiDiServer, ServeProcess } from './src/serve.js'
export { dump } from './src/dump.js'
export {
  LightpandaError,
  ProcessError,
  ProtocolError,
  RunError,
  ScriptError,
  ToolError,
} from './src/errors.js'
export type { RunErrorDetail } from './src/errors.js'
export { findBinary, bundledBrowserVersion } from './src/binary.js'
export type { BrowserFlags } from './src/flags.js'
export type * from './src/methods.js'
export type {
  ChildOptions,
  DumpBinaryFormat,
  DumpFormat,
  DumpOptions,
  DumpTextFormat,
  LaunchOptions,
  ProcessOptions,
  RunOptions,
  ServeOptions,
  ToolSpec,
} from './src/types.js'
