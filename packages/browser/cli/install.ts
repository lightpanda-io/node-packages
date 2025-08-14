#!/usr/bin/env node

import packageJson from './../package.json' with { type: 'json' }
import { download } from './../src/download'

download(`${packageJson.name}/dist/lightpanda`)
