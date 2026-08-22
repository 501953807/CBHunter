import type { ChangeEventHandler } from 'react'
import { PackageOpen, Search, TriangleAlert } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { Checkbox } from '../../components/ui/Checkbox'
import { productImageSrc } from '../../utils/productImages'
import { type BulkActionKind, STATUS_LABELS, storeContextLabel } from './ContentProductQueueUtils'

export { BulkActionWorkbench } from './ContentProductQueueBulkParts'

export function QueueCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  ariaLabel: string
}) {
  return (
    <Checkbox
      checked={checked}
      ref={element => { if (element) element.indeterminate = indeterminate }}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  )
}

export function QueueSummaryBar({ metrics }: { metrics?: { total?: number; not_started?: number; ready?: number } }) {
  return (
    <div data-ui="content-v5-queue-summary-bar" className="content-product-queue-summary-bar">
      <div className="content-product-queue-title">
        <PackageOpen className="h-4 w-4" />
        <h3>内容工厂商品列表</h3>
      </div>
      <span>共 {metrics?.total || 0} 个</span>
      <span>待制作 {metrics?.not_started || 0}</span>
      <span className="content-product-queue-success-text">已完成 {metrics?.ready || 0}</span>
    </div>
  )
}

export function SellerFilterToolbar({
  metrics,
  onPageSizeChange,
  onSearchChange,
  onStatusChange,
  searchTerm,
  statusFilter,
  tablePageSize,
}: {
  metrics?: { total?: number; not_started?: number; in_progress?: number; ready?: number }
  onPageSizeChange: (size: number) => void
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  searchTerm: string
  statusFilter: string
  tablePageSize: number
}) {
  return (
    <div aria-label="内容商品卖家后台筛选工具条" data-ui="content-product-seller-filter-toolbar" className="content-product-seller-filter-toolbar">
      <div className="content-product-search-box">
        <Search className="h-4 w-4" />
        <input
          value={searchTerm}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="搜索商品名称、平台、市场、类目"
          className="content-product-search-input"
        />
      </div>
      {[
        ['all', `全部 ${metrics?.total || 0}`],
        ['not_started', `待制作 ${metrics?.not_started || 0}`],
        ['in_progress', `制作中 ${metrics?.in_progress || 0}`],
        ['ready', `内容完成 ${metrics?.ready || 0}`],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onStatusChange(value)}
          className={statusFilter === value ? 'content-product-filter-chip content-product-filter-chip-active' : 'content-product-filter-chip'}
        >
          {label}
        </button>
      ))}
      <label className="content-product-page-size">
        每页
        <select
          value={tablePageSize}
          onChange={event => onPageSizeChange(Number(event.target.value))}
          className="content-product-page-size-select"
          aria-label="内容商品列表每页条数"
        >
          {[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
  )
}

export function BulkActionToolbar({
  allVisibleChecked,
  onRunBulkAction,
  onToggleVisible,
  partiallyChecked,
  selectedItems,
}: {
  allVisibleChecked: boolean
  onRunBulkAction: (action: BulkActionKind) => void
  onToggleVisible: () => void
  partiallyChecked: boolean
  selectedItems: ContentWorkbenchItem[]
}) {
  return (
    <div
      aria-label="内容商品批量操作工具栏"
      data-ui="content-product-bulk-action-toolbar"
      className="content-product-bulk-action-toolbar"
    >
      <span className="content-product-check-label">
        <QueueCheckbox checked={allVisibleChecked} indeterminate={partiallyChecked} onChange={onToggleVisible} ariaLabel="选择当前页内容商品" />
        当前页全选
      </span>
      <span>已选择 {selectedItems.length} 个商品</span>
      <span>发布图缺口 {selectedItems.filter(item => (item.media_readiness?.missing_image_count || 0) > 0).length}</span>
      <span>内容未完成 {selectedItems.filter(item => item.content_status !== 'ready').length}</span>
      <div className="content-product-bulk-action-set">
        <button type="button" disabled={selectedItems.length === 0} onClick={() => onRunBulkAction('copy')} className="content-product-secondary-action" title="生成批量文案处理队列，逐个进入 Listing 编辑区处理">
          批量生成文案
        </button>
        <button type="button" disabled={selectedItems.length === 0} onClick={() => onRunBulkAction('media')} className="content-product-secondary-action" title="生成批量发布图处理队列，逐个进入图片工作台补图/校验">
          批量校验素材
        </button>
        <button type="button" disabled={selectedItems.length === 0} onClick={() => onRunBulkAction('pricing')} className="content-product-secondary-action" title="生成定价校验处理队列，逐个进入定价页或 Listing 价格区">
          送入定价校验
        </button>
      </div>
    </div>
  )
}

