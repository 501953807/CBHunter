export interface ProductRecommendation {
  work_item_id: string
  object_refs: { type: string; id: string; label: string }[]
  lifecycle_status: string
  lifecycle_label: string
  evidence_completeness: Record<string, 'present' | 'missing' | 'stale' | 'low_confidence'>
  evidence_summary: {
    total: number
    present: number
    missing: number
    stale: number
    low_confidence: number
  }
  category: string | null
  product_name: string
  product_name_cn: string
  target_platform: string
  target_market: string
  demand_level: string
  score: number
  search_volume: number | null
  competition_level: string
  avg_price_local: number | null
  avg_price_rmb_equivalent: number | null
  suggested_sourcing_price_rmb: string | null
  suggested_selling_price_local: number | null
  profit_potential: string
  keywords: string[]
  listing_tips: string[]
  trend_direction: string | null
  seasonal: boolean
  decision_level: 'green' | 'yellow' | 'red'
  decision_label: string
  decision_action: string
  source_refs: { type: string; id: string }[]
  evidence_window: string | null
  confidence_reason: string | null
  data_gaps?: string[]
  product_context: {
    category: string | null
    platform: string
    market: string
    trend: {
      search_volume: number | null
      trend_direction: string | null
      seasonal: boolean
      keywords: string[]
    }
    pricing: {
      avg_price_local: number | null
      avg_price_rmb_equivalent: number | null
      suggested_sourcing_price_rmb: string | null
      suggested_selling_price_local: number | null
    }
    evidence: {
      source_ref_count: number
      evidence_window: string | null
    }
  }
  experience_notes: {
    type: string
    title: string
    content: string
  }[]
}

export interface RecommenderBundle {
  platform: string
  market: string
  status?: string
  note?: string | null
  generated_at?: string | null
  available_categories: string[]
  total_recommendations: number
  high_demand_count: number
  high_profit_count: number
  recommendations: ProductRecommendation[]
}

export interface RecommenderReadiness {
  platform: string
  market: string
  rules_decision_status: 'ready' | 'data_required'
  model_training_status: 'ready' | 'data_required'
  counts: Record<string, number>
  minimums: Record<string, number>
  rule_gaps: string[]
  required_actions: string[]
  note: string
}
