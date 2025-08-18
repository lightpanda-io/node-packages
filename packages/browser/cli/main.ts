#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { download } from '../src/download'

yargs(hideBin(process.argv))
  .command(
    'upgrade',
    'Upgrade the browser to the latest nightly version',
    () => {},
    _ => {
      download()
    },
  )
  .command(
    '$0',
    'Default',
    () => {},
    _ => {
      console.info('ℹ️ Please enter a command')
    },
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .parse()
