// Checks an install of the packed tarballs, from a project outside the
// workspace: node smoke.mjs (or deno run -A, bun).
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { bundledBrowserVersion, findBinary, lightpanda } from '@lightpanda/browser'

const freePort = () =>
  new Promise(resolve => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

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

const port = await freePort()
const proc = await lightpanda.serve({ host: '127.0.0.1', port })
try {
  const url = `http://127.0.0.1:${port}/json/version`
  assert.equal((await getJson(url))['Lightpanda-Version'], version)
  // The page comes from the serve process: fetch blocks this one.
  const markdown = await lightpanda.fetch(url, { dump: true, dumpOptions: { type: 'markdown' } })
  assert.match(markdown, new RegExp(`"Lightpanda-Version": "${version}"`))
} finally {
  proc.kill()
}
console.log('ok')
