import { describe, expect, test } from 'vitest'
import { dump } from '../index.js'
import { NO_BINARY, PNG_MAGIC, binary, fixtureServer } from './helpers.js'

describe.skipIf(NO_BINARY)('dump', () => {
  test('dumps html by default', async () => {
    const html = await dump(`${await fixtureServer()}/index.html`, { binary })
    expect(typeof html).toBe('string')
    expect(html).toMatch(/Hello from the fixture/)
    expect(html).toMatch(/<h1 id="headline">/)
  })

  test('dumps markdown', async () => {
    const markdown = await dump(`${await fixtureServer()}/index.html`, {
      binary,
      format: 'markdown',
    })
    expect(markdown).toMatch(/Hello from the fixture/)
    expect(markdown).not.toMatch(/<h1/)
  })

  test('dumps png as bytes', async () => {
    const png = await dump(`${await fixtureServer()}/index.html`, { binary, format: 'png' })
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC)
  })

  test('passes extra flags through', async () => {
    const url = `${await fixtureServer()}/index.html`
    const html = await dump(url, { binary, args: ['--dump-selector', 'ul.items'] })
    expect(html).toMatch(/First item/)
    expect(html).not.toMatch(/headline/)
  })

  test('rejects with the exit detail', async () => {
    const url = `${await fixtureServer()}/missing.html`
    const err = await dump(url, { binary, args: ['--fail-on-http-error'] }).catch(e => e)
    expect(err.name).toBe('RunError')
    expect(err.exitCode).not.toBe(0)
    expect(err.signal).toBeUndefined()
    expect(typeof err.stderr).toBe('string')
  })

  test('honours timeout', async () => {
    const url = `${await fixtureServer()}/index.html`
    await expect(dump(url, { binary, timeout: 1 })).rejects.toMatchObject({
      name: 'RunError',
      message: expect.stringMatching(/killed/),
      signal: 'SIGTERM',
    })
  })
})
