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

import pkg from '../package.json' with { type: 'json' }
import { Client, runWithFlags } from './client.js'
import { ScriptError, ToolError } from './errors.js'
import type { BrowserFlags } from './flags.js'
import { SessionMethods } from './methods.js'
import type { LaunchOptions, RunOptions, ToolSpec } from './types.js'

type ToolMap = Readonly<Record<string, ToolSpec>>

type Content = { type: string; text?: string; data?: string }

/**
 * Tools whose text is JSON; the others stay strings even when they parse (a
 * page whose markdown is `404`). `evaluate` renders primitives as bare text,
 * so a string result like `"123"` parses too.
 */
const JSON_TOOLS = new Set([
  'detectForms',
  'evaluate',
  'extract',
  'findElement',
  'interactiveElements',
  'links',
  'nodeDetails',
  'structuredData',
])

/** An isolated browsing context (own page, cookies, memory), from {@link Browser.newSession}. */
export class Session extends SessionMethods {
  #client: Client
  #tools: ToolMap
  #id: string
  #closed = false

  private constructor(client: Client, tools: ToolMap, id: string) {
    super()
    this.#client = client
    this.#tools = tools
    this.#id = id
  }

  /** @internal Open the session with the MCP `initialize` handshake. */
  static async open(client: Client, tools: ToolMap, id: string) {
    await client.request(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: '@lightpanda/browser', version: pkg.version },
      },
      id,
    )
    await client.notify('notifications/initialized', id)
    return new Session(client, tools, id)
  }

  /** The session id, as the browser knows it. */
  get id() {
    return this.#id
  }

  /** {@inheritDoc SessionMethods.call} */
  async call(tool: string, args: object = {}): Promise<any> {
    if (this.#closed || this.#client.closed) {
      throw new ToolError(`session ${this.#id} is closed`)
    }
    const spec = Object.hasOwn(this.#tools, tool) ? this.#tools[tool] : undefined
    if (!spec) throw new ToolError(`unknown tool '${tool}'`)
    const properties: Record<string, { type?: string }> = spec.schema.properties ?? {}
    const params: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === null) continue
      // The server types JSON params (extract's schema) as strings.
      const isJson =
        typeof value === 'object' && !Buffer.isBuffer(value) && properties[key]?.type === 'string'
      params[key] = isJson ? JSON.stringify(value) : value
    }

    const result = await this.#client.request(
      'tools/call',
      { name: tool, arguments: params },
      this.#id,
    )
    const content: Content[] = result?.content ?? []
    const text = content
      .filter(part => part.type === 'text')
      .map(part => part.text ?? '')
      .join('\n')
    if (result?.isError) throw new ToolError(text || `${tool} failed`)
    const images = content
      .filter(part => part.type === 'image')
      .map(part => Buffer.from(part.data ?? '', 'base64'))
    if (images.length > 0) return images.length === 1 ? images[0] : images
    if (!JSON_TOOLS.has(tool)) return text
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /**
   * Release the session's page. Idempotent; calls made after this reject with
   * {@link ToolError}. Closing the browser closes every session.
   */
  async close() {
    if (this.#closed) return
    this.#closed = true
    // The browser took the session down with it.
    if (this.#client.closed) return
    await this.#client.deleteSession(this.#id)
  }

  /** {@link close}, for `await using`. */
  async [Symbol.asyncDispose]() {
    await this.close()
  }
}

/**
 * A lightpanda browser process, driven through its tools.
 *
 * ```ts
 * const browser = await Browser.launch()
 * const page = await browser.newSession()
 * await page.goto({ url: 'https://example.com' })
 * console.log(await page.extract({ schema: { title: 'h1' } }))
 * await browser.close()
 * ```
 */
export class Browser {
  #client: Client
  #tools: ToolMap
  #seq = 0

  private constructor(client: Client, tools: ToolMap) {
    this.#client = client
    this.#tools = tools
  }

  /**
   * Spawn `lightpanda mcp` on a free localhost port and fetch its tool list.
   * Rejects with `ProcessError` when the binary is missing or does not start,
   * and with `LightpandaError` on a mistyped browser option.
   */
  static async launch(options: LaunchOptions = {}): Promise<Browser> {
    const client = await Client.launch(options)
    let listed: any
    try {
      listed = await client.request('tools/list')
    } catch (err) {
      await client.close()
      throw err
    }
    const tools: Record<string, ToolSpec> = {}
    for (const tool of listed?.tools ?? []) {
      tools[tool.name] = { description: tool.description ?? '', schema: tool.inputSchema ?? {} }
    }
    return new Browser(client, Object.freeze(tools))
  }

  /** Tool name → `{ description, schema }`, as reported by the browser. */
  get tools(): ToolMap {
    return this.#tools
  }

  /** The browser process id. */
  get pid() {
    return this.#client.pid
  }

  /** Open a new {@link Session}; close it with `close()` or `await using`. */
  async newSession(): Promise<Session> {
    return Session.open(this.#client, this.#tools, `js${++this.#seq}`)
  }

  /** Stop the browser process, closing every session with it. */
  async close() {
    await this.#client.close()
  }

  /** {@link close}, for `await using`. */
  async [Symbol.asyncDispose]() {
    await this.close()
  }
}

/**
 * Replay a saved lightpanda script (no LLM) and return its stdout. Rejects
 * with {@link ScriptError} on a non-zero exit or a `timeout` kill, and with
 * `LightpandaError` on a mistyped browser option.
 */
export const runScript = async (
  script: string,
  options: RunOptions & BrowserFlags = {},
): Promise<string> => (await runWithFlags(['run'], script, options, script, ScriptError)).toString()
