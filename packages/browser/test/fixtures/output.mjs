#!/usr/bin/env node
// A stand-in lightpanda binary that prints LP_FIXTURE_BYTES bytes, then exits
// with LP_FIXTURE_EXIT, after a message on stderr when that is not 0.
process.stdout.write('x'.repeat(Number(process.env.LP_FIXTURE_BYTES ?? 0)), () => {
  const code = Number(process.env.LP_FIXTURE_EXIT ?? 0)
  if (code) process.stderr.write('boom\n')
  process.exitCode = code
})
