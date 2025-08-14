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
_On installation, the binary corresponding to your platform will be automatically downloaded_

```bash
yarn add @lightpanda/browser
```
or

```bash
npm install @lightpanda/browser
```
or

```bash
pnpm add @lightpanda/browser
```
<!-- USAGE EXAMPLES -->

## Examples

### Fetch a page

With Lightpanda you can easily get a page's data by calling the `fetch()` function.
```ts
import { type LightpandaFetchOptions, lightpanda } from '@lightpanda/browser'

const options: LightpandaFetchOptions = {
  dump: true,
  disableHostVerification: false,
  httpProxy: 'https://proxy.lightpanda.io',
}
const res = await lightpanda.fetch('https://lightpanda.io', options)

// Do your magic ✨
```

### Start a CDP Server
The websocket will allow you to control the browser and do a series of actions on webpages.
```ts
import { type LightpandaServeOptions, lightpanda } from '@lightpanda/browser'

const options: LightpandaServeOptions = {
  host: '127.0.0.1',
  port: 9222,
}
const proc = await lightpanda.serve(options)

// Do your magic ✨

proc.stdout.destroy()
proc.stderr.destroy()
proc.kill()
```

ℹ️ _Lightpanda's CDP server can be used alongside projects like [Puppeteer](https://pptr.dev/) or [Playwright](https://playwright.dev/)._
