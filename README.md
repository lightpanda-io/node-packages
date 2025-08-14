<span id="readme-top"></span>

<!-- PROJECT LOGO -->
<div align="center">
  <p align="center">
    <a href="https://lightpanda.io"><img src="https://cdn.lightpanda.io/assets/images/logo/lpd-logo.png" alt="Logo" height=170></a>
  </p>

<h1 align="center">Lightpanda Browser | Node Packages</h1>

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

This repository contains all the [NPM](https://npmjs.com) packages created for Lightpanda

### Build

```
$ yarn build
```

### Publish
To publish packages, we use [changesets](https://github.com/changesets/changesets). Make sure to have commited & pushed all your code before publishing.

1. Run the following command to create a new version (patch, minor, major)

```
$ yarn changeset add
```

2. Publish all the packages

```
$ yarn publish-packages
```

3. Push the new commits & merge to main