export function SelectionCommandDeck({
  onOpenListing,
  onOpenMediaWorkbench,
  onOpenRow,
  selectedAttributeGaps,
  selectedContentGaps,
  selectedItems,
  selectedMediaGaps,
  selectedPricingUrl,
  selectedPublishUrl,
}: {
  onOpenListing?: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
  onOpenRow: (item: ContentWorkbenchItem) => void
  selectedAttributeGaps: number
  selectedContentGaps: number
  selectedItems: ContentWorkbenchItem[]
  selectedMediaGaps: number
  selectedPricingUrl: string
  selectedPublishUrl: string
}) {
  return (
    <section aria-label="已选内容商品发布准备操作台" data-ui="content-product-selection-command-deck" className="content-product-selection-command-deck">
      <div className="min-w-0">
        <div className="content-product-selection-chip-row">
          <span className="content-product-selection-primary-chip">已选 {selectedItems.length} 个商品</span>
          <span>发布图缺口 {selectedMediaGaps}</span>
          <span>属性缺口 {selectedAttributeGaps}</span>
          <span>内容缺口 {selectedContentGaps}</span>
        </div>
        <p className="content-product-selection-note">
          已选商品先在内容工厂补齐 Listing、发布图、SKU/属性/物流，再按目标店铺进入定价或批量刊登；这里不伪造批量生成或平台发布结果。
        </p>
        <div className="content-product-selection-strip">
          {selectedItems.slice(0, 8).map(item => (
            <button key={`selected-${item.work_item_id}`} type="button" onClick={() => onOpenRow(item)} className="content-product-selection-item">
              <span>{item.product_name}</span>
              <span>{item.target_platform || '--'} / {storeContextLabel(item)}</span>
            </button>
          ))}
          {selectedItems.length > 8 && <span className="content-product-selection-more">另 {selectedItems.length - 8} 个</span>}
        </div>
      </div>
      <div className="content-product-selection-actions">
        <button
          type="button"
          onClick={() => {
            const first = selectedItems[0]
            if (!first) return
            onOpenRow(first)
            onOpenListing?.(first)
          }}
          className="content-product-primary-outline-action"
        >
          打开首个 Listing
        </button>
        {onOpenMediaWorkbench && (
          <button
            type="button"
            onClick={() => {
              const first = selectedItems.find(item => (item.media_readiness?.missing_image_count || 0) > 0) || selectedItems[0]
              if (!first) return
              onOpenRow(first)
              onOpenMediaWorkbench(first)
            }}
            className="content-product-primary-outline-action"
          >
            处理首个发布图
          </button>
        )}
        <a href={selectedPricingUrl} className="content-product-secondary-action">送入定价</a>
        <a href={selectedPublishUrl} className="content-product-primary-action">进入批量刊登</a>
      </div>
    </section>
  )
}

export function QueuePagination({
  endIndex,
  itemCount,
  onNext,
  onPrevious,
  safePage,
  startIndex,
  totalPages,
}: {
  endIndex: number
  itemCount: number
  onNext: () => void
  onPrevious: () => void
  safePage: number
  startIndex: number
  totalPages: number
}) {
  return (
    <div aria-label="内容商品队列分页" className="content-product-pagination">
      <span>显示 {startIndex}-{endIndex} / {itemCount}</span>
      <button type="button" disabled={safePage <= 1} onClick={onPrevious} className="content-product-pagination-button">
        上一页
      </button>
      <small>第 {safePage}/{totalPages} 页</small>
      <button type="button" disabled={safePage >= totalPages} onClick={onNext} className="content-product-pagination-button">
        下一页
      </button>
    </div>
  )
}

export function ContentQueueError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-ui="content-workbench-error" className="content-product-error-panel">
      <span>内容商品队列加载失败，当前 Listing 编制对象、内容任务矩阵和发布图缺口暂不可用。</span>
      <button type="button" onClick={onRetry} className="content-product-danger-action">
        重新加载内容商品队列
      </button>
    </div>
  )
}

export function ContentQueueEmpty() {
  return (
    <div className="content-product-empty-state">
      <TriangleAlert className="h-4 w-4" />
      <span>暂无已通过选品决策的商品。请先在选品决策完成绿灯/黄灯验证，再进入内容制作。</span>
    </div>
  )
}

export function ContentProductRailList({
  items,
  onOpenRow,
  selectedId,
}: {
  items: ContentWorkbenchItem[]
  onOpenRow: (item: ContentWorkbenchItem) => void
  selectedId: string
}) {
  return (
    <div aria-label="内容商品侧边队列" className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
      {items.map((item) => {
        const active = item.work_item_id === selectedId
        const mediaReadiness = item.media_readiness
        const mediaGaps = mediaReadiness?.gaps || []
        return (
          <button
            key={item.work_item_id}
            onClick={() => onOpenRow(item)}
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
                发布图 {mediaReadiness.captured_image_count ?? 0}/{mediaReadiness.min_platform_images ?? 5}；{mediaGaps.length ? mediaGaps.join('、') : '发布图基础达标'}
              </p>
            )}
            {item.content_gaps.length > 0 && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-warning)]">{item.content_gaps.join('、')}</p>}
          </button>
        )
      })}
    </div>
  )
}
