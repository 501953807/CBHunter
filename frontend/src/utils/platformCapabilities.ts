import type { DictPlatform } from '../api/config'

export function filterPlatformsByCapability(
  platforms: DictPlatform[],
  capability: string,
): DictPlatform[] {
  const matched = platforms.filter(p => p.capabilities?.includes(capability))
  return matched.length > 0 ? matched : platforms
}
