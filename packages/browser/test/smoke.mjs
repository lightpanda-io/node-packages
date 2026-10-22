// Checks an install of the packed tarballs, from a project outside the
// workspace: node smoke.mjs (or deno run -A, bun).
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import {
  Browser,
  CDPServer,
  bundledBrowserVersion,
  dump,
  findBinary,
  lightpanda,
} from '@lightpanda/browser'

const listen = server =>
  new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))

const freePort = async () => {
  const server = createServer()
  const port = await listen(server)
  await new Promise(resolve => server.close(resolve))
  return port
}

const getJson = async url => {
  for (let i = 0; i < 100; i++) {
    try {
      return await (await fetch(url)).json()
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error(`${url} did not answer`)
}

const version = bundledBrowserVersion()
console.log(`binary: ${findBinary()} (bundled ${version})`)
assert.ok(version, 'no platform package installed')
assert.match(findBinary(), /browser-(linux|darwin)-/)

// The 1.x API.
const port = await freePort()
const proc = await lightpanda.serve({ host: '127.0.0.1', port })
try {
  const url = `http://127.0.0.1:${port}/json/version`
  assert.equal((await getJson(url))['Lightpanda-Version'], version)
  const markdown = await lightpanda.fetch(url, { dump: true, dumpOptions: { type: 'markdown' } })
  assert.match(markdown, new RegExp(`"Lightpanda-Version": "${version}"`))
} finally {
  proc.kill()
}

const server = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html' }).end('<h1>smoke</h1>')
})
const url = `http://127.0.0.1:${await listen(server)}/`
try {
  const browser = await Browser.launch()
  try {
    const page = await browser.newSession()
    await page.goto({ url })
    assert.match(await page.markdown(), /smoke/)
  } finally {
    await browser.close()
  }

  assert.match(await dump(url, { format: 'markdown' }), /smoke/)

  const cdp = await CDPServer.launch()
  try {
    assert.equal((await cdp.version())['Lightpanda-Version'], version)
  } finally {
    await cdp.close()
  }
} finally {
  server.close()
}
console.log('ok')
