import client from './client'

export interface TrendSeed {
  id: string
  category_id: string
  keyword: string
  market: string | null
  language: string
  is_default: boolean
  is_active: boolean
  tags: string[]
  last_used_at: string | null
  updated_at: string | null
}

export async function listSeeds(params?: {
  category_id?: string
  market?: string
  active_only?: boolean
  page?: number
  page_size?: number
}) {
  const res = await client.get<{ data: { seeds: TrendSeed[]; total: number }; meta?: any; error: string | null }>(
    '/seeds',
    { params },
  )
  return res.data
}

export async function createSeed(data: Partial<TrendSeed>) {
  const res = await client.post('/seeds', data)
  return res.data
}

export async function updateSeed(seedId: string, data: Partial<TrendSeed>) {
  const res = await client.put(`/seeds/${seedId}`, data)
  return res.data
}

export async function deleteSeed(seedId: string) {
  const res = await client.delete(`/seeds/${seedId}`)
  return res.data
}

export async function resetSeeds() {
  const res = await client.post('/seeds/reset-defaults')
  return res.data
}

export async function discoverSeeds(markets: string[]) {
  const res = await client.post('/seeds/discover', { markets })
  return res.data
}
