import type { BrowserFlags } from './flags.js'

type Semver = `${number}.${number}.${number}`

type VersionArchItemType = {
  download_url: string
  shasum: string
  size: string
}

type VersionArchType = Record<string, VersionArchItemType> & {
  date: string
  version: Semver
}

export type VersionType = Record<Semver | 'nightly', VersionArchType>

/** Options every run of the binary takes. */
export type ChildOptions = {
  /** Path to a lightpanda binary; found like {@link findBinary} when omitted. */
  binary?: string
  /** Extra environment variables for the child. */
  env?: Record<string, string>
  /**
   * Extra CLI flags for the child, after the typed browser options, e.g.
   * `['--http-max-concurrent', '10']` or `['--wait-until', 'networkidle']`.
   */
  args?: string[]
}

/** Process options of the long-lived browsers (`Browser.launch`, `CDPServer.launch`, `BiDiServer.launch`). */
export type ProcessOptions = ChildOptions & {
  /** Let the browser's own logging through to stderr. */
  verbose?: boolean
}

/** Process options of the one-shot runs (`dump`, `runScript`). */
export type RunOptions = ChildOptions & {
  /** Milliseconds before the child is killed. */
  timeout?: number
}

/** Options for `Browser.launch`; the browser flags apply to every session. */
export type LaunchOptions = ProcessOptions &
  BrowserFlags & {
    /** Milliseconds to wait for each response, 300000 by default. */
    timeout?: number
  }

/** What `dump` writes: the text formats as a string, `'png'` and `'pdf'` as a `Buffer`. */
export type DumpFormat = DumpTextFormat | DumpBinaryFormat
export type DumpTextFormat = 'html' | 'markdown' | 'semantic_tree' | 'semantic_tree_text'
export type DumpBinaryFormat = 'png' | 'pdf'

/** Options for `dump`. */
export type DumpOptions = RunOptions &
  BrowserFlags & {
    /** What to write, `'html'` by default. */
    format?: DumpFormat
  }

/** Options for `CDPServer.launch` and `BiDiServer.launch`; the browser flags apply to every client. */
export type ServeOptions = ProcessOptions &
  BrowserFlags & {
    /** The listening port, a free one by default. */
    port?: number
    /** The address to bind, `127.0.0.1` by default; `0.0.0.0` accepts outside connections. */
    host?: string
    /** The address the endpoints point at when clients reach the server elsewhere (a published container port). */
    advertiseHost?: string
  }

/** A tool as the browser lists it, in `Browser.tools`. */
export type ToolSpec = {
  description: string
  /** The tool's JSON schema for its arguments. */
  schema: Record<string, any>
}
