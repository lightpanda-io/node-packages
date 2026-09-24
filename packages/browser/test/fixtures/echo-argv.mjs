#!/usr/bin/env node
// A stand-in lightpanda binary that prints its argv as JSON. The server modes
// linger like the real ones, until killed or for a second.
process.stdout.write(JSON.stringify(process.argv.slice(2)))
if (['serve', 'mcp'].includes(process.argv[2])) setTimeout(() => {}, 1000)
