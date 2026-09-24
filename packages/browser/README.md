<span id="readme-top"></span>

<!-- PROJECT LOGO -->
<div align="center">
  <p align="center">
    <a href="https://lightpanda.io"><img src="https://cdn.lightpanda.io/assets/images/logo/lpd-logo.png" alt="Logo" height=170></a>
  </p>

<h1 align="center">Lightpanda Browser</h1>

<p align="center"><a href="https://lightpanda.io/">lightpanda.io</a></p>

<div align="center">

[![Twitter Follow](https://img.shields.io/twitter/follow/lightpanda_io)](https://twitter.com/lightpanda_io)
[![GitHub stars](https://img.shields.io/github/stars/lightpanda-io/browser)](https://github.com/lightpanda-io/browser)

</div>

<br />
</div>

<!-- ABOUT THE PROJECT -->

## About The Project

Lightpanda is the open-source browser made for headless usage:

- Javascript execution
- Support of Web APIs (partial, WIP)
- Compatible with Playwright, Puppeteer through CDP (WIP)

Fast web automation for AI agents, LLM training, scraping and testing:

- Ultra-low memory footprint (9x less than Chrome)
- Exceptionally fast execution (11x faster than Chrome)
- Instant startup

[<img width="350px" src="https://cdn.lightpanda.io/assets/images/github/execution-time.svg">](https://github.com/lightpanda-io/demo)
&emsp;
[<img width="350px" src="https://cdn.lightpanda.io/assets/images/github/memory-frame.svg">](https://github.com/lightpanda-io/demo)

</div>

_Puppeteer requesting 100 pages from a local website on a AWS EC2 m5.large instance.
See [benchmark details](https://github.com/lightpanda-io/demo)._

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Install

```bash
npm install @lightpanda/browser   # or: yarn add / pnpm add
```

The browser binary for your platform comes with the package, as an optional
dependency (`@lightpanda/browser-linux-x64`, `-linux-arm64`, `-darwin-x64`,
`-darwin-arm64`). Linux (glibc) and macOS on x64 and arm64 are supported.

To run another browser version, download it with the CLI; an installed binary
takes precedence over the bundled one:

```bash
npx @lightpanda/browser install [version]   # a release such as 0.4.1, nightly by default
npx @lightpanda/browser upgrade             # the latest nightly
```

### Configuration

_Environment variables_

- `LIGHTPANDA_EXECUTABLE_PATH`: path to your own binary. It takes precedence
  over everything else, and the `install` command is skipped when it is set.
- `LIGHTPANDA_BIN`: path to a binary, checked after `LIGHTPANDA_EXECUTABLE_PATH`
  (the variable `lightpanda-python` uses too).

Every launcher also takes a `binary` option. Without one, the binary is
looked up in this order: `binary`, `LIGHTPANDA_EXECUTABLE_PATH`,
`LIGHTPANDA_BIN`, the one `install` put in `~/.cache/lightpanda-node`, the
bundled platform package, then `PATH`. A binary a 1.x `install` left in
`~/.cache/lightpanda-node` comes after the bundled one; run `install` again to
put it first. `findBinary()` returns what that lookup finds, and
`bundledBrowserVersion()` the bundled browser version.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

### Drive the browser with its tools

`Browser` starts the browser and exposes its tools (the ones its MCP server
serves to AI agents) as typed methods on isolated sessions:

```ts
import { Browser } from '@lightpanda/browser'

const browser = await Browser.launch()
const page = await browser.newSession()
await page.goto({ url: 'https://example.com' })
console.log(await page.extract({ schema: { title: 'h1', links: [{ selector: 'a', attr: 'href' }] } }))
await browser.close()
```

Every browser tool is a method taking one options object with the tool's
arguments: `goto`, `markdown`, `html`, `tree`, `links`, `extract`, `evaluate`,
`click`, `fill`, `press`, `selectOption`, `setChecked`, `hover`, `scroll`,
`waitForSelector`, `waitForState`, `screenshot`, and more. Their types are
generated from the browser's own tool schemas. `page.call(name, args)` calls
any tool by name, and `browser.tools` lists them with their descriptions.

Sessions are isolated browsing contexts (own page, cookies, memory) and run
concurrently within one browser process. `Browser`, sessions and the servers
below support `await using`:

```ts
await using browser = await Browser.launch({ obeyRobots: true })
await using page = await browser.newSession()
const markdown = await page.markdown({ url: 'https://example.com' })
```

A tool that fails rejects with a `ToolError`; a browser that cannot start
with a `ProcessError`.

### Dump a single page

When one page is all you need, `dump` runs the browser once and returns the
page, with no server or session involved:

```ts
import { dump } from '@lightpanda/browser'

const markdown = await dump('https://example.com', { format: 'markdown' })
```

`format` is `'html'` by default; `'semantic_tree'` and `'semantic_tree_text'`
are text too, while `'png'` and `'pdf'` resolve to a `Buffer`. Pass `args` for
any other `lightpanda fetch` flag (`['--wait-until', 'networkidle']`,
`['--dump-selector', 'main']`, `['--fail-on-http-error']`, ...) and `timeout`
to cap how long the browser may take. A non-zero exit rejects with a
`RunError` carrying `exitCode`, `signal`, `stdout` and `stderr`.

### Drive it with Puppeteer or Playwright (CDP)

Lightpanda has its own Chrome DevTools Protocol server. `CDPServer` starts
`lightpanda serve` on a free localhost port and hands you the endpoint:

```ts
import { CDPServer } from '@lightpanda/browser'
import puppeteer from 'puppeteer-core'

await using server = await CDPServer.launch()
const browser = await puppeteer.connect({ browserWSEndpoint: server.wsEndpoint })
const page = await browser.newPage()
await page.goto('https://example.com')
console.log(await page.title())
await browser.disconnect()
```

Playwright connects with `chromium.connectOverCDP(server.wsEndpoint)`. Pass
`port` to pin the port, `host` to bind something other than `127.0.0.1`
(`'0.0.0.0'` to accept connections from outside the machine), `advertiseHost`
for the address the endpoints should use, and `args` for other
`lightpanda serve` flags such as `--cdp-max-connections`.

### Drive it with WebDriver BiDi

The browser also speaks [WebDriver BiDi](https://w3c.github.io/webdriver-bidi/).
`BiDiServer` starts `lightpanda serve --protocol webdriver`:

```ts
import { BiDiServer } from '@lightpanda/browser'

await using server = await BiDiServer.launch()
server.httpEndpoint // http://127.0.0.1:<port>, the remote-server URL WebDriver clients take
server.bidiEndpoint // ws://127.0.0.1:<port>/session, the raw BiDi WebSocket
await server.status() // { ready: true, message: '' }
```

The browser serves the BiDi modules (`session`, `browser`, `browsingContext`,
`script`, `input`) plus the classic session bootstrap (`POST /session` with
the `webSocketUrl` capability), not the other classic WebDriver commands. Pass
`args: ['--protocol', 'cdp']` to serve CDP on the same port as well.

### Browser options

`Browser.launch`, `dump`, `runScript`, `CDPServer.launch` and
`BiDiServer.launch` take the same typed browser options, each the `lightpanda`
flag of the same name:

```ts
const html = await dump('https://example.com', {
  httpProxy: 'http://user:pass@proxy.example:3128',
  obeyRobots: true,
  loadResources: ['stylesheet'],
  httpHeaders: { 'Accept-Language': 'fr' },
})
```

| option | flag |
| --- | --- |
| `obeyRobots`, `blockPrivateNetworks`, `insecureDisableTlsHostVerification` | `--obey-robots`, ... (booleans) |
| `httpProxy`, `proxyBearerToken` | `--http-proxy`, `--proxy-bearer-token` |
| `userAgent`, `userAgentSuffix`, `locale`, `timezone` | `--user-agent`, `--user-agent-suffix`, `--locale`, `--timezone` |
| `httpTimeout`, `httpCacheDir` | `--http-timeout` (ms), `--http-cache-dir` |
| `loadResources: ['stylesheet', 'image', 'iframe', 'worker']` | `--load-resources stylesheet,image,...` |
| `blockUrls: ['*doubleclick*']` | `--block-urls` once per pattern |
| `httpHeaders: { Name: 'value' }` | `--http-header 'Name: value'` once per header |

Any other flag goes through `args`, which comes after these on the command
line. A mistyped option rejects with a `LightpandaError` before anything runs.

### Replay saved scripts

`runScript(path, { env })` replays a script saved by the agent REPL (`/save`)
through `lightpanda run`, with no model involved, and returns its stdout. It
takes the browser options above, plus `args` for other `lightpanda run` flags.

### Legacy API

The `lightpanda.fetch` and `lightpanda.serve` functions of earlier versions
work as before.

```ts
import { type LightpandaFetchOptions, lightpanda } from '@lightpanda/browser'

const options: LightpandaFetchOptions = {
  dump: true,
  dumpOptions: { type: 'markdown' },
  httpProxy: 'https://proxy.lightpanda.io',
}
const res = await lightpanda.fetch('https://lightpanda.io', options)
```

```ts
import { type LightpandaServeOptions, lightpanda } from '@lightpanda/browser'

const options: LightpandaServeOptions = { host: '127.0.0.1', port: 9222 }
const proc = await lightpanda.serve(options)

// Connect Puppeteer or Playwright to ws://127.0.0.1:9222

proc.stdout.destroy()
proc.stderr.destroy()
proc.kill()
```

For new code, `dump` and `CDPServer` cover the same ground with more options:

| legacy | new |
| --- | --- |
| `lightpanda.fetch(url)` | `dump(url)` |
| `lightpanda.fetch(url, { dump: true, dumpOptions: { type: 'markdown' } })` | `dump(url, { format: 'markdown' })` |
| `lightpanda.serve({ host, port })` | `CDPServer.launch({ host, port })` |
| `proc.stdout.destroy(); proc.stderr.destroy(); proc.kill()` | `await server.close()` |
| `disableHostVerification` | `insecureDisableTlsHostVerification` |
| `enableExternalStylesheets` | `loadResources: ['stylesheet']` |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This package is Apache-2.0. The browser binary in the platform packages is
[AGPL-3.0](https://github.com/lightpanda-io/browser/blob/main/LICENSE).
