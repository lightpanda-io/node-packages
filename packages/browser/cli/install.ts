#!/usr/bin/env node

import packageJson from './../package.json' with { type: 'json' }
import { download } from './../src/download'

const install = async () => {
  console.info('⏳ Downloading latest version of Lightpanda browser…')

  await download(`node_modules/${packageJson.name}/dist/lightpanda`)
  console.info('✅ Download finished!')
}

install()
