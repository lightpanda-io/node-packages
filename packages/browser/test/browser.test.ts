import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'
import { Browser, ToolError, runScript } from '../index.js'
import {
  NO_BINARY,
  PNG_MAGIC,
  alive,
  binary,
  eventually,
  fixtureServer,
  getBrowser,
} from './helpers.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'lightpanda-node-'))

describe.skipIf(NO_BINARY)('Browser', () => {
  test('goto and markdown', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    expect(await page.markdown()).toMatch(/Hello from the fixture/)
  })

  test('extract with an object schema', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    const data = await page.extract({ schema: { headline: '#headline', items: ['.item a'] } })
    expect(data.headline).toBe('Hello from the fixture')
    expect(data.items).toEqual(['First item', 'Second item', 'Third item'])
  })

  test('evaluate returns parsed values', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    expect(await page.evaluate({ script: '1 + 2' })).toBe(3)
    expect(await page.evaluate({ script: 'document.title' })).toBe('Fixture Home')
  })

  test('text tools return strings, even when the text parses as JSON', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    await page.evaluate({ script: "document.body.innerHTML = '42'" })
    expect((await page.markdown()).trim()).toBe('42')
    expect(await page.links()).toEqual([])
  })

  test('inline screenshot returns PNG bytes', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    const png = await page.screenshot()
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC)
  })

  test('generated methods and call() agree', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    expect(await page.getUrl()).toMatch(/\/index\.html$/)
    const shallow = await page.tree({ maxDepth: 1 })
    expect(shallow).toEqual(await page.call('tree', { maxDepth: 1 }))
    expect(JSON.stringify(shallow).length).toBeLessThan(JSON.stringify(await page.tree()).length)
    expect(browser.tools).toHaveProperty('goto')
  })

  test('sessions are isolated', async () => {
    const browser = await getBrowser()
    const url = await fixtureServer()
    const [a, b] = await Promise.all([browser.newSession(), browser.newSession()])
    try {
      await Promise.all([
        a.goto({ url: `${url}/index.html` }),
        b.goto({ url: `${url}/other.html` }),
      ])
      expect(await a.getUrl()).toMatch(/\/index\.html$/)
      expect(await b.getUrl()).toMatch(/\/other\.html$/)
    } finally {
      await Promise.all([a.close(), b.close()])
    }
  })

  test('a failing tool rejects with ToolError', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    await expect(page.extract({ schema: { nope: '#does-not-exist' } })).rejects.toThrow(ToolError)
  })

  test('an unknown tool rejects with ToolError', async () => {
    const browser = await getBrowser()
    await using page = await browser.newSession()
    await expect(page.call('teleport', { where: 'moon' })).rejects.toThrow(/unknown tool/)
  })

  test('a closed session rejects, and close is idempotent', async () => {
    const browser = await getBrowser()
    const page = await browser.newSession()
    await page.close()
    await page.close()
    await expect(page.getUrl()).rejects.toThrow(/closed/)
  })

  test('await using closes the session', async () => {
    const browser = await getBrowser()
    let leaked: Awaited<ReturnType<Browser['newSession']>>
    {
      await using page = await browser.newSession()
      leaked = page
    }
    await expect(leaked.getUrl()).rejects.toThrow(/closed/)
  })

  test('extra args reach the browser', async () => {
    const cacheDir = join(tmp(), 'cache')
    const browser = await Browser.launch({ binary, args: ['--http-cache-dir', cacheDir] })
    try {
      const page = await browser.newSession()
      await page.goto({ url: `${await fixtureServer()}/index.html` })
      expect(await page.markdown()).toMatch(/Hello/)
    } finally {
      await browser.close()
    }
    expect(existsSync(cacheDir)).toBe(true)
  })

  test('close kills the process', async () => {
    const browser = await Browser.launch({ binary })
    const pid = browser.pid
    expect(alive(pid)).toBe(true)
    await browser.close()
    expect(alive(pid)).toBe(false)
    await browser.close()
  })

  test('sessions of a closed browser are closed', async () => {
    const browser = await Browser.launch({ binary })
    const page = await browser.newSession()
    await browser.close()
    await expect(page.getUrl()).rejects.toThrow(ToolError)
    await page.close()
  })

  test('runScript replays a saved script', async () => {
    const script = join(tmp(), 'visit.js')
    writeFileSync(script, 'const page = new Page();\nawait page.goto("$LP_TEST_URL");\n')
    await runScript(script, { env: { LP_TEST_URL: `${await fixtureServer()}/index.html` }, binary })
    await expect(runScript(join(tmp(), 'missing.js'), { binary })).rejects.toMatchObject({
      name: 'ScriptError',
    })
  })

  // Whether or not it closed the browser, a user script exits, and the browser
  // with it. Runs the built package.
  for (const closes of [true, false]) {
    test(`the process exits after use (close() ${closes ? 'called' : 'forgotten'})`, async () => {
      const entry = new URL('../dist/index.js', import.meta.url).href
      const source = `
        import { Browser } from ${JSON.stringify(entry)}
        const browser = await Browser.launch({ binary: ${JSON.stringify(binary)} })
        const page = await browser.newSession()
        await page.goto({ url: ${JSON.stringify(`${await fixtureServer()}/index.html`)} })
        console.log(browser.pid)
        ${closes ? 'await browser.close()' : ''}
      `
      const started = Date.now()
      const { stdout } = await promisify(execFile)(
        process.execPath,
        ['--input-type=module', '-e', source],
        { timeout: 30_000 },
      )
      expect(Date.now() - started).toBeLessThan(20_000)
      const pid = Number(stdout.trim())
      expect(await eventually(() => !alive(pid))).toBe(true)
    })
  }
})
