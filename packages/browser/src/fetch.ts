import { execSync } from 'node:child_process'
import { validateUrl } from './utils'

export const fetch = (url: string) => {
  validateUrl(url)

  return new Promise<string>((resolve, reject) => {
    try {
      const e = execSync(`./lightpanda fetch --dump ${url}`)

      resolve(e.toString())
    } catch (error) {
      reject(error)
    }
  })
}
