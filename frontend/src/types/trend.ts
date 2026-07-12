/** Cross-validation types for Google Trends + Pinterest Trends comparison. */

export interface TrendSourceData {
  direction: string
  growth: number | null
  volume: number | null
  trend_data: number[]
}

export interface CrossValidationResult {
  keyword: string
  market: string
  category: string
  match_type: 'exact' | 'substring' | 'token_overlap' | 'category_loose'
  similarity: number
  google: TrendSourceData | null
  pinterest: TrendSourceData | null
  cross_score: number | null
  signal_strength: 'strong' | 'moderate' | 'weak' | 'conflicting' | 'no_data'
  consensus_direction: string | null
  auto_signaled: boolean
}

export interface CrossValidatedKeyword {
  id: string
  keyword: string
  market: string
  category: string
  search_volume: number | null
  trend_direction: string | null
  growth_pct: number | null
  trend_data: number[]
  pinterest_volume: number | null
  pinterest_direction: string | null
  pinterest_growth: number | null
  pinterest_trend_data: number[]
  has_pinterest_data: boolean
  cross_validation_score: number | null
  cross_validation_detail: {
    match_type: string
    similarity: number
    signal_strength: string
    windows?: Record<string, any>
  } | null
  cross_validated_at: string | null
}
