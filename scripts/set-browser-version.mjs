#!/usr/bin/env node
// Set the browser release the npm/<platform> packages carry and packages/browser pins.
// Usage: node scripts/set-browser-version.mjs 0.4.2

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const version = process.argv[2]?.replace(/^v/, '')
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: set-browser-version.mjs X.Y.Z')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const update = (path, change) => {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  change(manifest)
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

for (const platform of readdirSync(join(root, 'npm'))) {
  update(join(root, 'npm', platform, 'package.json'), manifest => {
    manifest.version = version
  })
}
update(join(root, 'packages', 'browser', 'package.json'), manifest => {
  for (const name of Object.keys(manifest.optionalDependencies)) {
    manifest.optionalDependencies[name] = version
  }
})
console.log(`browser version set to ${version}; regenerate the methods and add a changeset`)
