// Bootstrap a WebDriver session over BiDi's classic endpoint, with built-ins:
//   node examples/bidi.ts
import { BiDiServer } from '@lightpanda/browser'

await using server = await BiDiServer.launch()
console.log('status:', await server.status())

const response = await fetch(`${server.httpEndpoint}/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ capabilities: { alwaysMatch: { webSocketUrl: true } } }),
})
const { value }: any = await response.json()
console.log('BiDi WebSocket:', value.capabilities.webSocketUrl)
await fetch(`${server.httpEndpoint}/session/${value.sessionId}`, { method: 'DELETE' })
