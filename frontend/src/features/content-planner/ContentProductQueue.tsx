import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Edit3, FileText, PackageOpen, Search, TriangleAlert } from 'lucide-react'
import { getContentWorkbench, type ContentWorkbenchItem } from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'

const STATUS_LABELS: Record<string, string> = {
  not_started: '待制作',
  in_progress: '制作中',
  ready: '内容完成',
}

export function ContentProductQueue({
  onSelect,
  onOpenListing,
  initialProductId = '',
  layout = 'table',
  autoSelect = false,
}: {
  onSelect: (item: ContentWorkbenchItem) => void
  onOpenListing?: (item: ContentWorkbenchItem) => void
  initialProductId?: string
  layout?: 'table' | 'rail'
  autoSelect?: boolean
}) {
  const [selectedId, setSelectedId] = useState('')
  const [queuePage, setQueuePage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const contentWorkbenchQuery = useQuery({
    queryKey: ['content-workbench'],
    queryFn: getContentWorkbench,
  })
  const workbench = contentWorkbenchQuery.data?.data || null

  useEffect(() => {
    const first = workbench?.items?.find(item => matchesProduct(item, initialProductId)) || (autoSelect ? workbench?.items?.[0] : undefined)
    if (!first) return
    setSelectedId(first.work_item_id)
    const firstIndex = workbench?.items?.findIndex(item => item.work_item_id === first.work_item_id) ?? 0
    setQueuePage(Math.floor(Math.max(firstIndex, 0) / getPageSize(layout)) + 1)
    onSelect(first)
  }, [onSelect, initialProductId, layout, workbench, autoSelect])

  const items = (workbench?.items || []).filter(item => {
    const statusMatched = statusFilter === 'all' || item.content_status === statusFilter
    const keyword = searchTerm.trim().toLowerCase()
    const keywordMatched = !keyword || [item.product_name, item.target_platform, item.target_market, item.category].some(value => (value || '').toLowerCase().includes(keyword))
    return statusMatched && keywordMatched
  })
  const pageSize = getPageSize(layout)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(queuePage, totalPages)
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const startIndex = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(safePage * pageSize, items.length)

  return (
    <Card className="h-full">
      <CardContent className="space-y-3 p-0">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <div className="mr-auto flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="font-semibold text-[var(--color-fg)]">内容工厂商品列表</h3>
          </div>
          <span className="text-xs text-[var(--color-muted)]">共 {workbench?.metrics.total || 0} 个</span>
          <span className="text-xs text-[var(--color-muted)]">待制作 {workbench?.metrics.not_started || 0}</span>
          <span className="text-xs text-[var(--color-success)]">已完成 {workbench?.metrics.ready || 0}</span>
        </div>
        {layout === 'table' && (
          <div aria-label="内容商品卖家后台筛选工具条" data-ui="content-product-seller-filter-toolbar" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--color-muted)]" />
              <input
                value={searchTerm}
                onChange={event => { setSearchTerm(event.target.value); setQueuePage(1) }}
                placeholder="搜索商品名称、平台、市场、类目"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)]"
              />
            </div>
            {[
              ['all', `全部 ${workbench?.metrics.total || 0}`],
              ['not_started', `待制作 ${workbench?.metrics.not_started || 0}`],
              ['in_progress', `制作中 ${workbench?.metrics.in_progress || 0}`],
              ['ready', `内容完成 ${workbench?.metrics.ready || 0}`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setStatusFilter(value); setQueuePage(1) }}
                className={statusFilter === value ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)]' : 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div aria-label="内容商品队列分页" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
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
          <div className="min-h-[calc(100vh-300px)] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]" style={{ scrollbarWidth: 'thin' }} data-ui="content-product-seller-console-table">
            <table className="w-full min-w-[1480px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-3 py-2">商品信息</th>
                  <th className="px-3 py-2">平台 / 店铺 / 市场</th>
                  <th className="px-3 py-2">内容状态</th>
                  <th className="px-3 py-2">图片 / 视频</th>
                  <th className="px-3 py-2">标题 / 描述</th>
                  <th className="px-3 py-2">SKU / 属性</th>
                  <th className="px-3 py-2">价格 / 库存</th>
                  <th className="px-3 py-2">待处理缺口</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
            {visibleItems.map((item) => {
              const active = item.work_item_id === selectedId
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
                  <td className="px-3 py-3 text-[var(--color-muted)]">
                    <p className="font-medium text-[var(--color-fg)]">{item.target_platform || '--'}</p>
                    <p className="mt-1 text-[11px]">店铺：发布前选择/覆盖</p>
                    <p className="mt-1 text-[11px]">市场：{item.target_market || '--'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                    {item.content_status === 'ready'
                      ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                      : <FileText className="h-4 w-4 text-[var(--color-warning)]" />}
                      <span className="text-[var(--color-fg)]">{STATUS_LABELS[item.content_status] || item.content_status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.lifecycle_label}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className={mediaReadiness && (mediaReadiness.captured_image_count ?? 0) >= (mediaReadiness.min_platform_images ?? 5) ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                      图片 {mediaReadiness?.captured_image_count ?? 0}/{mediaReadiness?.min_platform_images ?? 5}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">视频：{item.content_brief?.video_script ? '已有脚本' : '待生成/可选'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="line-clamp-2 text-[var(--color-fg)]">{item.content_brief?.title || item.product_name}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">卖点 {brief.length}/5 · 描述 {brief.join('').length} 字</p>
                  </td>
                  <td className="min-w-72 px-3 py-3">
                    <PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={1} />
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">SKU/变体：发布前校验</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-[var(--color-fg)]">{item.selling_price_local != null ? item.selling_price_local : '待定价'}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">采购 {item.source_price_rmb != null ? `¥${item.source_price_rmb}` : '待补'} · 利润 {item.profit_margin_pct != null ? `${item.profit_margin_pct}%` : '待校验'}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">库存：发布/同步后回写</p>
                  </td>
                  <td className="px-3 py-3">
                    {[...item.content_gaps, ...mediaGaps].length > 0
                      ? <p className="line-clamp-3 text-[11px] text-[var(--color-warning)]">{[...item.content_gaps, ...mediaGaps].slice(0, 5).join('、')}</p>
                      : <span className="text-[var(--color-success)]">无阻断缺口</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedId(item.work_item_id)
                          onSelect(item)
                          onOpenListing?.(item)
                        }}
                        className="inline-flex items-center rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-surface)]"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        编辑 Listing
                      </button>
                    </div>
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
  return layout === 'rail' ? 6 : 20
}

function matchesProduct(item: ContentWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}
