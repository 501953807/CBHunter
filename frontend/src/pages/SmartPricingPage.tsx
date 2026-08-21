import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/shared/PageHeader'
import { confirmPricing, getPricingWorkbench, recommendPrice } from '../api/pricing'
import { listFeeRates, updatePricingAdjustmentTemplates, type PricingAdjustmentTemplateItem } from '../api/settings'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import { filterPlatformsByCapability } from '../utils/platformCapabilities'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { PriceRecommendationData } from '../api/pricing'
import type { ApiResponse } from '../types/common'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContentListingStageRail } from '../features/content-planner/ContentListingStageRail'
import { findFeeTemplate, matchesPricingProduct, normalizeProfitSliderValue, optionalNumber } from '../features/pricing/PricingPageUtils'
import { PricingCommandStrip, PricingInputPanel, PricingResultPanel, PricingSummaryRail } from '../features/pricing/SmartPricingPageParts'

export default function SmartPricingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialContentItemId = searchParams.get('content_item_id') || ''
  const initialProductId = searchParams.get('product_id') || ''
  const initialTargetPlatform = searchParams.get('target_platform') || ''
  const initialTargetStore = searchParams.get('target_store') || ''
  const initialTargetMarket = searchParams.get('target_market') || ''
  const { platforms, markets } = useConfig()
  const [sourcePrice, setSourcePrice] = useState('')
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [targetProfit, setTargetProfit] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [activityDiscount, setActivityDiscount] = useState('')
  const [minProfit, setMinProfit] = useState('')
  const [selectedPricingTemplateId, setSelectedPricingTemplateId] = useState('')
  const [pricingMode, setPricingMode] = useState<'cost_based' | 'selling_based' | ''>('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [result, setResult] = useState<PriceRecommendationData | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<PriceRecommendationData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [confirmingTier, setConfirmingTier] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmedProductId, setConfirmedProductId] = useState('')
  const pricingWorkbenchQuery = useQuery({
    queryKey: ['pricing-workbench'],
    queryFn: getPricingWorkbench,
  })
  const feeRatesQuery = useQuery({
    queryKey: ['settings-fee-rates'],
    queryFn: listFeeRates,
  })
  const pricingItems = pricingWorkbenchQuery.data?.data?.items || []
  const feeTemplates = feeRatesQuery.data?.data?.flat || []
  const pricingAdjustmentTemplates = feeRatesQuery.data?.data?.pricing_adjustment_templates || []
  const pricingPlatforms = filterPlatformsByCapability(platforms, 'pricing')
  const isConfigurationRequired = result?.status === 'configuration_required'
  const pricingDataGaps = result?.data_gaps || []
  const selectedPricingItem = pricingItems.find(item => item.id === selectedItemId)
  const selectedFeeTemplate = findFeeTemplate(feeTemplates, platform, market)
  const matchingPricingTemplates = pricingAdjustmentTemplates.filter(template => template.platform === platform && template.market === market)
  const selectedAdjustmentTemplate = pricingAdjustmentTemplates.find(template => template.id === selectedPricingTemplateId)
  const targetProfitSliderValue = normalizeProfitSliderValue(targetProfit)
  const selectedStoreLabel = selectedPricingItem?.store_options.find(store => store.id === selectedStoreId)?.account_name || '未选择店铺'
  const pricingTemplateLabel = selectedAdjustmentTemplate?.label || selectedFeeTemplate?.id || '待匹配模板'
  const readinessLabel = selectedFeeTemplate ? '费率已匹配' : platform && market ? '缺少费率模板' : '待选择商品'

  useEffect(() => {
    if (pricingWorkbenchQuery.error) logger.error('Load pricing workbench failed', pricingWorkbenchQuery.error)
  }, [pricingWorkbenchQuery.error])

  useEffect(() => {
    if (selectedItemId || pricingItems.length === 0) return
    const direct = initialContentItemId
      ? pricingItems.find(item => item.id === initialContentItemId || item.work_item_id === initialContentItemId)
      : null
    const byProduct = initialProductId
      ? pricingItems.find(item => matchesPricingProduct(item, initialProductId))
      : null
    const initial = direct || byProduct
    if (initial) {
      handleSelectItem(initial.id, {
        targetPlatform: initialTargetPlatform,
        targetStore: initialTargetStore,
        targetMarket: initialTargetMarket,
      })
    }
  }, [initialContentItemId, initialProductId, initialTargetPlatform, initialTargetStore, initialTargetMarket, pricingItems, selectedItemId])

  const handleSelectItem = (
    itemId: string,
    routeContext?: { targetPlatform?: string; targetStore?: string; targetMarket?: string },
  ) => {
    setSelectedItemId(itemId)
    const item = pricingItems.find(entry => entry.id === itemId)
    if (!item) {
      setSelectedStoreId('')
      return
    }
    const overrideStoreId = item.listing_store_override?.store_id || ''
    const routeStoreId = routeContext?.targetStore && item.store_options.some(store => store.id === routeContext.targetStore)
      ? routeContext.targetStore
      : ''
    const defaultStoreId = item.store_options.some(store => store.id === overrideStoreId) ? overrideStoreId : item.store_options[0]?.id || ''
    setSelectedStoreId(routeStoreId || defaultStoreId)
    setSourcePrice(String(item.source_price_rmb))
    setShippingCost('')
    setActivityDiscount('')
    setMinProfit('')
    setSelectedPricingTemplateId('')
    setPlatform(routeContext?.targetPlatform || item.platform)
    setMarket(routeContext?.targetMarket || item.market)
    setResult(null)
    setEvidence(null)
    setConfirmMessage('')
    setConfirmedProductId('')
  }

  const handleApplyPricingTemplate = (templateId: string) => {
    setSelectedPricingTemplateId(templateId)
    const template = pricingAdjustmentTemplates.find(item => item.id === templateId)
    if (!template) return
    setShippingCost(String(template.shipping_cost_rmb))
    setActivityDiscount(String(template.activity_discount_pct))
    setMinProfit(String(template.min_profit_rmb))
    setTargetProfit(String(template.target_profit_pct))
  }

  const handleSavePricingTemplate = async () => {
    if (!platform || !market) return
    setSavingTemplate(true)
    try {
      const id = `${platform}_${market}_default`
      const nextTemplate: PricingAdjustmentTemplateItem = {
        id,
        label: `${platform}/${market} 常规定价模板`,
        platform,
        market,
        shipping_cost_rmb: optionalNumber(shippingCost) ?? 0,
        activity_discount_pct: optionalNumber(activityDiscount) ?? 0,
        min_profit_rmb: optionalNumber(minProfit) ?? 0,
        target_profit_pct: optionalNumber(targetProfit) ?? 20,
      }
      const others = pricingAdjustmentTemplates.filter(template => template.id !== id)
      await updatePricingAdjustmentTemplates([...others, nextTemplate])
      setSelectedPricingTemplateId(id)
      await feeRatesQuery.refetch()
      setConfirmMessage('定价附加模板已保存，可在同平台/市场商品中复用')
    } catch (e: any) {
      logger.error('Save pricing adjustment template failed', e)
      setConfirmMessage(e?.response?.data?.detail || '定价附加模板保存失败')
    }
    setSavingTemplate(false)
  }

  const handleRecommend = async () => {
    setLoading(true)
    try {
      const res = await recommendPrice({
        source_price_rmb: Number(sourcePrice),
        platform, market,
        target_profit_pct: Number(targetProfit),
        pricing_mode: pricingMode as 'cost_based' | 'selling_based',
        content_item_id: selectedItemId || undefined,
        shipping_cost_rmb: optionalNumber(shippingCost),
        activity_discount_pct: optionalNumber(activityDiscount),
        min_profit_rmb: optionalNumber(minProfit),
      })
      setEvidence(res)
      if (res.data) setResult(res.data)
    } catch (e: any) { logger.error('Pricing failed', e) }
    setLoading(false)
  }

  const handleConfirmPrice = async (tier: 'conservative' | 'balanced' | 'aggressive') => {
    const rec = result?.recommendations[tier]
    if (!selectedItemId || !selectedStoreId || !pricingMode || !targetProfit || !rec?.selling_price_local) return
    setConfirmingTier(tier)
    setConfirmMessage('')
    setConfirmedProductId('')
    try {
      const res = await confirmPricing({
        content_item_id: selectedItemId,
        selling_price_rmb: rec.selling_price,
        selling_price_local: rec.selling_price_local,
        currency: rec.currency,
        pricing_tier: tier,
        pricing_mode: pricingMode,
        target_profit_pct: Number(targetProfit) + (tier === 'balanced' ? 10 : tier === 'aggressive' ? 20 : 0),
        platform_account_id: selectedStoreId || undefined,
        pricing_template_id: selectedAdjustmentTemplate?.id,
        pricing_template_label: selectedAdjustmentTemplate?.label,
        fee_template_id: selectedFeeTemplate?.id,
        fee_template_label: selectedFeeTemplate ? `${selectedFeeTemplate.platform}/${selectedFeeTemplate.market}` : undefined,
        shipping_cost_rmb: optionalNumber(shippingCost),
        activity_discount_pct: optionalNumber(activityDiscount),
        min_profit_rmb: optionalNumber(minProfit),
        estimated_fee_pct: result?.estimated_fee_pct,
        exchange_rate: result?.exchange_rate,
      })
      setConfirmedProductId(res.data?.product_id || '')
      setConfirmMessage(res.data?.listing_id ? '已确认价格并创建本地 Listing 草稿' : res.data?.note || '价格确认未完成')
    } catch (e: any) {
      logger.error('Confirm pricing failed', e)
      setConfirmMessage(e?.response?.data?.detail || '价格确认失败')
    }
    setConfirmingTier('')
  }

  return (
    <div className="pricing-shell space-y-6 page-enter">
      <ContentListingStageRail />
      <PageHeader title="智能定价" description="平台费率 + 物流成本 + 活动折扣 + 利润底线 = 店铺 Listing 售价草稿" />
      <EvidenceBanner evidence={evidence} />
      <PricingCommandStrip
        pricingItemsCount={pricingItems.length}
        selectedStoreLabel={selectedStoreLabel}
        pricingTemplateLabel={pricingTemplateLabel}
        readinessLabel={readinessLabel}
        ready={Boolean(selectedFeeTemplate)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <PricingInputPanel
            workbenchLoading={pricingWorkbenchQuery.isLoading}
            workbenchError={pricingWorkbenchQuery.isError}
            onReloadWorkbench={() => { void pricingWorkbenchQuery.refetch() }}
            initialProductId={initialProductId}
            initialTargetPlatform={initialTargetPlatform}
            initialTargetStore={initialTargetStore}
            initialTargetMarket={initialTargetMarket}
            pricingItems={pricingItems}
            selectedItemId={selectedItemId}
            selectedStoreId={selectedStoreId}
            onSelectItem={handleSelectItem}
            onSelectStore={setSelectedStoreId}
            sourcePrice={sourcePrice}
            platform={platform}
            market={market}
            targetProfit={targetProfit}
            targetProfitSliderValue={targetProfitSliderValue}
            pricingMode={pricingMode}
            shippingCost={shippingCost}
            activityDiscount={activityDiscount}
            minProfit={minProfit}
            selectedPricingTemplateId={selectedPricingTemplateId}
            pricingPlatforms={pricingPlatforms}
            markets={markets}
            matchingPricingTemplates={matchingPricingTemplates}
            savingTemplate={savingTemplate}
            loading={loading}
            onChangeSourcePrice={setSourcePrice}
            onChangePlatform={setPlatform}
            onChangeMarket={setMarket}
            onChangePricingMode={setPricingMode}
            onChangeTargetProfit={setTargetProfit}
            onApplyPricingTemplate={handleApplyPricingTemplate}
            onSavePricingTemplate={() => { void handleSavePricingTemplate() }}
            onChangeShippingCost={setShippingCost}
            onChangeActivityDiscount={setActivityDiscount}
            onChangeMinProfit={setMinProfit}
            onRecommend={() => { void handleRecommend() }}
          />
          <PricingResultPanel
            result={result}
            isConfigurationRequired={isConfigurationRequired}
            pricingDataGaps={pricingDataGaps}
            confirmMessage={confirmMessage}
            confirmedProductId={confirmedProductId}
            selectedPricingItem={selectedPricingItem}
            selectedItemId={selectedItemId}
            selectedStoreId={selectedStoreId}
            confirmingTier={confirmingTier}
            onNavigate={navigate}
            onConfirmPrice={tier => { void handleConfirmPrice(tier) }}
          />
        </div>

        <PricingSummaryRail
          result={result}
          sourcePrice={sourcePrice}
          activityDiscount={activityDiscount}
          minProfit={minProfit}
          selectedFeeTemplate={selectedFeeTemplate}
          platform={platform}
          market={market}
          selectedPricingItem={selectedPricingItem}
          selectedStoreId={selectedStoreId}
          selectedAdjustmentTemplate={selectedAdjustmentTemplate}
          shippingCost={shippingCost}
          targetProfit={targetProfit}
          feeLoading={feeRatesQuery.isLoading}
          onOpenSettings={() => navigate('/settings/fees')}
        />
      </div>
    </div>
  )
}
