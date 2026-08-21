import { useMemo, useState } from 'react'
import { ArrowRight, Calculator, Package, Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import type { DictMarket, DictPlatform } from '../../api/config'
import { BatchPublishPreflightSummary, type SelectedPublishBlockingCounts } from './BatchPublishPreflightSummary'
import { PricingSnapshotBadge, PublishMediaSkuSummary } from './BatchPublishReadinessCells'
import {
  ItemTargetContext,
  ListingMasterSummary,
  ListingOverrideSummary,
  PlatformFieldGroupDisclosure,
  PublishGateCard,
  PublishGateStack,
  PublishImageHoverPreview,
  SelectBox,
  TargetChipGroup,
  mediaSourceLabel,
} from './BatchPublishSelectParts'
import {
  buildPreviewDisabledReason,
  buildSelectedBlockingReason,
  publishReadiness,
  type PublishableItem,
} from './BatchPublishSelectUtils'

export type { PublishableItem } from './BatchPublishSelectUtils'

interface Props {
  items: PublishableItem[]
  platforms: DictPlatform[]
  markets: DictMarket[]
  stores: { id: string; platform: string; account_name: string; shop_id?: string }[]
  platformStatus: Record<string, { configured: boolean; label: string }>
  selectedItems: Set<string>
  selectedPlatforms: Set<string>
  selectedMarkets: Set<string>
  selectedStores: Set<string>
  pricingMode: 'cost_based' | 'selling_based'
  targetProfit: number
  loading: boolean
  onToggleItem: (id: string) => void
  onTogglePlatform: (id: string) => void
  onToggleStore: (id: string) => void
  onPricingModeChange: (mode: 'cost_based' | 'selling_based') => void
  onTargetProfitChange: (value: number) => void
  onPreview: () => void
}

export function BatchPublishSelectStep({
  items, platforms, markets, stores, platformStatus, selectedItems, selectedPlatforms, selectedMarkets, selectedStores,
  pricingMode, targetProfit, loading, onToggleItem, onTogglePlatform,
  onToggleStore, onPricingModeChange, onTargetProfitChange, onPreview,
}: Props) {
  const [keyword, setKeyword] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [storeFilter, setStoreFilter] = useState('all')
  const [gateFilter, setGateFilter] = useState<'all' | 'ready' | 'blocked'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const marketLabelMap = new Map(markets.map(m => [m.id, `${m.flag ? `${m.flag} ` : ''}${m.label}`]))
  const selectedPlatformsList = Array.from(selectedPlatforms)
  const platformLabelMap = new Map(platforms.map(platform => [platform.id, platform.label]))
  const storeLabelMap = new Map(stores.map(store => [store.id, `${store.account_name} · ${store.platform.toUpperCase()}${store.shop_id ? ` · ${store.shop_id}` : ''}`]))
  const visibleStores = stores.filter(store => selectedPlatforms.size === 0 || selectedPlatforms.has(store.platform))
  const readinessRows = items.map(item => publishReadiness(item, selectedPlatforms, selectedMarkets, selectedStores))
  const readyRows = readinessRows.filter(row => row.ready).length
  const blockedRows = readinessRows.length - readyRows
  const mediaBlockedRows = readinessRows.filter(row => !row.mediaReady).length
  const masterBlockedRows = readinessRows.filter(row => !row.masterReady).length
  const fieldBlockedRows = readinessRows.filter(row => !row.fieldReady).length
  const targetBlockedRows = readinessRows.filter(row => !row.targetReady).length
  const selectedBlockingRows = items
    .map(item => ({ item, readiness: publishReadiness(item, selectedPlatforms, selectedMarkets, selectedStores) }))
    .filter(row => selectedItems.has(row.item.key) && !row.readiness.ready)
  const selectedBlockingCounts: SelectedPublishBlockingCounts = {
    total: selectedBlockingRows.length,
    master: selectedBlockingRows.filter(row => !row.readiness.masterReady).length,
    media: selectedBlockingRows.filter(row => !row.readiness.mediaReady).length,
    fields: selectedBlockingRows.filter(row => !row.readiness.fieldReady).length,
    price: selectedBlockingRows.filter(row => !row.readiness.priceReady).length,
    target: selectedBlockingRows.filter(row => !row.readiness.targetReady).length,
  }
  const selectedBlockingReason = buildSelectedBlockingReason(selectedBlockingCounts)
  const previewDisabledReason = selectedBlockingReason || buildPreviewDisabledReason(loading, selectedItems, selectedPlatforms, selectedMarkets, selectedStores)
  const previewDisabled = loading
    || selectedItems.size === 0
    || selectedPlatforms.size === 0
    || selectedMarkets.size === 0
    || selectedStores.size === 0
    || selectedBlockingCounts.total > 0
  const platformRequirementsForSelection = (item: PublishableItem) => {
    if (selectedPlatformsList.length === 0) {
      return [{ platform: '', label: '未选择平台', requirements: item.platformRequirements }]
    }
    return selectedPlatformsList.map(platform => ({
      platform,
      label: platformLabelMap.get(platform) || platform,
      requirements: item.platformRequirementsByPlatform?.[platform] || item.platformRequirements,
    }))
  }
  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return items.filter(item => {
      const readiness = publishReadiness(item, selectedPlatforms, selectedMarkets, selectedStores)
      const keywordMatched = !normalizedKeyword
        || item.name.toLowerCase().includes(normalizedKeyword)
        || item.id.toLowerCase().includes(normalizedKeyword)
        || (item.lifecycleLabel || '').toLowerCase().includes(normalizedKeyword)
      const platformMatched = platformFilter === 'all' || (item.targetPlatforms || []).includes(platformFilter)
      const storeMatched = storeFilter === 'all' || (item.targetStoreIds || []).includes(storeFilter)
      const gateMatched = gateFilter === 'all' || (gateFilter === 'ready' ? readiness.ready : !readiness.ready)
      return keywordMatched && platformMatched && storeMatched && gateMatched
    })
  }, [gateFilter, items, keyword, platformFilter, selectedMarkets, selectedPlatforms, selectedStores, storeFilter])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selectablePageItems = pageItems.filter(item => !item.disabled)
  const selectedOnPage = selectablePageItems.filter(item => selectedItems.has(item.key)).length
  const allPageSelected = selectablePageItems.length > 0 && selectedOnPage === selectablePageItems.length
  const toggleVisiblePage = () => {
    selectablePageItems.forEach(item => {
      if (allPageSelected ? selectedItems.has(item.key) : !selectedItems.has(item.key)) {
        onToggleItem(item.key)
      }
    })
  }
  const resetFilters = () => {
    setKeyword('')
    setPlatformFilter('all')
    setStoreFilter('all')
    setGateFilter('all')
    setPage(1)
  }
  const changePage = (nextPage: number) => setPage(Math.min(Math.max(nextPage, 1), totalPages))

  return (
    <section aria-label="发布队列主工作台" className="space-y-4">
      <Card id="target-store-panel">
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">发布就绪商品队列</h3>
            <span className="text-xs text-[var(--color-muted)]">已选 {selectedItems.size} / {items.length}</span>
          </div>
          <section aria-label="发布目标批量操作条" data-ui="publish-target-command-bar" className="batch-publish-target-bar rounded-[var(--radius-xl)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">目标平台 / 店铺</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">先锁定目标平台和店铺，再在下方产品表选择要发布的 Listing；市场跟随店铺归属，缺市场时回到设置中心维护店铺。</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[var(--color-muted)]">平台 {selectedPlatforms.size}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[var(--color-muted)]">店铺 {selectedStores.size}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[var(--color-muted)]">店铺市场 {selectedMarkets.size || '待补'}</span>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <TargetChipGroup title="目标平台" items={platforms.map(platform => ({ id: platform.id, label: `${platform.icon} ${platform.label}`, meta: platformStatus[platform.id]?.label || '未配置' }))} selected={selectedPlatforms} onToggle={onTogglePlatform} tone="primary" />
              <TargetChipGroup title="目标店铺" items={visibleStores.map(store => ({ id: store.id, label: store.account_name, meta: `${store.platform.toUpperCase()}${store.shop_id ? ` · ${store.shop_id}` : ''}` }))} selected={selectedStores} onToggle={onToggleStore} emptyText="当前平台未配置可刊登店铺" tone="primary" />
            </div>
          </section>
          <section aria-label="发布门禁总览" className="grid gap-3 md:grid-cols-5">
            <PublishGateCard label="可生成草稿" value={`${readyRows}`} detail={`阻断 ${blockedRows}`} ok={blockedRows === 0} />
            <PublishGateCard label="Listing 母版" value={masterBlockedRows ? `缺 ${masterBlockedRows}` : '通过'} detail="标题/卖点/描述/合规" ok={masterBlockedRows === 0} />
            <PublishGateCard label="发布图门禁" value={mediaBlockedRows ? `缺 ${mediaBlockedRows}` : '通过'} detail="平台最低发布图数量" ok={mediaBlockedRows === 0} />
            <PublishGateCard label="字段门禁" value={fieldBlockedRows ? `缺 ${fieldBlockedRows}` : '通过'} detail="平台必填属性" ok={fieldBlockedRows === 0} />
            <PublishGateCard label="目标归属" value={targetBlockedRows ? `缺 ${targetBlockedRows}` : '通过'} detail="平台/店铺/市场归属" ok={targetBlockedRows === 0} />
          </section>
          <section aria-label="批量刊登当前操作摘要" data-ui="batch-publish-single-workbench-command-strip" className="batch-publish-command-strip">
            <div className="batch-publish-command-main">
              <span className="batch-publish-command-kicker">Publish Workbench</span>
              <h3>选择商品后生成平台店铺发布草稿</h3>
              <p>批量刊登只处理内容工厂已经完成 Listing、定价校验通过、并具备目标店铺归属的商品；市场由店铺配置自动带出。</p>
            </div>
            <div className="batch-publish-command-stats" aria-label="批量刊登选择状态">
              <span><strong>{selectedItems.size}</strong>已选商品</span>
              <span><strong>{selectedPlatforms.size}</strong>目标平台</span>
              <span><strong>{selectedStores.size}</strong>目标店铺</span>
              <span><strong>{selectedBlockingCounts.total}</strong>阻断项</span>
            </div>
          </section>
          <section aria-label="发布就绪商品筛选工具栏" data-ui="batch-publish-ready-list-toolbar" className="batch-publish-toolbar rounded-[var(--radius-xl)] p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_220px_160px_auto]">
              <label className="text-xs text-[var(--color-muted)]">
                商品搜索
                <input value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索商品名、ID、阶段" className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" />
              </label>
              <SelectBox label="平台筛选" value={platformFilter} onChange={value => { setPlatformFilter(value); setPage(1) }} options={[['all', '全部平台'], ...platforms.map(platform => [platform.id, platform.label] as [string, string])]} />
              <SelectBox label="店铺筛选" value={storeFilter} onChange={value => { setStoreFilter(value); setPage(1) }} options={[['all', '全部店铺'], ...stores.map(store => [store.id, `${store.account_name} · ${store.platform.toUpperCase()}`] as [string, string])]} />
              <SelectBox label="发布门禁" value={gateFilter} onChange={value => { setGateFilter(value as typeof gateFilter); setPage(1) }} options={[['all', '全部状态'], ['ready', '可生成草稿'], ['blocked', '有阻断项']]} />
              <div className="flex items-end gap-2">
                <button type="button" onClick={toggleVisiblePage} disabled={selectablePageItems.length === 0} className="rounded-xl border border-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] disabled:opacity-40">
                  {allPageSelected ? '取消本页' : '选择本页'}
                </button>
                <button type="button" onClick={resetFilters} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">重置</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              当前显示 {filteredItems.length} 条，已选本页 {selectedOnPage}/{selectablePageItems.length}；发布动作只针对勾选商品和已选目标店铺生成店铺级草稿。
            </p>
          </section>
          <div className="batch-publish-table-shell overflow-x-auto rounded-[var(--radius-xl)]" style={{ scrollbarWidth: 'thin' }} data-ui="batch-publish-ready-list-table">
            <table className="professional-table min-w-[1240px] w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="w-10 px-3 py-2">选</th>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">价格/定价快照</th>
                  <th className="px-3 py-2">目标归属</th>
                  <th className="px-3 py-2">发布图/SKU</th>
                  <th className="px-3 py-2">母版/店铺覆盖</th>
                  <th className="px-3 py-2">阶段</th>
                  <th className="px-3 py-2">平台字段组</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(item => {
                  const requirementsBySelection = platformRequirementsForSelection(item)
                  const mediaReadiness = item.mediaReadiness
                  const mediaGaps = mediaReadiness?.gaps || []
                  const readiness = publishReadiness(item, selectedPlatforms, selectedMarkets, selectedStores)
                  return (
                    <tr key={item.key} data-selected={selectedItems.has(item.key) ? 'true' : 'false'} className="batch-publish-row border-b border-[var(--color-border)] align-top transition-colors">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedItems.has(item.key)} disabled={item.disabled} onChange={() => onToggleItem(item.key)} title={item.disabledReason || item.name} className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 gap-2">
                          {item.imageUrl && <PublishImageHoverPreview imageUrl={item.imageUrl} name={item.name} />}
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-medium text-[var(--color-fg)]">{item.name || '未命名'}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{item.sourceType === 'product' ? '商品库' : '品源库'}</p>
                            {mediaReadiness && (
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-warning)]" aria-label="发布图缺口">
                                发布图 {mediaReadiness.captured_image_count ?? 0}/{mediaReadiness.min_platform_images ?? 5}{mediaReadiness.retained_image_count ? `，素材池 ${mediaReadiness.retained_image_count}` : ''}；{mediaGaps.length ? mediaGaps.join('、') : '发布图达标'}
                                <span className="ml-1 text-[var(--color-muted)]">来源：{mediaSourceLabel(mediaReadiness.source)}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="min-w-44 px-3 py-3 text-[var(--color-fg)]">
                        <p>售价 {item.sellingPrice == null ? '待确认' : `¥${item.sellingPrice}`}</p>
                        <p className="mt-1 text-[var(--color-muted)]">成本 {item.costPrice == null ? '待录入' : `¥${item.costPrice}`}</p>
                        <PricingSnapshotBadge item={item} />
                      </td>
                      <td className="min-w-48 px-3 py-3">
                        <ItemTargetContext item={item} platformLabelMap={platformLabelMap} marketLabelMap={marketLabelMap} storeLabelMap={storeLabelMap} />
                      </td>
                      <td className="min-w-48 px-3 py-3">
                        <PublishMediaSkuSummary item={item} />
                      </td>
                      <td className="min-w-56 px-3 py-3">
                        <div className="space-y-2">
                          <ListingMasterSummary status={item.listingMasterStatus} />
                          <ListingOverrideSummary override={item.listingStoreOverride} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[var(--color-muted)]">{item.lifecycleLabel || '--'}</td>
                      <td className="min-w-72 px-3 py-3">
                        <div className="space-y-2" aria-label="多平台字段组">
                          {requirementsBySelection.map(({ platform, label, requirements }) => (
                            <PlatformFieldGroupDisclosure key={platform || 'unselected'} label={label} requirements={requirements} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <PublishGateStack item={item} readiness={readiness} disabledReason={item.disabledReason} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-3 text-xs text-[var(--color-muted)]">暂无发布就绪商品。请先完成选品决策、内容任务人工确认和定价确认。</p>}
            {items.length > 0 && filteredItems.length === 0 && <p className="p-3 text-xs text-[var(--color-muted)]">当前筛选下没有商品，请调整平台、店铺、门禁或关键词。</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2" data-ui="publish-ready-pagination">
            <p className="text-xs text-[var(--color-muted)]">
              第 {safePage}/{totalPages} 页 · 每页 {pageSize} 条 · 共 {filteredItems.length} 条
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={safePage <= 1} onClick={() => changePage(safePage - 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] disabled:opacity-40">上一页</button>
              <button type="button" disabled={safePage >= totalPages} onClick={() => changePage(safePage + 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] disabled:opacity-40">下一页</button>
            </div>
          </div>
          <section aria-label="批量刊登底部固定发布操作栏" data-ui="batch-publish-sticky-submit-bar" className="batch-publish-submit-bar">
            <BatchPublishPreflightSummary selectedCount={selectedItems.size} blockingCounts={selectedBlockingCounts} blockingReason={selectedBlockingReason} />
            <div className="batch-publish-submit-controls">
              <div className="batch-publish-pricing-control">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[var(--color-warning)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-fg)]">定价策略</h3>
                </div>
                <label className="batch-publish-radio">
                  <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => onPricingModeChange('cost_based')} />
                  成本利润率
                </label>
                <label className="batch-publish-radio">
                  <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => onPricingModeChange('selling_based')} />
                  售价利润率
                </label>
                <div className="batch-publish-profit-range">
                  <span>目标利润</span>
                  <input type="range" min={5} max={60} value={targetProfit} onChange={e => onTargetProfitChange(parseInt(e.target.value))} />
                  <strong>{targetProfit}%</strong>
                </div>
              </div>
              <div className="batch-publish-submit-action">
                {selectedStores.size === 0 && <span className="text-xs text-[var(--color-warning)]">请选择至少一个目标店铺</span>}
                <button onClick={onPreview} disabled={previewDisabled} title={previewDisabledReason} className="batch-publish-preview-button">
                  {loading
                    ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> 生成中...</span>
                    : <span className="flex items-center gap-2">预览 Listing <ArrowRight className="w-4 h-4" /></span>}
                </button>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </section>
  )
}
