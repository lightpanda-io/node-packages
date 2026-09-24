// The argv checks run a stand-in binary that echoes its arguments.

import { describe, expect, test } from 'vitest'
import { Browser, LightpandaError, dump, runScript } from '../index.js'
import { ECHO, NO_BINARY, binary, fixtureServer } from './helpers.js'

const dumpArgv = async (options: Record<string, unknown>) =>
  JSON.parse(await dump('http://example.test/', { binary: ECHO, ...options }))

test('each kind of option becomes its flag', async () => {
  const argv = await dumpArgv({
    obeyRobots: true,
    httpProxy: 'http://proxy.test:3128',
    httpTimeout: 0,
    loadResources: ['stylesheet', 'image'],
    blockUrls: ['*doubleclick*', '*.png'],
    httpHeaders: { 'X-One': '1', 'X-Two': 'two words' },
  })
  expect(argv).toEqual([
    'fetch',
    '--dump',
    'html',
    '--obey-robots',
    '--http-proxy',
    'http://proxy.test:3128',
    '--http-timeout',
    '0',
    '--load-resources',
    'stylesheet,image',
    '--block-urls',
    '*doubleclick*',
    '--block-urls',
    '*.png',
    '--http-header',
    'X-One: 1',
    '--http-header',
    'X-Two: two words',
    'http://example.test/',
  ])
})

test('unset, null and false options add nothing', async () => {
  const argv = await dumpArgv({
    obeyRobots: false,
    httpProxy: undefined,
    userAgent: null,
    loadResources: [],
  })
  expect(argv).toEqual(['fetch', '--dump', 'html', 'http://example.test/'])
})

test('typed options go before args', async () => {
  const argv = await dumpArgv({ locale: 'fr-FR', args: ['--locale', 'de-DE'] })
  expect(argv).toEqual([
    'fetch',
    '--dump',
    'html',
    '--locale',
    'fr-FR',
    '--locale',
    'de-DE',
    'http://example.test/',
  ])
})

test('runScript passes the options and args before the script', async () => {
  const out = await runScript('script.js', {
    binary: ECHO,
    timezone: 'UTC',
    args: ['--log-level', 'warn'],
  })
  expect(JSON.parse(out)).toEqual(['run', '--timezone', 'UTC', '--log-level', 'warn', 'script.js'])
})

test('a mistyped option is rejected before anything runs', async () => {
  for (const options of [
    { obeyRobots: 'yes' },
    { httpTimeout: 1.5 },
    { httpTimeout: -1 },
    { loadResources: 'stylesheet' },
    { httpHeaders: ['X-One: 1'] },
    { httpHeaders: { 'X-One': 1 } },
  ]) {
    const err = await dumpArgv(options).catch(e => e)
    expect(err).toBeInstanceOf(LightpandaError)
    expect(err.name).toBe('LightpandaError')
    expect(err.message).toMatch(new RegExp(`option ${Object.keys(options)[0]} must be`))
  }
})

describe.skipIf(NO_BINARY)('options on a real browser', () => {
  test('dump sends httpHeaders', async () => {
    const html = await dump(`${await fixtureServer()}/echo-headers`, {
      binary,
      httpHeaders: { 'X-Lightpanda-Test': 'flags' },
    })
    expect(html).toMatch(/"x-lightpanda-test":"flags"/)
  })

  test('dump applies userAgentSuffix', async () => {
    const html = await dump(`${await fixtureServer()}/ua.html`, {
      binary,
      userAgentSuffix: 'flags-test/1.0',
    })
    expect(html).toMatch(/Lightpanda\/\S+ flags-test\/1\.0/)
  })

  test('Browser.launch applies userAgentSuffix', async () => {
    await using browser = await Browser.launch({ binary, userAgentSuffix: 'flags-test/1.0' })
    const page = await browser.newSession()
    await page.goto({ url: `${await fixtureServer()}/index.html` })
    expect(String(await page.evaluate({ script: 'navigator.userAgent' }))).toMatch(
      /flags-test\/1\.0$/,
    )
  })
})
