#!/usr/bin/env node
// A stand-in lightpanda binary: prints its argv as JSON and exits, so tests can
// check the exact command line a wrapper builds without running a browser. The
// server modes linger like the real ones, until killed or for a second.
process.stdout.write(JSON.stringify(process.argv.slice(2)))
if (['serve', 'mcp'].includes(process.argv[2])) setTimeout(() => {}, 1000)
