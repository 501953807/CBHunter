export interface AISuggestion {
  id: string
  suggestion_type: string
  title: string
  description: string
  severity: string
  confidence?: number | null
  category?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
  source_refs?: Array<{ type?: string; id?: string; label?: string }>
  evidence_window?: string | null
  confidence_reason?: string | null
  is_read: boolean
  is_applied: boolean
  is_dismissed: boolean
  created_at?: string | null
}
