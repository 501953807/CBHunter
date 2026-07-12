import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, PackageOpen, TriangleAlert } from 'lucide-react'
import { getContentWorkbench, type ContentWorkbench, type ContentWorkbenchItem } from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { logger } from '../../utils/logger'

const STATUS_LABELS: Record<string, string> = {
  not_started: '待制作',
  in_progress: '制作中',
  ready: '内容完成',
}

export function ContentProductQueue({ onSelect, initialProductId = '' }: { onSelect: (item: ContentWorkbenchItem) => void; initialProductId?: string }) {
  const [workbench, setWorkbench] = useState<ContentWorkbench | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getContentWorkbench().then((response) => {
      if (cancelled) return
      const data = response.data || null
      setWorkbench(data)
      const first = data?.items?.find(item => matchesProduct(item, initialProductId)) || data?.items?.[0]
      if (first) {
        setSelectedId(first.work_item_id)
        onSelect(first)
      }
    }).catch((e: any) => {
      logger.error('Load content workbench failed', e)
      if (!cancelled) setError(e?.response?.data?.detail || e?.message || '内容商品队列加载失败')
    })
    return () => { cancelled = true }
  }, [onSelect, initialProductId])

  const items = workbench?.items || []

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="font-semibold text-[var(--color-fg)]">待制作商品队列</h3>
          </div>
          <span className="text-xs text-[var(--color-muted)]">共 {workbench?.metrics.total || 0} 个</span>
          <span className="text-xs text-[var(--color-muted)]">待制作 {workbench?.metrics.not_started || 0}</span>
          <span className="text-xs text-[var(--color-success)]">已完成 {workbench?.metrics.ready || 0}</span>
        </div>

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        {!error && items.length === 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
            <span>暂无已通过选品决策的商品。请先在选品决策完成绿灯/黄灯验证，再进入内容制作。</span>
          </div>
        )}
        {items.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-xl border border-[var(--color-border)]" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">平台/市场</th>
                  <th className="px-3 py-2">内容状态</th>
                  <th className="px-3 py-2">平台字段组</th>
                  <th className="px-3 py-2">素材/卖点</th>
                  <th className="px-3 py-2">缺口</th>
                </tr>
              </thead>
              <tbody>
            {items.map((item) => {
              const active = item.work_item_id === selectedId
              const media = item.platform_requirements?.media || []
              const brief = item.content_brief?.bullets || []
              const mediaReadiness = item.media_readiness
              const mediaGaps = mediaReadiness?.gaps || []
              return (
                <tr
                  key={item.work_item_id}
                  onClick={() => { setSelectedId(item.work_item_id); onSelect(item) }}
                  className="cursor-pointer border-b border-[var(--color-border)] align-top transition-colors hover:bg-[var(--color-bg)]"
                  style={{ backgroundColor: active ? 'var(--color-primary-light)' : 'transparent' }}
                >
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 gap-2">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-[var(--color-fg)]">{item.product_name}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">证据 {item.evidence_summary.present}/{item.evidence_summary.total}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{item.target_platform || '--'} / {item.target_market || '--'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                    {item.content_status === 'ready'
                      ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                      : <FileText className="h-4 w-4 text-[var(--color-warning)]" />}
                      <span className="text-[var(--color-fg)]">{STATUS_LABELS[item.content_status] || item.content_status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.lifecycle_label}</p>
                  </td>
                  <td className="min-w-72 px-3 py-3">
                    <PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={2} />
                  </td>
                  <td className="px-3 py-3">
                    {media.length > 0 && <p className="line-clamp-1 text-[11px] text-[var(--color-muted)]">素材：{media.join('、')}</p>}
                    {mediaReadiness && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-[var(--color-warning)]" aria-label="媒体缺口">
                        已采集 {mediaReadiness.captured_image_count ?? 0} 张图 / 至少 {mediaReadiness.min_platform_images ?? 5} 张；{mediaGaps.length ? mediaGaps.join('、') : '图片数量满足基础要求'}
                      </p>
                    )}
                    {brief.length > 0 && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-primary)]">卖点：{brief.join('、')}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {item.content_gaps.length > 0
                      ? <p className="line-clamp-3 text-[11px] text-[var(--color-warning)]">{item.content_gaps.join('、')}</p>
                      : <span className="text-[var(--color-success)]">无阻断缺口</span>}
                  </td>
                </tr>
              )
            })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function matchesProduct(item: ContentWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}
