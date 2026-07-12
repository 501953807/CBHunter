import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '../api/audit'
import type { AuditLogParams } from '../api/audit'

export function useAuditLogs(params?: AuditLogParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => getAuditLogs(params),
  })
}
