export interface KeywordResult {
  keyword: string
  platform: string
  search_volume: number
  competition_level: string
  avg_price?: number | null
  total_results: number
  related_keywords: { keyword: string; volume: number; competition: string }[]
  trend_data: { date: string; volume: number }[]
}

export interface SavedResearch {
  id: string
  keyword: string
  platform: string
  search_volume?: number | null
  competition_level?: string | null
  avg_price?: number | null
  analyzed_at?: string | null
}

export interface Competitor {
  id: string
  platform: string
  name: string
  seller_name?: string | null
  price?: number | null
  sales_estimate?: number | null
  rating?: number | null
  review_count?: number | null
  is_tracked: boolean
  last_updated?: string | null
}

export interface TrendingProduct {
  id: string
  platform: string
  name: string
  price_min?: number | null
  price_max?: number | null
  sales_volume?: number | null
  sales_growth_rate?: number | null
  category_path?: string | null
  category_label?: string | null
  tags?: string[]
}
