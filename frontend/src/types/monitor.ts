export interface CompetitorItem {
  id: string
  platform: string
  name: string
  seller_name: string | null
  price: number | null
  currency: string | null
  market: string | null
  collection_method: string | null
  confidence_level: string | null
  is_new_24h: boolean
  prev_price: number | null
  sales_estimate: number | null
  rating: number | null
  review_count: number | null
  is_tracked: boolean
  last_updated: string | null
}

export interface CompetitorDashboard {
  status?: 'ready' | 'data_required'
  total_tracked: number
  price_changes_24h: number
  new_listings_24h: number
  delisted_24h: number | null
  competitors: CompetitorItem[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
}

export interface AlertRuleInput {
  competitor_id: string
  condition: string
  threshold: number
}
