import { useMemo, useState } from 'react'
import { ArrowRight, Calculator, Package, Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { DictMarket, DictPlatform } from '../../api/config'
import type { ListingMasterStatus } from '../../api/listing'
import { productImageSrc } from '../../utils/productImages'

export interface PublishableItem {
  key: string
  id: string
  sourceType: 'sourcing' | 'product'
  name: string
  costPrice: number | null
  sellingPrice?: number | null
  pricingSourceLabel?: string
  imageUrl?: string | null
  platformRequirements?: {
    required_attributes?: string[]
    media?: string[]
    content?: string[]
    compliance?: string[]
    attribute_values?: Record<string, unknown>
    field_groups?: unknown[]
    object_model?: string[]
    evidence_source?: string
  }
  platformRequirementsByPlatform?: Record<string, PlatformRequirementsLike>
  listingMasterStatus?: ListingMasterStatus
  listingStoreOverride?: {
    store_id?: string | null
    store_label?: string | null
    title?: string | null
    image_count?: number
    sku_count?: number
    has_platform_attributes?: boolean
    has_logistics?: boolean
    has_compliance?: boolean
    override_boundary?: string | null
  }
  targetPlatforms?: string[]
  targetMarkets?: string[]
  targetStoreIds?: string[]
  mediaReadiness?: {
    captured_image_count?: number
    missing_image_count?: number
    min_platform_images?: number
    recommended_platform_images?: number
    gaps?: string[]
  }
  lifecycleLabel?: string
  disabled?: boolean
  disabledReason?: string
}

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
  const previewDisabledReason = buildPreviewDisabledReason(loading, selectedItems, selectedPlatforms, selectedMarkets, selectedStores)
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
          <section
            aria-label="发布目标批量操作条"
            data-ui="publish-target-command-bar"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
          >
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
              <TargetChipGroup
                title="目标平台"
                items={platforms.map(platform => ({
                  id: platform.id,
                  label: `${platform.icon} ${platform.label}`,
                  meta: platformStatus[platform.id]?.label || '未配置',
                }))}
                selected={selectedPlatforms}
                onToggle={onTogglePlatform}
                tone="primary"
              />
              <TargetChipGroup
                title="目标店铺"
                items={visibleStores.map(store => ({
                  id: store.id,
                  label: store.account_name,
                  meta: `${store.platform.toUpperCase()}${store.shop_id ? ` · ${store.shop_id}` : ''}`,
                }))}
                selected={selectedStores}
                onToggle={onToggleStore}
                emptyText="当前平台未配置可刊登店铺"
                tone="primary"
              />
            </div>
          </section>
          <section aria-label="发布门禁总览" className="grid gap-3 md:grid-cols-5">
            <PublishGateCard label="可生成草稿" value={`${readyRows}`} detail={`阻断 ${blockedRows}`} ok={blockedRows === 0} />
            <PublishGateCard label="Listing 母版" value={masterBlockedRows ? `缺 ${masterBlockedRows}` : '通过'} detail="标题/卖点/描述/合规" ok={masterBlockedRows === 0} />
            <PublishGateCard label="图片门禁" value={mediaBlockedRows ? `缺 ${mediaBlockedRows}` : '通过'} detail="平台最低图片数量" ok={mediaBlockedRows === 0} />
            <PublishGateCard label="字段门禁" value={fieldBlockedRows ? `缺 ${fieldBlockedRows}` : '通过'} detail="平台必填属性" ok={fieldBlockedRows === 0} />
            <PublishGateCard label="目标归属" value={targetBlockedRows ? `缺 ${targetBlockedRows}` : '通过'} detail="平台/店铺/市场归属" ok={targetBlockedRows === 0} />
          </section>
          <section
            aria-label="发布就绪商品筛选工具栏"
            data-ui="batch-publish-ready-list-toolbar"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_220px_160px_auto]">
              <label className="text-xs text-[var(--color-muted)]">
                商品搜索
                <input
                  value={keyword}
                  onChange={event => { setKeyword(event.target.value); setPage(1) }}
                  placeholder="搜索商品名、ID、阶段"
                  className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
                />
              </label>
              <SelectBox label="平台筛选" value={platformFilter} onChange={value => { setPlatformFilter(value); setPage(1) }} options={[
                ['all', '全部平台'],
                ...platforms.map(platform => [platform.id, platform.label] as [string, string]),
              ]} />
              <SelectBox label="店铺筛选" value={storeFilter} onChange={value => { setStoreFilter(value); setPage(1) }} options={[
                ['all', '全部店铺'],
                ...stores.map(store => [store.id, `${store.account_name} · ${store.platform.toUpperCase()}`] as [string, string]),
              ]} />
              <SelectBox label="发布门禁" value={gateFilter} onChange={value => { setGateFilter(value as typeof gateFilter); setPage(1) }} options={[
                ['all', '全部状态'],
                ['ready', '可生成草稿'],
                ['blocked', '有阻断项'],
              ]} />
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={toggleVisiblePage}
                  disabled={selectablePageItems.length === 0}
                  className="rounded-xl border border-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] disabled:opacity-40"
                >
                  {allPageSelected ? '取消本页' : '选择本页'}
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]"
                >
                  重置
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              当前显示 {filteredItems.length} 条，已选本页 {selectedOnPage}/{selectablePageItems.length}；发布动作只针对勾选商品和已选目标店铺生成店铺级草稿。
            </p>
          </section>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" style={{ scrollbarWidth: 'thin' }} data-ui="batch-publish-ready-list-table">
            <table className="professional-table min-w-[1240px] w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="w-10 px-3 py-2">选</th>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">成本/售价</th>
                  <th className="px-3 py-2">目标归属</th>
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
                <tr
                  key={item.key}
                  className="border-b border-[var(--color-border)] align-top transition-colors hover:bg-[var(--color-bg)]"
                  style={{ background: selectedItems.has(item.key) ? 'var(--color-primary-light)' : 'transparent' }}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.key)}
                      disabled={item.disabled}
                      onChange={() => onToggleItem(item.key)}
                      title={item.disabledReason || item.name}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 gap-2">
                      {item.imageUrl && <PublishImageHoverPreview imageUrl={item.imageUrl} name={item.name} />}
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium text-[var(--color-fg)]">{item.name || '未命名'}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{item.sourceType === 'product' ? '商品库' : '品源库'}</p>
                        {mediaReadiness && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-warning)]" aria-label="媒体缺口">
                            图 {mediaReadiness.captured_image_count ?? 0}/{mediaReadiness.min_platform_images ?? 5}；{mediaGaps.length ? mediaGaps.join('、') : '图片基础满足'}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-fg)]">
                    <p>成本 {item.costPrice == null ? '待录入' : `¥${item.costPrice}`}</p>
                    <p className="mt-1 text-[var(--color-muted)]">售价 {item.sellingPrice == null ? item.pricingSourceLabel || '待确认' : `¥${item.sellingPrice}`}</p>
                  </td>
                  <td className="min-w-48 px-3 py-3">
                    <ItemTargetContext
                      item={item}
                      platformLabelMap={platformLabelMap}
                      marketLabelMap={marketLabelMap}
                      storeLabelMap={storeLabelMap}
                    />
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
                        <PlatformFieldGroupDisclosure
                          key={platform || 'unselected'}
                          label={label}
                          requirements={requirements}
                        />
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[var(--color-warning)]" />
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">定价策略</h3>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--color-fg)]">
                <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => onPricingModeChange('cost_based')} />
                成本利润率
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-[var(--color-fg)]">
                <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => onPricingModeChange('selling_based')} />
                售价利润率
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted)]">目标利润</span>
                <input type="range" min={5} max={60} value={targetProfit} onChange={e => onTargetProfitChange(parseInt(e.target.value))} className="w-32" />
                <span className="text-sm font-bold text-[var(--color-primary)]">{targetProfit}%</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              {selectedStores.size === 0 && (
                <span className="text-xs text-[var(--color-warning)]">请选择至少一个目标店铺</span>
              )}
              <button
                onClick={onPreview}
                disabled={loading || selectedItems.size === 0 || selectedPlatforms.size === 0 || selectedMarkets.size === 0 || selectedStores.size === 0}
                title={previewDisabledReason}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-[var(--color-primary-text)] font-medium disabled:opacity-40 transition-colors"
                style={{ background: 'var(--gradient-accent)' }}
              >
                {loading
                  ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> 生成中...</span>
                  : <span className="flex items-center gap-2">预览 Listing <ArrowRight className="w-4 h-4" /></span>}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function TargetChipGroup({
  title,
  items,
  selected,
  onToggle,
  emptyText = '暂无可选项',
  tone = 'primary',
}: {
  title: string
  items: Array<{ id: string; label: string; meta?: string }>
  selected: Set<string>
  onToggle: (id: string) => void
  emptyText?: string
  tone?: 'primary' | 'success'
}) {
  const activeColor = tone === 'success' ? 'var(--color-success)' : 'var(--color-primary)'
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{title}</p>
        <span className="text-[11px] text-[var(--color-muted)]">已选 {selected.size}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">{emptyText}</p>
      ) : (
        <div className="max-h-28 overflow-y-auto">
          <div className="flex flex-wrap gap-2 pr-1">
            {items.map(item => {
              const checked = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="rounded-full border px-3 py-1.5 text-left text-xs transition hover:-translate-y-0.5"
                  style={{
                    background: checked ? activeColor : 'var(--color-bg)',
                    borderColor: checked ? activeColor : 'var(--color-border)',
                    color: checked ? 'var(--color-primary-text)' : 'var(--color-muted)',
                  }}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.meta && <span className="ml-1 opacity-80">{item.meta}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SelectBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-[var(--color-muted)]">
      {label}
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
      >
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function publishReadiness(
  item: PublishableItem,
  selectedPlatforms: Set<string>,
  selectedMarkets: Set<string>,
  selectedStores: Set<string>,
) {
  const captured = item.mediaReadiness?.captured_image_count ?? (item.imageUrl ? 1 : 0)
  const minImages = item.mediaReadiness?.min_platform_images ?? 5
  const mediaReady = captured >= minImages
  const requirements = item.platformRequirements
  const requiredAttrs = requirements?.required_attributes || []
  const attrValues = requirements?.attribute_values || {}
  const missingAttrs = requiredAttrs.filter(attr => !hasAttributeValue(attrValues[attr]))
  const fieldReady = requiredAttrs.length > 0 && missingAttrs.length === 0
  const priceReady = item.sellingPrice != null || item.costPrice != null
  const targetReady = selectedPlatforms.size > 0 && selectedMarkets.size > 0 && selectedStores.size > 0
  const masterReady = item.listingMasterStatus?.ready ?? (item.sourceType === 'product')
  const ready = masterReady && mediaReady && fieldReady && priceReady && targetReady && !item.disabled
  return {
    ready,
    masterReady,
    mediaReady,
    fieldReady,
    priceReady,
    targetReady,
    missingAttrs,
    mediaLabel: `图 ${captured}/${minImages}`,
  }
}

function PublishGateCard({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={ok ? 'mt-1 text-lg font-semibold text-[var(--color-success)]' : 'mt-1 text-lg font-semibold text-[var(--color-warning)]'}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function PublishImageHoverPreview({ imageUrl, name }: { imageUrl: string; name: string }) {
  const src = productImageSrc(imageUrl)
  return (
    <div data-ui="publish-image-hover-preview" className="group relative h-12 w-12 shrink-0">
      <img
        src={src}
        alt={name}
        className="h-12 w-12 rounded-lg border object-cover"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      />
      <div className="pointer-events-none absolute left-0 top-0 z-30 hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-lg)] group-hover:block">
        <img
          src={src}
          alt={`${name} 放大预览`}
          className="h-24 w-24 origin-top-left scale-100 rounded-lg object-cover transition-transform duration-150 group-hover:scale-[2.8]"
        />
      </div>
    </div>
  )
}

function PlatformFieldGroupDisclosure({ label, requirements }: { label: string; requirements?: PlatformRequirementsLike }) {
  const requiredCount = requirements?.required_attributes?.length ?? 0
  const groupCount = Array.isArray(requirements?.field_groups) ? requirements.field_groups.length : 0
  return (
    <details className="rounded-lg border border-[var(--color-border)] p-2" aria-label="字段组默认折叠">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-[var(--color-fg)]">
        <span className="inline-flex w-full items-center justify-between gap-2">
          <span>{label}</span>
          <span className={requiredCount ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted)]'}>
            {groupCount} 组 · 必填 {requiredCount}
          </span>
        </span>
      </summary>
      <div className="mt-2">
        <PlatformFieldGroupSummary requirements={requirements} compact maxGroups={2} />
      </div>
    </details>
  )
}

function PublishGateStack({ item, readiness, disabledReason }: { item: PublishableItem; readiness: ReturnType<typeof publishReadiness>; disabledReason?: string }) {
  if (disabledReason) return <span className="text-[var(--color-warning)]">{disabledReason}</span>
  return (
    <div className="grid gap-1" aria-label="发布门禁状态">
      <GatePill label="母版" ok={readiness.masterReady} detail={item.listingMasterStatus?.label || (readiness.masterReady ? '已确认' : '待补')} />
      {!readiness.masterReady && <RepairAction href={repairHref(item, 'fields')} label="完善母版" />}
      <GatePill label="媒体" ok={readiness.mediaReady} detail={readiness.mediaLabel} />
      {!readiness.mediaReady && <RepairAction href={repairHref(item, 'media')} label="补齐图片" />}
      <GatePill label="字段" ok={readiness.fieldReady} detail={readiness.missingAttrs.length ? `缺 ${readiness.missingAttrs.length}` : '通过'} />
      {!readiness.fieldReady && <RepairAction href={repairHref(item, 'fields')} label="补齐字段" />}
      <GatePill label="价格" ok={readiness.priceReady} detail={readiness.priceReady ? '可试算' : '待补'} />
      <GatePill label="目标" ok={readiness.targetReady} detail={readiness.targetReady ? '已选' : '待选'} />
      {!readiness.targetReady && <RepairAction href="#target-store-panel" label="补齐目标" />}
    </div>
  )
}

function ListingMasterSummary({ status }: { status?: PublishableItem['listingMasterStatus'] }) {
  const ready = status?.ready ?? true
  return (
    <div className={ready
      ? 'rounded-lg border border-[var(--color-success-light)] bg-[var(--color-success-light)] p-2 text-[11px]'
      : 'rounded-lg border border-[var(--color-warning-light)] bg-[var(--color-warning-light)] p-2 text-[11px]'
    } aria-label="统一 Listing 母版摘要">
      <p className={ready ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-warning)]'}>
        {status?.label || '本地 Listing 草稿'}
      </p>
      <p className={ready ? 'mt-1 text-[var(--color-success)]' : 'mt-1 text-[var(--color-warning)]'}>
        {status?.detail || (ready ? '可进入店铺刊登草稿' : '标题、卖点、描述或合规尚未确认')}
      </p>
    </div>
  )
}

function ListingOverrideSummary({ override }: { override?: PublishableItem['listingStoreOverride'] }) {
  if (!override || !override.store_label) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]">
        未保存店铺覆盖草稿
      </p>
    )
  }
  return (
    <div className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px]" aria-label="店铺覆盖字段摘要">
      <p className="font-semibold text-[var(--color-fg)]">{override.store_label}</p>
      <p className="line-clamp-1 text-[var(--color-muted)]">{override.title || '标题沿用基础内容'}</p>
      <div className="flex flex-wrap gap-1">
        <MiniState label="SKU" ok={(override.sku_count || 0) > 0} value={`${override.sku_count || 0}`} />
        <MiniState label="属性" ok={Boolean(override.has_platform_attributes)} value={override.has_platform_attributes ? '已补' : '待补'} />
        <MiniState label="物流" ok={Boolean(override.has_logistics)} value={override.has_logistics ? '已补' : '待补'} />
        <MiniState label="合规" ok={Boolean(override.has_compliance)} value={override.has_compliance ? '已补' : '待补'} />
      </div>
    </div>
  )
}

