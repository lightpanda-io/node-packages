// node examples/basic.ts [url]
import { Browser } from '@lightpanda/browser'

const url = process.argv[2] ?? 'https://example.com'

await using browser = await Browser.launch()
const page = await browser.newSession()
await page.goto({ url })
console.log(
  await page.extract({ schema: { title: 'h1', links: [{ selector: 'a', attr: 'href' }] } }),
)
