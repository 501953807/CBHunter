export function promotionPlatformSyncSummary(value: unknown) {
  const sync = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  if (!sync.schema) return '平台营销接口：未尝试同步'
  const connection = String(sync.connection_status || '连接状态待识别')
  const marketing = String(sync.marketing_operation_status || 'not_implemented')
  const gaps = Array.isArray(sync.data_gaps) ? sync.data_gaps.length : 0
  return `平台营销接口：${connection} · marketing ${marketing} · 缺口 ${gaps} 项`
}
