import { useState, useEffect, useRef, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()

interface UseSWROptions {
  ttl?: number  // milliseconds, default 5 min
  revalidate?: boolean  // auto refetch on mount
}

interface SWRState<T> {
  data: T | null
  loading: boolean
  error: string | null
  revalidate: () => void
}

export function useSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseSWROptions = {},
): SWRState<T> {
  const { ttl = 5 * 60 * 1000, revalidate = true } = options
  const [data, setData] = useState<T | null>(() => {
    const entry = cache.get(key)
    if (entry && Date.now() - entry.timestamp < ttl) return entry.data
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)

  const doFetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (result !== undefined) {
        cache.set(key, { data: result, timestamp: Date.now() })
        setData(result)
      }
    } catch (e: any) {
      setError(e?.message || 'Request failed')
    }
    setLoading(false)
  }, [key])

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    if (!revalidate && data) return
    doFetch()
  }, [key])

  return { data, loading, error, revalidate: doFetch }
}

export function clearSWRCache(pattern?: string) {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key)
    }
  } else {
    cache.clear()
  }
}
