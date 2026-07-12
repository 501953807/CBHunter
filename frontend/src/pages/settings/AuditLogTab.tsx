import { useState } from 'react'
import { Clock, Download } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { useAuditLogs } from '../../hooks/useAudit'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { AuditLogParams } from '../../api/audit'
import { auditActionLabel, auditResourceLabel, shortResourceId } from '../../utils/auditLabels'

export default function AuditLogTab() {
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const params: AuditLogParams = { page, page_size: pageSize }
  if (userId) params.user_id = userId
  if (action) params.action = action
  if (resourceType) params.resource_type = resourceType
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const { data: res, isLoading } = useAuditLogs(params)
  const items = (res?.data ?? []) as any[]
  const meta = res?.meta
  const totalPages = meta?.total_pages ?? 0

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch (error) {
      logger.warn('Audit timestamp formatting failed', error)
      return ts
    }
  }

  const truncate = (s: string | null, max = 80) => {
    if (!s) return '-'
    return s.length > max ? s.slice(0, max) + '...' : s
  }

  return (
    <Card>
      <CardContent>
        <EvidenceBanner evidence={res} compact />
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
            placeholder="按用户ID筛选"
          />

          <input
            type="text"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-fg)',
            }}
            placeholder="按操作编码筛选"
          />

          <input
            type="text"
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
            placeholder="按资源类型筛选"
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-fg)',
            }}
            placeholder="开始日期"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-fg)',
            }}
            placeholder="结束日期"
          />

          {(userId || action || resourceType || dateFrom || dateTo) && (
            <button
              onClick={() => { setUserId(''); setAction(''); setResourceType(''); setDateFrom(''); setDateTo(''); setPage(1) }}
              className="text-xs px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--color-border)]"
              style={{ color: 'var(--color-muted)' }}
            >
              清除筛选
            </button>
          )}
          <button
            disabled={items.length === 0}
            onClick={() => exportAuditCsv(items, formatTime)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            title={items.length === 0 ? '暂无可导出日志' : '导出当前页审计日志 CSV'}
          >
            <Download className="h-3.5 w-3.5" />
            导出当前页
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>时间</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>用户</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>资源</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>变更详情</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center" style={{ color: 'var(--color-muted)' }}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center" style={{ color: 'var(--color-muted)' }}>
                    <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-border)' }} />
                    暂无审计日志
                  </td>
                </tr>
              ) : (
                items.map((item: any) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-[var(--color-bg)]"
                    style={{ borderBottom: `1px solid var(--color-border)` }}
                  >
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {formatTime(item.created_at)}
                    </td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-fg)' }}>
                      {item.username}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          color: 'var(--color-info)',
                          backgroundColor: 'color-mix(in oklch, var(--color-info) 15%, transparent)',
                        }}>
                        {auditActionLabel(item.action)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-muted)' }}>
                      <span className="text-xs">{auditResourceLabel(item.resource_type)}</span>
                      <span className="text-xs ml-1" style={{ color: 'var(--color-fg)' }} title={item.resource_id}>{shortResourceId(item.resource_id)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {item.detail || truncate(item.new_value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid var(--color-border)` }}>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              共 {meta?.total ?? 0} 条记录，第 {page}/{totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="text-xs px-3 py-1.5 rounded-md border transition-colors hover:bg-[var(--color-border)] disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="text-xs px-3 py-1.5 rounded-md border transition-colors hover:bg-[var(--color-border)] disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function exportAuditCsv(items: any[], formatTime: (value: string) => string) {
  const rows = [
    ['时间', '用户', '操作', '资源类型', '资源ID', '变更详情'],
    ...items.map((item) => [
      formatTime(item.created_at),
      item.username,
      auditActionLabel(item.action),
      auditResourceLabel(item.resource_type),
      item.resource_id,
      item.detail || item.new_value || '',
    ]),
  ]
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'CBHunter-audit-current-page.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}
