export interface ApiResponse<T = unknown> {
  data: T | null
  meta?: PaginationMeta | null
  error?: string | null
  status?: 'ready' | 'data_required' | 'configuration_required' | string | null
  source_refs?: SourceRef[]
  evidence_window?: string | null
  confidence_reason?: string | null
  data_gaps?: string[]
}

export interface SourceRef {
  type: string
  id?: string | null
  field?: string | null
  label?: string | null
  fields?: string[]
  meta?: Record<string, unknown>
}

export interface PaginationMeta {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PlatformAccount {
  id: string
  platform: string
  account_name: string
  shop_id: string | null
  settings?: Record<string, unknown> | null
  is_active: boolean
  last_sync_at: string | null
  created_at: string | null
}
