import { ArrowRight, Calculator, Globe, Package, ShoppingCart, Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { DictMarket, DictPlatform } from '../../api/config'
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
  onToggleMarket: (id: string) => void
  onToggleStore: (id: string) => void
  onPricingModeChange: (mode: 'cost_based' | 'selling_based') => void
  onTargetProfitChange: (value: number) => void
  onPreview: () => void
}

export function BatchPublishSelectStep({
  items, platforms, markets, stores, platformStatus, selectedItems, selectedPlatforms, selectedMarkets, selectedStores,
  pricingMode, targetProfit, loading, onToggleItem, onTogglePlatform, onToggleMarket,
  onToggleStore, onPricingModeChange, onTargetProfitChange, onPreview,
}: Props) {
  const marketLabelMap = new Map(markets.map(m => [m.id, `${m.flag ? `${m.flag} ` : ''}${m.label}`]))
  const selectedPlatformsList = Array.from(selectedPlatforms)
  const platformLabelMap = new Map(platforms.map(platform => [platform.id, platform.label]))
  const storeLabelMap = new Map(stores.map(store => [store.id, `${store.account_name} · ${store.platform.toUpperCase()}${store.shop_id ? ` · ${store.shop_id}` : ''}`]))
  const visibleStores = stores.filter(store => selectedPlatforms.size === 0 || selectedPlatforms.has(store.platform))
  const readinessRows = items.map(item => publishReadiness(item, selectedPlatforms, selectedMarkets, selectedStores))
  const readyRows = readinessRows.filter(row => row.ready).length
  const blockedRows = readinessRows.length - readyRows
  const mediaBlockedRows = readinessRows.filter(row => !row.mediaReady).length
  const fieldBlockedRows = readinessRows.filter(row => !row.fieldReady).length
  const targetBlockedRows = readinessRows.filter(row => !row.targetReady).length
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

  return (
    <section aria-label="发布队列主工作台" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">发布就绪商品队列</h3>
            <span className="text-xs text-[var(--color-muted)]">已选 {selectedItems.size} / {items.length}</span>
          </div>
          <section aria-label="发布门禁总览" className="grid gap-3 md:grid-cols-4">
            <PublishGateCard label="可生成草稿" value={`${readyRows}`} detail={`阻断 ${blockedRows}`} ok={blockedRows === 0} />
            <PublishGateCard label="图片门禁" value={mediaBlockedRows ? `缺 ${mediaBlockedRows}` : '通过'} detail="平台最低图片数量" ok={mediaBlockedRows === 0} />
            <PublishGateCard label="字段门禁" value={fieldBlockedRows ? `缺 ${fieldBlockedRows}` : '通过'} detail="平台必填属性" ok={fieldBlockedRows === 0} />
            <PublishGateCard label="目标归属" value={targetBlockedRows ? `缺 ${targetBlockedRows}` : '通过'} detail="平台/市场/店铺" ok={targetBlockedRows === 0} />
          </section>
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto rounded-xl border border-[var(--color-border)]" style={{ scrollbarWidth: 'thin' }}>
            <table className="professional-table w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="w-10 px-3 py-2">选</th>
                  <th className="px-3 py-2">商品</th>
                  <th className="px-3 py-2">成本/售价</th>
                  <th className="px-3 py-2">目标归属</th>
                  <th className="px-3 py-2">阶段</th>
                  <th className="px-3 py-2">平台字段组</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
            {items.map(item => {
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
                      {item.imageUrl && (
                        <img
                          src={productImageSrc(item.imageUrl)}
                          alt={item.name}
                          className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                        />
                      )}
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
                  <td className="px-3 py-3 text-[var(--color-muted)]">{item.lifecycleLabel || '--'}</td>
                  <td className="min-w-72 px-3 py-3">
                    <div className="space-y-2" aria-label="多平台字段组">
                      {requirementsBySelection.map(({ platform, label, requirements }) => (
                        <div key={platform || 'unselected'} className="rounded-lg border border-[var(--color-border)] p-2">
                          <p className="mb-1 text-[11px] font-semibold text-[var(--color-fg)]">{label}</p>
                          <PlatformFieldGroupSummary requirements={requirements} compact maxGroups={2} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <PublishGateStack readiness={readiness} disabledReason={item.disabledReason} />
                  </td>
                </tr>
              )
            })}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-3 text-xs text-[var(--color-muted)]">暂无发布就绪商品。请先完成选品决策、内容任务人工确认和定价确认。</p>}
          </div>
        </CardContent>
      </Card>

      <aside aria-label="目标平台店铺操作区" className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">目标店铺</h3>
            <span className="text-xs text-[var(--color-muted)]">已选 {selectedStores.size} 个；必须选择目标店铺后才能生成店铺级 Listing 草稿</span>
          </div>
          {visibleStores.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">当前平台未配置可刊登店铺，请先到设置中心配置平台账号。</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {visibleStores.map(store => (
                <button
                  key={store.id}
                  onClick={() => onToggleStore(store.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: selectedStores.has(store.id) ? 'var(--color-primary)' : 'var(--color-border)',
                    color: selectedStores.has(store.id) ? 'var(--color-primary-text)' : 'var(--color-muted)',
                  }}
                >
                  {store.account_name} · {store.platform.toUpperCase()}{store.shop_id ? ` · ${store.shop_id}` : ''}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">目标平台</h3>
          </div>
          <div className="flex gap-3 flex-wrap">
            {platforms.map(platform => (
              <button
                key={platform.id}
                onClick={() => onTogglePlatform(platform.id)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                style={{
                  background: selectedPlatforms.has(platform.id) ? 'var(--color-primary)' : 'var(--color-border)',
                  color: selectedPlatforms.has(platform.id) ? 'var(--color-primary-text)' : 'var(--color-muted)',
                }}
              >
                <span>{platform.icon}</span>
                <span>{platform.label}</span>
                <span className="rounded-full bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px]" style={{ color: platformStatus[platform.id]?.configured ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {platformStatus[platform.id]?.label || '未配置'}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-[var(--color-success)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">目标市场</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {markets.map(market => (
              <button
                key={market.id}
                onClick={() => onToggleMarket(market.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: selectedMarkets.has(market.id) ? 'var(--color-success)' : 'var(--color-border)',
                  color: selectedMarkets.has(market.id) ? 'var(--color-primary-text)' : 'var(--color-muted)',
                }}
              >
                {marketLabelMap.get(market.id)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-[var(--color-warning)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">定价策略</h3>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {selectedStores.size === 0 && (
          <span className="mr-3 self-center text-xs text-[var(--color-warning)]">请选择至少一个目标店铺</span>
        )}
        <button
          onClick={onPreview}
          disabled={loading || selectedItems.size === 0 || selectedPlatforms.size === 0 || selectedMarkets.size === 0 || selectedStores.size === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-[var(--color-primary-text)] font-medium disabled:opacity-40 transition-colors"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {loading
            ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse" /> 生成中...</span>
            : <span className="flex items-center gap-2">预览 Listing <ArrowRight className="w-4 h-4" /></span>}
        </button>
      </div>
      </aside>
    </section>
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
  const ready = mediaReady && fieldReady && priceReady && targetReady && !item.disabled
  return {
    ready,
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

function PublishGateStack({ readiness, disabledReason }: { readiness: ReturnType<typeof publishReadiness>; disabledReason?: string }) {
  if (disabledReason) return <span className="text-[var(--color-warning)]">{disabledReason}</span>
  return (
    <div className="grid gap-1" aria-label="发布门禁状态">
      <GatePill label="媒体" ok={readiness.mediaReady} detail={readiness.mediaLabel} />
      <GatePill label="字段" ok={readiness.fieldReady} detail={readiness.missingAttrs.length ? `缺 ${readiness.missingAttrs.length}` : '通过'} />
      <GatePill label="价格" ok={readiness.priceReady} detail={readiness.priceReady ? '可试算' : '待补'} />
      <GatePill label="目标" ok={readiness.targetReady} detail={readiness.targetReady ? '已选' : '待选'} />
    </div>
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
