export interface AuditLogEntry {
  id: string
  user_id: string
  username: string
  action: string
  resource_type: string
  resource_id: string
  old_value: string | null
  new_value: string | null
  detail: string | null
  created_at: string
}
