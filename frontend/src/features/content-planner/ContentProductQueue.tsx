import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, PackageOpen, TriangleAlert } from 'lucide-react'
import { getContentWorkbench, type ContentWorkbenchItem } from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'

const STATUS_LABELS: Record<string, string> = {
  not_started: '待制作',
  in_progress: '制作中',
  ready: '内容完成',
}

export function ContentProductQueue({ onSelect, initialProductId = '', layout = 'table' }: {
  onSelect: (item: ContentWorkbenchItem) => void
  initialProductId?: string
  layout?: 'table' | 'rail'
}) {
  const [selectedId, setSelectedId] = useState('')
  const [queuePage, setQueuePage] = useState(1)
  const contentWorkbenchQuery = useQuery({
    queryKey: ['content-workbench'],
    queryFn: getContentWorkbench,
  })
  const workbench = contentWorkbenchQuery.data?.data || null

  useEffect(() => {
    const first = workbench?.items?.find(item => matchesProduct(item, initialProductId)) || workbench?.items?.[0]
    if (!first) return
    setSelectedId(first.work_item_id)
    const firstIndex = workbench?.items?.findIndex(item => item.work_item_id === first.work_item_id) ?? 0
    setQueuePage(Math.floor(Math.max(firstIndex, 0) / getPageSize(layout)) + 1)
    onSelect(first)
  }, [onSelect, initialProductId, layout, workbench])

  const items = workbench?.items || []
  const pageSize = getPageSize(layout)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(queuePage, totalPages)
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const startIndex = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(safePage * pageSize, items.length)

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
        {items.length > 0 && (
          <div aria-label="内容商品队列分页" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <span className="mr-auto">显示 {startIndex}-{endIndex} / {items.length}</span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setQueuePage(page => Math.max(1, page - 1))}
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              上一页
            </button>
            <span>第 {safePage}/{totalPages} 页</span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setQueuePage(page => Math.min(totalPages, page + 1))}
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              下一页
            </button>
          </div>
        )}

        {contentWorkbenchQuery.isError && (
          <div
            data-ui="content-workbench-error"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
          >
            <span className="text-[var(--color-danger)]">内容商品队列加载失败，当前 Listing 编制对象、内容任务矩阵和素材缺口暂不可用。</span>
            <button
              type="button"
              onClick={() => contentWorkbenchQuery.refetch()}
              className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
            >
              重新加载内容商品队列
            </button>
          </div>
        )}
        {!contentWorkbenchQuery.isError && items.length === 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
            <span>暂无已通过选品决策的商品。请先在选品决策完成绿灯/黄灯验证，再进入内容制作。</span>
          </div>
        )}
        {items.length > 0 && layout === 'rail' && (
          <div aria-label="内容商品侧边队列" className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {visibleItems.map((item) => {
              const active = item.work_item_id === selectedId
              const mediaReadiness = item.media_readiness
              const mediaGaps = mediaReadiness?.gaps || []
              return (
                <button
                  key={item.work_item_id}
                  onClick={() => { setSelectedId(item.work_item_id); onSelect(item) }}
                  className="w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]"
                  style={{ borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-bg)' }}
                >
                  <div className="flex gap-2">
                    {item.image_url ? (
                      <img src={productImageSrc(item.image_url)} alt={item.product_name} className="h-12 w-12 shrink-0 rounded-lg border object-cover" style={{ borderColor: 'var(--color-border)' }} />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border text-[10px] text-[var(--color-muted)]" style={{ borderColor: 'var(--color-border)' }}>无图</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.target_platform || '--'} / {item.target_market || '--'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)]">{STATUS_LABELS[item.content_status] || item.content_status}</span>
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)]">资料 {item.evidence_summary.present}/{item.evidence_summary.total}</span>
                  </div>
                  {mediaReadiness && (
                    <p className="mt-2 line-clamp-2 text-[11px] text-[var(--color-warning)]">
                      图片 {mediaReadiness.captured_image_count ?? 0}/{mediaReadiness.min_platform_images ?? 5}；{mediaGaps.length ? mediaGaps.join('、') : '素材基础达标'}
                    </p>
                  )}
                  {item.content_gaps.length > 0 && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-warning)]">{item.content_gaps.join('、')}</p>}
                </button>
              )
            })}
          </div>
        )}
        {items.length > 0 && layout === 'table' && (
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
            {visibleItems.map((item) => {
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
                          src={productImageSrc(item.image_url)}
                          alt={item.product_name}
                          className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-[var(--color-fg)]">{item.product_name}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-muted)]">资料 {item.evidence_summary.present}/{item.evidence_summary.total}</p>
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

function getPageSize(layout: 'table' | 'rail') {
  return layout === 'rail' ? 6 : 12
}

function matchesProduct(item: ContentWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}
