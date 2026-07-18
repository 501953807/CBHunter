import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { batchPreviewListings, batchPublishListings, getListingWorkbench } from '../../api/listing'
import type { BatchListingDraft, BatchPreviewSummary, BatchPublishResponse, ListingWorkbenchItem } from '../../api/listing'
import { getProduct } from '../../api/products'
import type { Product } from '../../types/product'
import { useConfig, useFullConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { BatchPublishSelectStep, type PublishableItem } from './BatchPublishSelectStep'
import { BatchPublishPreviewStep } from './BatchPublishPreviewStep'
import { BatchPublishResultStep } from './BatchPublishResultStep'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import { ProfessionalWorkspaceFrame } from '../../components/shared/ProfessionalWorkspaceFrame'
import { BusinessObjectActionBar } from '../../components/shared/BusinessObjectActionBar'
import { ContentListingStageRail } from '../content-planner/ContentListingStageRail'

type Step = 'select' | 'preview' | 'confirm'

export default function BatchPublishPage() {
  const [searchParams] = useSearchParams()
  const initialProductIds = [
    searchParams.get('product_id'),
    ...(searchParams.get('product_ids')?.split(',') || []),
  ].filter((id): id is string => Boolean(id))
  const { platforms, markets } = useConfig()
  const fullConfig = useFullConfig()
  const publishPlatforms = filterPlatformsByCapability(platforms, 'listing')
  const [step, setStep] = useState<Step>('select')
  const [listingItems, setListingItems] = useState<ListingWorkbenchItem[]>([])
  const [queryProductItems, setQueryProductItems] = useState<PublishableItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set())
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set())
  const [pricingMode, setPricingMode] = useState<'cost_based' | 'selling_based'>('cost_based')
  const [targetProfit, setTargetProfit] = useState(25)
  const [drafts, setDrafts] = useState<BatchListingDraft[]>([])
  const [summary, setSummary] = useState<BatchPreviewSummary | null>(null)
  const [confirmedDrafts, setConfirmedDrafts] = useState<Set<number>>(new Set())
  const [publishResult, setPublishResult] = useState<BatchPublishResponse | null>(null)
  const [publishMode, setPublishMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledAt, setScheduledAt] = useState('')
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [initialTargetsApplied, setInitialTargetsApplied] = useState(false)

  useEffect(() => {
    getListingWorkbench()
      .then(response => {
        setEvidence(response)
        setListingItems(response.data?.items || [])
      })
      .catch(error => logger.error('Load listing workbench failed', error))
  }, [])

  useEffect(() => {
    if (initialProductIds.length === 0) return
    Promise.all(initialProductIds.map(productId => getProduct(productId)))
      .then(responses => {
        const items = responses
          .map(response => response.data)
          .filter((product): product is Product => Boolean(product))
          .map(product => ({
            key: `product:${product.id}`,
            id: product.id,
            sourceType: 'product' as const,
            name: product.name,
            costPrice: product.cost_price ?? null,
            imageUrl: product.images?.[0] ?? null,
            platformRequirementsByPlatform: (product.attributes?.platform_requirements || {}) as PublishableItem['platformRequirementsByPlatform'],
            listingMasterStatus: {
              ready: true,
              label: '本地 Listing 草稿',
              detail: '来自商品库或店铺 Listing 草稿，发布前仍需预览校验。',
            },
            targetPlatforms: productTargetPlatforms(product),
            targetMarkets: productTargetMarkets(product),
            lifecycleLabel: '定价确认商品',
            pricingSourceLabel: '预览读取本地 Listing 草稿',
          }))
        setQueryProductItems(items)
        setSelectedItems(current => {
          const next = new Set(current)
          items.forEach(item => next.add(item.key))
          return next
        })
      })
      .catch(error => logger.error('Load products for batch publish failed', error))
  }, [searchParams])

  useEffect(() => {
    if (initialTargetsApplied || queryProductItems.length === 0) return
    const stores = fullConfig.store_scope?.stores || []
    const platformsFromProducts = uniq(queryProductItems.flatMap(item => item.targetPlatforms || []))
      .filter(platform => publishPlatforms.some(option => option.id === platform))
    const marketsFromProducts = uniq(queryProductItems.flatMap(item => item.targetMarkets || []))
      .filter(market => markets.some(option => option.id === market))
    const matchingStores = stores.filter(store => platformsFromProducts.includes(store.platform))

    if (platformsFromProducts.length > 0) setSelectedPlatforms(new Set(platformsFromProducts))
    if (marketsFromProducts.length > 0) setSelectedMarkets(new Set(marketsFromProducts))
    if (matchingStores.length === 1) setSelectedStores(new Set([matchingStores[0].id]))
    setInitialTargetsApplied(true)
  }, [fullConfig.store_scope?.stores, initialTargetsApplied, markets, publishPlatforms, queryProductItems])

  const workbenchItems: PublishableItem[] = listingItems.map(item => ({
    key: item.key,
    id: item.id,
    sourceType: 'sourcing' as const,
    name: item.name || '未命名发布商品',
    costPrice: item.cost_price ?? null,
    sellingPrice: item.selling_price_local ?? null,
    imageUrl: item.image_url,
    mediaReadiness: item.media_readiness,
    platformRequirements: item.platform_requirements,
    listingMasterStatus: item.listing_master_status,
    listingStoreOverride: item.listing_store_override,
    targetPlatforms: item.platform ? [item.platform] : [],
    targetMarkets: item.market ? [item.market] : [],
    targetStoreIds: item.platform_account_id ? [item.platform_account_id] : [],
    lifecycleLabel: item.lifecycle_label,
  }))
  const publishableItems: PublishableItem[] = queryProductItems.length
    ? [...queryProductItems, ...workbenchItems.filter(item => !queryProductItems.some(queryItem => queryItem.key === item.key))]
    : workbenchItems
  const selectedTargetMarkets = new Set(deriveSelectedTargetMarkets(
    publishableItems,
    selectedItems,
    fullConfig.store_scope?.stores || [],
    selectedStores,
    selectedMarkets,
  ))
  const selectedProductIds = Array.from(selectedItems)
    .filter(key => key.startsWith('product:'))
    .map(key => key.slice('product:'.length))
  const activeProductId = selectedProductIds.length === 1 ? selectedProductIds[0] : ''

  const platformStatus = Object.fromEntries(publishPlatforms.map(platform => {
    const stores = fullConfig.store_scope?.stores || []
    const configured = stores.some(store => store.platform === platform.id)
    return [platform.id, { configured, label: configured ? '已配置店铺' : '待配置店铺' }]
  }))

  const toggleSelection = (
    selection: Set<string>,
    setSelection: (next: Set<string>) => void,
    id: string,
  ) => {
    const next = new Set(selection)
    if (publishableItems.some(item => item.key === id && item.disabled)) return
    next.has(id) ? next.delete(id) : next.add(id)
    setSelection(next)
  }

  const toggleItemSelection = (id: string) => {
    const item = publishableItems.find(entry => entry.key === id)
    if (item?.disabled) return
    const isSelecting = !selectedItems.has(id)
    toggleSelection(selectedItems, setSelectedItems, id)
    if (!isSelecting || !item) return

    const availablePlatformIds = new Set(publishPlatforms.map(platform => platform.id))
    const availableMarketIds = new Set(markets.map(market => market.id))
    const availableStoreIds = new Set((fullConfig.store_scope?.stores || []).map(store => store.id))
    const selectablePlatforms = (item.targetPlatforms || []).filter(platform => availablePlatformIds.has(platform))
    const selectableMarkets = (item.targetMarkets || []).filter(market => availableMarketIds.has(market))
    if (selectablePlatforms.length > 0) {
      setSelectedPlatforms(current => new Set([...Array.from(current), ...selectablePlatforms]))
    }
    if (selectableMarkets.length > 0) {
      setSelectedMarkets(current => new Set([...Array.from(current), ...selectableMarkets]))
    }
    const selectableStores = (item.targetStoreIds || []).filter(storeId => availableStoreIds.has(storeId))
    if (selectableStores.length > 0) {
      setSelectedStores(current => new Set([...Array.from(current), ...selectableStores]))
    }
  }

  const toggleStoreSelection = (id: string) => {
    const store = (fullConfig.store_scope?.stores || []).find(entry => entry.id === id) as ({ id: string; platform: string; market?: string | null } | undefined)
    const isSelecting = !selectedStores.has(id)
    toggleSelection(selectedStores, setSelectedStores, id)
    if (!isSelecting || !store) return
    setSelectedPlatforms(current => new Set([...Array.from(current), store.platform]))
    if (store.market) {
      setSelectedMarkets(current => new Set([...Array.from(current), store.market as string]))
    }
  }

  const loadPreview = async () => {
    if (selectedItems.size === 0) return
    if (selectedStores.size === 0) {
      logger.error('请选择至少一个目标店铺', { selectedPlatforms: Array.from(selectedPlatforms) })
      return
    }
    const marketsForPreview = Array.from(selectedTargetMarkets)
    if (marketsForPreview.length === 0) {
      logger.error('目标店铺缺少市场归属，请先在店铺配置维护市场', { selectedStores: Array.from(selectedStores) })
      return
    }
    const selectedProductIds = Array.from(selectedItems)
      .filter(key => key.startsWith('product:'))
      .map(key => key.slice('product:'.length))
    const selectedSourcingIds = Array.from(selectedItems)
      .filter(key => key.startsWith('sourcing:'))
      .map(key => key.slice('sourcing:'.length))
    setLoading(true)
    try {
      const response = await batchPreviewListings({
        sourcing_item_ids: selectedSourcingIds,
        product_ids: selectedProductIds,
        platforms: Array.from(selectedPlatforms),
        markets: marketsForPreview,
        platform_account_ids: Array.from(selectedStores),
        pricing_mode: pricingMode,
        target_profit_pct: targetProfit,
      })
      if (response.data) {
        setEvidence(response)
        setDrafts(response.data.drafts)
        setSummary(response.data.summary)
        setConfirmedDrafts(new Set())
        setStep('preview')
      }
    } catch (error) {
      logger.error('Preview listing drafts failed', error)
    } finally {
      setLoading(false)
    }
  }

  const publishDrafts = async () => {
    if (publishMode === 'scheduled' && !scheduledAt) return
    setPublishing(true)
    try {
      const response = await batchPublishListings({
        drafts: drafts.map((draft, index) => ({ ...draft, confirmed: confirmedDrafts.has(index) })),
        publish_plan: {
          mode: publishMode,
          scheduled_at: publishMode === 'scheduled' ? scheduledAt : undefined,
        },
      })
      if (response.data) {
        setEvidence(response)
        setPublishResult(response.data)
        setStep('confirm')
      }
    } catch (error) {
      logger.error('Create local listing drafts failed', error)
    } finally {
      setPublishing(false)
    }
  }

  const toggleDraft = (index: number) => {
    const next = new Set(confirmedDrafts)
    next.has(index) ? next.delete(index) : next.add(index)
    setConfirmedDrafts(next)
  }

  const updateDraft = (index: number, patch: Partial<BatchListingDraft>) => {
    setDrafts(current => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...patch } : draft
    )))
  }

  const reset = () => {
    setStep('select')
    setDrafts([])
    setSummary(null)
    setConfirmedDrafts(new Set())
    setPublishResult(null)
    setPublishMode('immediate')
    setScheduledAt('')
    setEvidence(null)
  }

  return (
    <div className="space-y-6 page-enter">
      <ContentListingStageRail />
      <ProfessionalWorkspaceFrame
        eyebrow="Listing Publish"
        title="批量刊登"
          description="以发布就绪商品队列为主，选择目标平台和店铺后生成店铺级本地 Listing 草稿；市场由店铺归属或商品目标市场带入。"
        metrics={[
          { label: '发布队列', value: publishableItems.length, hint: '内容和定价已就绪' },
          { label: '已选商品', value: selectedItems.size, hint: '来源于发布队列或商品深链' },
          { label: '目标店铺', value: selectedStores.size, hint: drafts.length ? `草稿 ${drafts.length} 个` : '必须显式选择' },
        ]}
        actions={<Badge variant="default">Step {step === 'select' ? '1' : step === 'preview' ? '2' : '3'}/3</Badge>}
      />

      <EvidenceBanner evidence={evidence} />
      <BusinessObjectActionBar
        description="刊登页只处理已确认对象；需要补商品、内容或价格时从这里回到对应环节。"
        actions={[
          { label: '商品主数据', description: '核验图片、类目、成本、重量和平台属性。', href: activeProductId ? `/products/${activeProductId}` : '/products' },
          { label: '内容制作', description: '补标题、描述、图片处理、视频脚本和合规。', href: activeProductId ? `/content?product_id=${activeProductId}` : '/content' },
          { label: '定价校验', description: '确认售价、费率、汇率和利润空间。', href: activeProductId ? `/pricing?product_id=${activeProductId}` : '/pricing' },
        ]}
      />

      {step === 'select' && (
        <BatchPublishSelectStep
          items={publishableItems}
          platforms={publishPlatforms}
          markets={markets}
          stores={fullConfig.store_scope?.stores || []}
          platformStatus={platformStatus}
          selectedItems={selectedItems}
          selectedPlatforms={selectedPlatforms}
          selectedMarkets={selectedTargetMarkets}
          selectedStores={selectedStores}
          pricingMode={pricingMode}
          targetProfit={targetProfit}
          loading={loading}
          onToggleItem={toggleItemSelection}
          onTogglePlatform={id => toggleSelection(selectedPlatforms, setSelectedPlatforms, id)}
          onToggleStore={toggleStoreSelection}
          onPricingModeChange={setPricingMode}
          onTargetProfitChange={setTargetProfit}
          onPreview={loadPreview}
        />
      )}

      {step === 'preview' && (
        <BatchPublishPreviewStep
          summary={summary}
          drafts={drafts}
          confirmedDrafts={confirmedDrafts}
          publishing={publishing}
          publishMode={publishMode}
          scheduledAt={scheduledAt}
          onToggleDraft={toggleDraft}
          onDraftChange={updateDraft}
          onPublishModeChange={setPublishMode}
          onScheduledAtChange={setScheduledAt}
          onBack={() => setStep('select')}
          onPublish={publishDrafts}
        />
      )}

      {step === 'confirm' && publishResult && <BatchPublishResultStep result={publishResult} onReset={reset} />}
    </div>
  )
}

function productTargetPlatforms(product: Product) {
  const attrs = product.attributes || {}
  const fromTargets = arrayOfStrings(attrs.target_platforms)
  const fromRequirements = Object.keys((attrs.platform_requirements || {}) as Record<string, unknown>)
  const fromListings = (product.listings || []).map(listing => listing.platform).filter(Boolean)
  return uniq([...fromTargets, ...fromRequirements, ...fromListings])
}

function productTargetMarkets(product: Product) {
  const attrs = product.attributes || {}
  return uniq(arrayOfStrings(attrs.target_markets))
}

function deriveSelectedTargetMarkets(
  items: PublishableItem[],
  selectedItems: Set<string>,
  stores: Array<{ id: string; market?: string | null }>,
  selectedStores: Set<string>,
  selectedMarkets: Set<string>,
) {
  const fromSelectedItems = items
    .filter(item => selectedItems.has(item.key))
    .flatMap(item => item.targetMarkets || [])
  const fromSelectedStores = stores
    .filter(store => selectedStores.has(store.id) && store.market)
    .map(store => store.market as string)
  return uniq([...Array.from(selectedMarkets), ...fromSelectedItems, ...fromSelectedStores])
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}
