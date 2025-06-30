export const validateUrl = (url: string): void => {
  if (!url || typeof url !== 'string') {
    throw new Error(`URL is required and must be a string ${url}`)
  }

  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL format ${url}`)
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`URL must use http or https protocol ${url}`)
  }
}
