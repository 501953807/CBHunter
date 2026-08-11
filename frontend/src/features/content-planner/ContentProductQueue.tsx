import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, DollarSign, Edit3, FileText, Image, Megaphone, PackageOpen, Search, TriangleAlert } from 'lucide-react'
import { getContentWorkbench, type ContentWorkbenchItem } from '../../api/content'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'

const STATUS_LABELS: Record<string, string> = {
  not_started: '待制作',
  in_progress: '制作中',
  ready: '内容完成',
}

type BulkActionKind = 'copy' | 'media' | 'pricing'

export function ContentProductQueue({
  onSelect,
  onOpenListing,
  onOpenMediaWorkbench,
  initialProductId = '',
  layout = 'table',
  autoSelect = false,
}: {
  onSelect: (item: ContentWorkbenchItem) => void
  onOpenListing?: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
  initialProductId?: string
  layout?: 'table' | 'rail'
  autoSelect?: boolean
}) {
  const [selectedId, setSelectedId] = useState('')
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [queuePage, setQueuePage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [tablePageSize, setTablePageSize] = useState(20)
  const [bulkAction, setBulkAction] = useState<BulkActionKind | null>(null)
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
    setQueuePage(Math.floor(Math.max(firstIndex, 0) / getPageSize(layout, tablePageSize)) + 1)
    onSelect(first)
  }, [onSelect, initialProductId, layout, workbench, autoSelect, tablePageSize])

  const items = (workbench?.items || []).filter(item => {
    const statusMatched = statusFilter === 'all' || item.content_status === statusFilter
    const keyword = searchTerm.trim().toLowerCase()
    const keywordMatched = !keyword || [item.product_name, item.target_platform, item.target_market, item.category].some(value => (value || '').toLowerCase().includes(keyword))
    return statusMatched && keywordMatched
  })
  const pageSize = getPageSize(layout, tablePageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(queuePage, totalPages)
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  const startIndex = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIndex = Math.min(safePage * pageSize, items.length)
  const visibleIds = visibleItems.map(item => item.work_item_id)
  const selectedItems = useMemo(
    () => items.filter(item => checkedIds.includes(item.work_item_id)),
    [items, checkedIds],
  )
  const selectedPublishUrl = selectedItems.length > 0 ? bulkWorkflowUrl('/publish', selectedItems) : ''
  const selectedPricingUrl = selectedItems.length > 0 ? bulkWorkflowUrl('/pricing', selectedItems) : ''
  const selectedMediaGaps = selectedItems.filter(item => (item.media_readiness?.missing_image_count || 0) > 0).length
  const selectedContentGaps = selectedItems.filter(item => item.content_status !== 'ready' || item.content_gaps.length > 0).length
  const selectedAttributeGaps = selectedItems.filter(item => {
    const requiredAttributes = item.platform_requirements?.required_attributes || []
    const attributeValues = item.platform_requirements?.attribute_values || {}
    return requiredAttributes.some(field => !hasAttributeValue(attributeValues, field))
  }).length
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => checkedIds.includes(id))
  const partiallyChecked = visibleIds.some(id => checkedIds.includes(id)) && !allVisibleChecked

  const toggleVisible = () => {
    setCheckedIds(current => {
      if (allVisibleChecked) return current.filter(id => !visibleIds.includes(id))
      return Array.from(new Set([...current, ...visibleIds]))
    })
  }

  const toggleRow = (id: string) => {
    setCheckedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const runBulkAction = (action: BulkActionKind) => {
    if (selectedItems.length === 0) return
    setBulkAction(action)
  }

  const openRow = (item: ContentWorkbenchItem) => {
    setSelectedId(item.work_item_id)
    onSelect(item)
  }

  return (
    <Card className="content-product-queue-workbench h-full" data-ui="content-product-queue-workbench">
      <CardContent className="content-product-queue-content">
        <div data-ui="content-v5-queue-summary-bar" className="content-product-queue-summary-bar">
          <div className="content-product-queue-title">
            <PackageOpen className="h-4 w-4" />
            <h3>内容工厂商品列表</h3>
          </div>
          <span>共 {workbench?.metrics.total || 0} 个</span>
          <span>待制作 {workbench?.metrics.not_started || 0}</span>
          <span className="content-product-queue-success-text">已完成 {workbench?.metrics.ready || 0}</span>
        </div>
        {layout === 'table' && (
          <div aria-label="内容商品卖家后台筛选工具条" data-ui="content-product-seller-filter-toolbar" className="content-product-seller-filter-toolbar">
            <div className="content-product-search-box">
              <Search className="h-4 w-4" />
              <input
                value={searchTerm}
                onChange={event => { setSearchTerm(event.target.value); setQueuePage(1) }}
                placeholder="搜索商品名称、平台、市场、类目"
                className="content-product-search-input"
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
                className={statusFilter === value ? 'content-product-filter-chip content-product-filter-chip-active' : 'content-product-filter-chip'}
              >
                {label}
              </button>
            ))}
            <label className="content-product-page-size">
              每页
              <select
                value={tablePageSize}
                onChange={event => { setTablePageSize(Number(event.target.value)); setQueuePage(1) }}
                className="content-product-page-size-select"
                aria-label="内容商品列表每页条数"
              >
                {[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
        )}
        {layout === 'table' && items.length > 0 && (
          <div
            aria-label="内容商品批量操作工具栏"
            data-ui="content-product-bulk-action-toolbar"
            className="content-product-bulk-action-toolbar"
          >
            <label className="content-product-check-label">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                ref={element => { if (element) element.indeterminate = partiallyChecked }}
                onChange={toggleVisible}
                aria-label="选择当前页内容商品"
              />
              当前页全选
            </label>
            <span>已选择 {selectedItems.length} 个商品</span>
            <span>发布图缺口 {selectedItems.filter(item => (item.media_readiness?.missing_image_count || 0) > 0).length}</span>
            <span>内容未完成 {selectedItems.filter(item => item.content_status !== 'ready').length}</span>
            <div className="content-product-bulk-action-set">
              <button
                type="button"
                disabled={selectedItems.length === 0}
                onClick={() => runBulkAction('copy')}
                className="content-product-secondary-action"
                title="生成批量文案处理队列，逐个进入 Listing 编辑区处理"
              >
                批量生成文案
              </button>
              <button
                type="button"
                disabled={selectedItems.length === 0}
                onClick={() => runBulkAction('media')}
                className="content-product-secondary-action"
                title="生成批量发布图处理队列，逐个进入图片工作台补图/校验"
              >
                批量校验素材
              </button>
              <button
                type="button"
                disabled={selectedItems.length === 0}
                onClick={() => runBulkAction('pricing')}
                className="content-product-secondary-action"
                title="生成定价校验处理队列，逐个进入定价页或 Listing 价格区"
              >
                送入定价校验
              </button>
            </div>
          </div>
        )}
        {layout === 'table' && selectedItems.length > 0 && (
          <section
            aria-label="已选内容商品发布准备操作台"
            data-ui="content-product-selection-command-deck"
            className="content-product-selection-command-deck"
          >
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
                  <button
                    key={`selected-${item.work_item_id}`}
                    type="button"
                    onClick={() => openRow(item)}
                    className="content-product-selection-item"
                  >
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
                  openRow(first)
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
                    openRow(first)
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
        )}
        {layout === 'table' && bulkAction && selectedItems.length > 0 && (
          <BulkActionWorkbench
            action={bulkAction}
            items={selectedItems}
            onClose={() => setBulkAction(null)}
            onOpenListing={(item) => {
              setSelectedId(item.work_item_id)
              onSelect(item)
              onOpenListing?.(item)
            }}
            onOpenMediaWorkbench={onOpenMediaWorkbench ? (item) => {
              setSelectedId(item.work_item_id)
              onSelect(item)
              onOpenMediaWorkbench(item)
            } : undefined}
          />
        )}
        {items.length > 0 && (
          <div aria-label="内容商品队列分页" className="content-product-pagination">
            <span>显示 {startIndex}-{endIndex} / {items.length}</span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setQueuePage(page => Math.max(1, page - 1))}
              className="content-product-pagination-button"
            >
              上一页
            </button>
            <small>第 {safePage}/{totalPages} 页</small>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setQueuePage(page => Math.min(totalPages, page + 1))}
              className="content-product-pagination-button"
            >
              下一页
            </button>
          </div>
        )}

        {contentWorkbenchQuery.isError && (
          <div
            data-ui="content-workbench-error"
            className="content-product-error-panel"
          >
            <span>内容商品队列加载失败，当前 Listing 编制对象、内容任务矩阵和发布图缺口暂不可用。</span>
            <button
              type="button"
              onClick={() => contentWorkbenchQuery.refetch()}
              className="content-product-danger-action"
            >
              重新加载内容商品队列
            </button>
          </div>
        )}
        {!contentWorkbenchQuery.isError && items.length === 0 && (
          <div className="content-product-empty-state">
            <TriangleAlert className="h-4 w-4" />
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
                      发布图 {mediaReadiness.captured_image_count ?? 0}/{mediaReadiness.min_platform_images ?? 5}；{mediaGaps.length ? mediaGaps.join('、') : '发布图基础达标'}
                    </p>
                  )}
                  {item.content_gaps.length > 0 && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-warning)]">{item.content_gaps.join('、')}</p>}
                </button>
              )
            })}
          </div>
        )}
        {items.length > 0 && layout === 'table' && (
          <div className="content-product-table" style={{ scrollbarWidth: 'thin' }} data-ui="content-product-seller-console-table">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleChecked}
                        ref={element => { if (element) element.indeterminate = partiallyChecked }}
                        onChange={toggleVisible}
                        aria-label="选择当前页全部商品"
                      />
                    </th>
                  <th>商品信息</th>
                  <th>平台 / 店铺 / 市场</th>
                  <th>内容状态</th>
                  <th>发布图 / 视频</th>
                  <th>标题 / 描述</th>
                  <th>SKU / 属性</th>
                  <th>价格 / 库存</th>
                  <th>待处理缺口</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
            {visibleItems.map((item) => {
              const active = item.work_item_id === selectedId
              const brief = item.content_brief?.bullets || []
              const mediaReadiness = item.media_readiness
              const mediaGaps = mediaReadiness?.gaps || []
              const requiredAttributes = item.platform_requirements?.required_attributes || []
              const attributeValues = item.platform_requirements?.attribute_values || {}
              const filledAttributes = requiredAttributes.filter(field => hasAttributeValue(attributeValues, field)).length
              const productId = productIdForAction(item)
              const pricingUrl = workflowUrl('/pricing', item)
              const publishUrl = workflowUrl('/publish', item)
              return (
                <tr
                  key={item.work_item_id}
                  onClick={() => openRow(item)}
                  className={active ? 'content-product-row content-product-row-active' : 'content-product-row'}
                >
                  <td>
                      <input
                        type="checkbox"
                        checked={checkedIds.includes(item.work_item_id)}
                        onClick={event => event.stopPropagation()}
                        onChange={() => toggleRow(item.work_item_id)}
                        aria-label={`选择商品 ${item.product_name}`}
                      />
                    </td>
                  <td>
                    <div className="content-product-info-cell">
                      {item.image_url ? (
                        <img
                          src={productImageSrc(item.image_url)}
                          alt={item.product_name}
                        />
                      ) : (
                        <div className="content-product-image-missing">缺主图</div>
                      )}
                      <div>
                        <p className="content-product-name">{item.product_name}</p>
                        <p>资料 {item.evidence_summary.present}/{item.evidence_summary.total}</p>
                        <p>ID：{productId}</p>
                      </div>
                    </div>
                  </td>
                  <td data-ui="content-product-store-context-summary">
                    <p className="content-product-strong-text">{item.target_platform || '--'}</p>
                    <p>{storeContextLabel(item)}</p>
                    <p>市场：{item.target_market || '--'}</p>
                    <p>{objectRefContextLabel(item)}</p>
                  </td>
                  <td>
                    <div className="content-product-status-line">
                    {item.content_status === 'ready'
                      ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                      : <FileText className="h-4 w-4 text-[var(--color-warning)]" />}
                      <span>{STATUS_LABELS[item.content_status] || item.content_status}</span>
                    </div>
                    <p>{item.lifecycle_label}</p>
                  </td>
                  <td>
                    <p className={mediaReadiness && (mediaReadiness.captured_image_count ?? 0) >= (mediaReadiness.min_platform_images ?? 5) ? 'content-product-success-text' : 'content-product-warning-text'}>
                      发布图 {mediaReadiness?.captured_image_count ?? 0}/{mediaReadiness?.min_platform_images ?? 5}
                    </p>
                    <p>推荐 {mediaReadiness?.recommended_platform_images ?? 9} 张 · 主图/辅图/SKU图</p>
                    <p>视频：{item.content_brief?.video_script ? '已有脚本' : '待生成/可选'}</p>
                  </td>
                  <td>
                    <p className="content-product-copy-title">{item.content_brief?.title || item.product_name}</p>
                    <p>卖点摘要 {brief.length} 项 · 描述 {brief.join('').length} 字</p>
                  </td>
                  <td className="content-product-attribute-cell">
                    <PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={1} />
                    <p className={requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length ? 'content-product-success-text' : 'content-product-warning-text'}>
                      平台属性 {filledAttributes}/{requiredAttributes.length || 0}
                    </p>
                    <p>SKU/变体：进入 Listing 编辑页维护组合、价格、库存和SKU图</p>
                  </td>
                  <td>
                    <p className="content-product-strong-text">{item.selling_price_local != null ? item.selling_price_local : '待定价'}</p>
                    <p>采购 {item.source_price_rmb != null ? `¥${item.source_price_rmb}` : '待补'} · 利润 {item.profit_margin_pct != null ? `${item.profit_margin_pct}%` : '待校验'}</p>
                    <p>库存：发布/同步后回写</p>
                  </td>
                  <td>
                    {[...item.content_gaps, ...mediaGaps].length > 0
                      ? <p className="content-product-gap-text">{[...item.content_gaps, ...mediaGaps].slice(0, 5).join('、')}</p>
                      : <span className="content-product-success-text">无阻断缺口</span>}
                  </td>
                  <td>
                    <div className="content-product-row-action-set" data-ui="content-product-row-action-set">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openRow(item)
                          onOpenListing?.(item)
                        }}
                        className="content-product-action content-product-action-primary"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        编辑 Listing
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openRow(item)
                          onOpenMediaWorkbench?.(item)
                        }}
                        className="content-product-action"
                      >
                        <Image className="mr-1 h-3 w-3" />
                        处理图片
                      </button>
                      <a
                        href={pricingUrl}
                        onClick={event => event.stopPropagation()}
                        className="content-product-action"
                      >
                        <DollarSign className="mr-1 h-3 w-3" />
                        定价
                      </a>
                      <a
                        href={publishUrl}
                        onClick={event => event.stopPropagation()}
                        className="content-product-action"
                      >
                        <Megaphone className="mr-1 h-3 w-3" />
                        刊登
                      </a>
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

function BulkActionWorkbench({
  action,
  items,
  onClose,
  onOpenListing,
  onOpenMediaWorkbench,
}: {
  action: BulkActionKind
  items: ContentWorkbenchItem[]
  onClose: () => void
  onOpenListing: (item: ContentWorkbenchItem) => void
  onOpenMediaWorkbench?: (item: ContentWorkbenchItem) => void
}) {
  const meta = bulkActionMeta(action)
  return (
    <section
      aria-label="内容商品批量处理队列"
      data-ui="content-product-bulk-action-workbench"
      className="content-product-bulk-action-workbench"
    >
      <div className="content-product-bulk-workbench-header">
        <div>
          <p>{meta.title}</p>
          <span>{meta.description}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="content-product-secondary-action"
        >
          收起队列
        </button>
      </div>
      <div className="content-product-bulk-table-shell">
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>平台/市场</th>
              <th>当前缺口</th>
              <th className="text-right">处理动作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={`${action}-${item.work_item_id}`}>
                <td>
                  <p>{item.product_name}</p>
                  <span>状态：{STATUS_LABELS[item.content_status] || item.content_status}</span>
                </td>
                <td>
                  <p>{item.target_platform || '--'}</p>
                  <span>{item.target_market || '--'}</span>
                </td>
                <td className="content-product-warning-text">
                  {bulkActionGaps(action, item).join('、') || '未发现该类阻断缺口，可进入人工复核'}
                </td>
                <td>
                  <div className="content-product-bulk-row-actions">
                    {action === 'media' && onOpenMediaWorkbench ? (
                      <button
                        type="button"
                        onClick={() => onOpenMediaWorkbench(item)}
                        className="content-product-primary-outline-action"
                      >
                        处理图片
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenListing(item)}
                        className="content-product-primary-outline-action"
                      >
                        打开 Listing
                      </button>
                    )}
                    {action === 'pricing' && (
                      <a
                        href={workflowUrl('/pricing', item)}
                        className="content-product-secondary-action"
                      >
                        定价页
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="content-product-bulk-boundary-note">
        该队列只组织本地处理入口，不声明已批量生成、已完成素材校验或已完成定价；实际写入仍在 Listing、图片或定价页面人工确认后发生。
      </p>
    </section>
  )
}

function bulkActionMeta(action: BulkActionKind) {
  if (action === 'copy') {
    return {
      title: '批量文案处理队列',
      description: '把已选商品集中为文案处理清单，逐个进入 Listing 编辑区生成或确认标题、描述和卖点。',
    }
  }
  if (action === 'media') {
    return {
      title: '批量素材校验队列',
      description: '把已选商品集中为发布图/视频处理清单，逐个进入图片工作台补图、排序、设主图或处理发布图缺口。',
    }
  }
  return {
    title: '批量定价校验队列',
    description: '把已选商品集中为价格处理清单，逐个进入定价页或 Listing 价格区核对成本、售价和利润缺口。',
  }
}

function bulkActionGaps(action: BulkActionKind, item: ContentWorkbenchItem) {
  if (action === 'media') return item.media_readiness?.gaps || []
  if (action === 'pricing') {
    return [
      item.selling_price_local == null ? '售价待定价' : '',
      item.profit_margin_pct == null ? '利润待校验' : '',
      item.source_price_rmb == null ? '采购成本待补' : '',
    ].filter(Boolean)
  }
  return item.content_gaps.length > 0 ? item.content_gaps : ['标题/描述/卖点需人工复核']
}

function productIdForAction(item: ContentWorkbenchItem) {
  return item.object_refs?.find(ref => ref.type === 'product')?.id || item.id || item.work_item_id
}

function workflowUrl(basePath: '/pricing' | '/publish', item: ContentWorkbenchItem) {
  const params = new URLSearchParams()
  params.set('product_id', productIdForAction(item))
  if (item.target_platform) params.set('target_platform', item.target_platform)
  if (item.target_market) params.set('target_market', item.target_market)
  const storeRef = objectRefByType(item, ['store_listing', 'platform_account', 'store'])
  if (storeRef?.id) params.set('target_store', storeRef.id)
  return `${basePath}?${params.toString()}`
}

function bulkWorkflowUrl(basePath: '/pricing' | '/publish', items: ContentWorkbenchItem[]) {
  const params = new URLSearchParams()
  const productIds = items.map(productIdForAction).filter(Boolean)
  if (productIds.length === 1) params.set('product_id', productIds[0])
  if (productIds.length > 1) params.set('product_ids', productIds.join(','))
  const samePlatform = sameValue(items.map(item => item.target_platform).filter(isPresentString))
  const sameMarket = sameValue(items.map(item => item.target_market).filter(isPresentString))
  if (samePlatform) params.set('target_platform', samePlatform)
  if (sameMarket) params.set('target_market', sameMarket)
  const storeIds = items
    .map(item => objectRefByType(item, ['store_listing', 'platform_account', 'store'])?.id || '')
    .filter(isPresentString)
  const sameStore = sameValue(storeIds)
  if (sameStore) params.set('target_store', sameStore)
  return `${basePath}?${params.toString()}`
}

function sameValue(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)))
  return unique.length === 1 ? unique[0] : ''
}

function isPresentString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasAttributeValue(values: Record<string, unknown>, field: string) {
  const value = values[field]
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value != null && value !== false
}

function getPageSize(layout: 'table' | 'rail', tablePageSize: number) {
  return layout === 'rail' ? 6 : tablePageSize
}

function matchesProduct(item: ContentWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}

function storeContextLabel(item: ContentWorkbenchItem) {
  const storeRef = objectRefByType(item, ['store_listing', 'platform_account', 'store'])
  if (storeRef) return `店铺实例：${storeRef.label || storeRef.id}`
  const listingRef = objectRefByType(item, ['platform_listing', 'listing'])
  if (listingRef) return `店铺实例：待选择；关联Listing ${listingRef.label || listingRef.id}`
  return '店铺实例：待选择，批量刊登时写入当前店铺Listing'
}

function objectRefContextLabel(item: ContentWorkbenchItem) {
  const productRef = objectRefByType(item, ['product', 'base_product'])
  return `商品对象：${productRef?.label || productRef?.id || item.id || item.work_item_id}`
}

function objectRefByType(item: ContentWorkbenchItem, types: string[]) {
  return item.object_refs?.find(ref => types.includes(ref.type))
}
