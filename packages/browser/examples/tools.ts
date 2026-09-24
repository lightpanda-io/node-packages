// List the browser tools this install exposes, with no network needed:
//   node examples/tools.ts
import { Browser, bundledBrowserVersion, findBinary } from '@lightpanda/browser'

console.log(`binary: ${findBinary()}`)
console.log(`bundled browser: ${bundledBrowserVersion() ?? 'none'}`)

await using browser = await Browser.launch()
for (const [name, { description }] of Object.entries(browser.tools)) {
  console.log(`${name.padEnd(22)} ${description.split('\n')[0]}`)
}
