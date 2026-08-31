type Semver = `${number}.${number}.${number}`

type VersionArchItemType = {
  download_url: string
  shasum: string
  size: string
}

type VersionArchType = Record<string, VersionArchItemType> & {
  date: string
  version: Semver
}

export type VersionType = Record<Semver | 'nightly', VersionArchType>
