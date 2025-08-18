#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import packageJson from '../package.json' with { type: 'json' }
import { download } from '../src/download'

yargs(hideBin(process.argv))
  .command(
    'upgrade',
    'Upgrade the browser to the latest nightly version',
    () => {},
    _ => {
      download(`node_modules/${packageJson.name}/dist/lightpanda`)
    },
  )
  .command(
    '$0',
    'Default',
    () => {},
    _ => {
      console.info('Please enter a command')
    },
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .parse()