function MiniState({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <span className={ok ? 'rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[var(--color-warning)]'}>
      {label}:{value}
    </span>
  )
}

function GatePill({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <span className={ok ? 'inline-flex items-center justify-between gap-2 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[11px] text-[var(--color-success)]' : 'inline-flex items-center justify-between gap-2 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]'}>
      <span>{label}</span>
      <span>{detail}</span>
    </span>
  )
}

function RepairAction({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-primary)] px-2 py-0.5 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
      {label}<ArrowRight className="h-3 w-3" />
    </a>
  )
}

function repairHref(item: PublishableItem, section: 'media' | 'fields') {
  const targetSection = section === 'media' ? 'media' : 'attributes'
  if (item.sourceType === 'product') {
    return `/products/${encodeURIComponent(item.id)}/edit?listing_section=${targetSection}`
  }
  return `/content?sourcing_item_id=${encodeURIComponent(item.id)}&listing_section=${targetSection}`
}

function buildPreviewDisabledReason(
  loading: boolean,
  selectedItems: Set<string>,
  selectedPlatforms: Set<string>,
  selectedMarkets: Set<string>,
  selectedStores: Set<string>,
) {
  if (loading) return '正在生成预览'
  if (selectedItems.size === 0) return '请选择至少一个商品'
  if (selectedPlatforms.size === 0) return '请选择至少一个目标平台'
  if (selectedStores.size === 0) return '请选择至少一个目标店铺'
  if (selectedMarkets.size === 0) return '目标店铺缺少市场归属，请先在店铺配置维护市场'
  return '生成 Listing 预览'
}

function hasAttributeValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function ItemTargetContext({
  item,
  platformLabelMap,
  marketLabelMap,
  storeLabelMap,
}: {
  item: PublishableItem
  platformLabelMap: Map<string, string>
  marketLabelMap: Map<string, string>
  storeLabelMap: Map<string, string>
}) {
  const platforms = (item.targetPlatforms || []).map(id => platformLabelMap.get(id) || id.toUpperCase())
  const markets = (item.targetMarkets || []).map(id => marketLabelMap.get(id) || id.toUpperCase())
  const stores = (item.targetStoreIds || []).map(id => storeLabelMap.get(id) || id)

  if (platforms.length === 0 && markets.length === 0 && stores.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]">
        待选择目标平台/市场/店铺
      </p>
    )
  }

  return (
    <div className="space-y-1 text-[11px]" aria-label="商品目标归属">
      {platforms.length > 0 && <TargetLine label="平台" values={platforms} />}
      {markets.length > 0 && <TargetLine label="市场" values={markets} />}
      {stores.length > 0 && <TargetLine label="店铺" values={stores} />}
    </div>
  )
}

function TargetLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex min-w-0 gap-1">
      <span className="shrink-0 text-[var(--color-muted)]">{label}</span>
      <span className="line-clamp-2 font-medium text-[var(--color-fg)]">{values.join('、')}</span>
    </div>
  )
}
