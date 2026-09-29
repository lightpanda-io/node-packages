#!/usr/bin/env node
// A stand-in lightpanda binary that prints its argv as JSON. The server modes
// linger like the real ones, until killed or for a second; `serve` also
// answers /json/version on its --host and --port.
import { createServer } from 'node:http'

const argv = process.argv.slice(2)
process.stdout.write(JSON.stringify(argv))
if (argv[0] === 'serve') {
  const flag = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
  const server = createServer((_, res) => res.end('{}'))
  server.listen(Number(flag('--port')), flag('--host'))
  setTimeout(() => server.close(), 1000)
} else if (argv[0] === 'mcp') {
  setTimeout(() => {}, 1000)
}
