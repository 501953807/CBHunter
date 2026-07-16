import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, TrendingUp, Target, Shield, Zap } from 'lucide-react'
import { PageHeader } from '../components/shared/PageHeader'
import { Card, CardContent } from '../components/ui/Card'
import { StatCard } from '../components/shared/StatCard'
import { confirmPricing, getPricingWorkbench, recommendPrice } from '../api/pricing'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import { filterPlatformsByCapability } from '../utils/platformCapabilities'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../api/pricing'
import type { ApiResponse } from '../types/common'
import { businessActionForCode, labelBusinessCode } from '../utils/businessLabels'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PricingItemSelector } from '../features/pricing/PricingItemSelector'
import { ContentListingStageRail } from '../features/content-planner/ContentListingStageRail'

export default function SmartPricingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialContentItemId = searchParams.get('content_item_id') || ''
  const initialProductId = searchParams.get('product_id') || ''
  const { platforms, markets } = useConfig()
  const [sourcePrice, setSourcePrice] = useState('')
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [targetProfit, setTargetProfit] = useState('')
  const [pricingMode, setPricingMode] = useState<'cost_based' | 'selling_based' | ''>('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [result, setResult] = useState<PriceRecommendationData | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<PriceRecommendationData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmingTier, setConfirmingTier] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmedProductId, setConfirmedProductId] = useState('')
  const pricingWorkbenchQuery = useQuery({
    queryKey: ['pricing-workbench'],
    queryFn: getPricingWorkbench,
  })
  const pricingItems = pricingWorkbenchQuery.data?.data?.items || []
  const pricingPlatforms = filterPlatformsByCapability(platforms, 'pricing')
  const isConfigurationRequired = result?.status === 'configuration_required'
  const pricingDataGaps = result?.data_gaps || []
  const selectedPricingItem = pricingItems.find(item => item.id === selectedItemId)
  const targetProfitSliderValue = normalizeProfitSliderValue(targetProfit)

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
    if (initial) handleSelectItem(initial.id)
  }, [initialContentItemId, initialProductId, pricingItems, selectedItemId])

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId)
    const item = pricingItems.find(entry => entry.id === itemId)
    if (!item) {
      setSelectedStoreId('')
      return
    }
    const overrideStoreId = item.listing_store_override?.store_id || ''
    const defaultStoreId = item.store_options.some(store => store.id === overrideStoreId) ? overrideStoreId : item.store_options[0]?.id || ''
    setSelectedStoreId(defaultStoreId)
    setSourcePrice(String(item.source_price_rmb))
    setPlatform(item.platform)
    setMarket(item.market)
    setResult(null)
    setEvidence(null)
    setConfirmMessage('')
    setConfirmedProductId('')
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
    <div className="space-y-6 page-enter">
      <ContentListingStageRail />
      <PageHeader title="智能定价" description="成本 + 费率 + 利润 = 自动推荐最优售价" />
      <EvidenceBanner evidence={evidence} />

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {pricingWorkbenchQuery.isError && (
                <div
                  data-ui="pricing-workbench-error"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--color-danger)]">定价商品队列加载失败，请检查后端服务或当前登录权限。</span>
                  <button
                    type="button"
                    onClick={() => pricingWorkbenchQuery.refetch()}
                    className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
                  >
                    重新加载定价队列
                  </button>
                </div>
              )}
              {pricingWorkbenchQuery.isLoading && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  正在加载定价商品队列...
                </div>
              )}
              <PricingItemSelector items={pricingItems} selectedItemId={selectedItemId} selectedStoreId={selectedStoreId} onSelectItem={handleSelectItem} onSelectStore={setSelectedStoreId} />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>采购价 (RMB)</label>
                  <input
                    type="number" min="0.01" step="0.01" value={sourcePrice}
                    onChange={e => setSourcePrice(e.target.value)}
                    placeholder="请输入真实采购价"
                    className="w-full text-lg font-bold rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>平台</label>
                  <select
                    value={platform} onChange={e => setPlatform(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {pricingPlatforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>市场</label>
                  <select
                    value={market} onChange={e => setMarket(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {markets.map(m => <option key={m.id} value={m.id}>{m.flag ? `${m.flag} ` : ''}{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
                  <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => setPricingMode('cost_based')} />
                  成本利润率
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
                  <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => setPricingMode('selling_based')} />
                  售价利润率
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {pricingMode === 'cost_based' ? '目标成本利润率' : pricingMode === 'selling_based' ? '目标售价净利率' : '目标利润率'}
                  </label>
                  <span className="text-xs font-medium text-[var(--color-primary)]">{targetProfit || targetProfitSliderValue}%</span>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" data-ui="pricing-profit-slider">
                  <input
                    aria-label="目标利润率滑块"
                    type="range"
                    min="0.1"
                    max="60"
                    step="0.1"
                    value={targetProfitSliderValue}
                    onChange={e => setTargetProfit(e.target.value)}
                    className="w-full accent-[var(--color-primary)]"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number" min="0.1" max="60" step="0.1" value={targetProfit}
                      onChange={e => setTargetProfit(e.target.value)}
                      placeholder="请输入目标利润率"
                      className="w-32 rounded-lg px-3 py-2 outline-none"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                    />
                    <p className="text-xs text-[var(--color-muted)]">拖动滑块快速调整利润率，精确数值可在输入框修正。</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRecommend}
                disabled={loading || !platform || !market || !sourcePrice || !targetProfit || !pricingMode}
                className="w-full py-2.5 rounded-lg text-[var(--color-primary-text)] font-medium disabled:opacity-40 transition-colors"
                style={{ background: 'var(--gradient-accent)' }}
              >
                {loading ? '计算中...' : '计算推荐售价'}
              </button>
            </CardContent>
          </Card>

          {/* Results */}
          {isConfigurationRequired && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-[var(--color-warning)]">配置未完成</p>
                <p className="text-xs mt-1 text-[var(--color-muted)]">{result.message || result.note}</p>
                {pricingDataGaps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pricingDataGaps.map((gap: string) => (
                      <span
                        key={gap}
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}
                      >
                        {labelBusinessCode(gap)}
                      </span>
                    ))}
                  </div>
                )}
                {pricingDataGaps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pricingDataGaps.map((gap: string) => {
                      const action = businessActionForCode(gap)
                      return (
                        <button key={`${gap}-${action.route}`} onClick={() => navigate(action.route)} className="text-[11px] text-[var(--color-primary)] hover:underline">
                          {action.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {confirmMessage && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg)]">
              <span>{confirmMessage}</span>
              {confirmedProductId && (
                <button
                  onClick={() => navigate(`/publish?product_id=${confirmedProductId}`)}
                  className="rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                >
                  进入平台刊登
                </button>
              )}
            </div>
          )}
          {result?.status === 'ready' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {(['conservative', 'balanced', 'aggressive'] as const).map(tier => {
                  const rec = result.recommendations[tier]
                  if (!rec) return null
                  return (
                    <Card key={tier}>
                      <CardContent className="pt-4 text-center">
                        <div className="flex justify-center mb-2">
                          {tier === 'conservative' ? <Shield className="w-5 h-5" style={{ color: 'var(--color-info)' }} />
                           : tier === 'balanced' ? <Target className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                           : <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
                        </div>
                        <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>{rec.label}</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>¥{rec.selling_price}</p>
                        {rec.selling_price_local != null && <p className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>{rec.currency} {rec.selling_price_local}</p>}
                        {rec.competition_position && <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{rec.competition_position === 'below_band' ? '低于竞品价格带' : rec.competition_position === 'above_band' ? '高于竞品价格带' : '位于竞品价格带内'}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>净利润率 {rec.net_profit_pct}%</p>
                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                            净利润 ¥{rec.net_profit_rmb.toFixed(2)}
                          </p>
                        </div>
                        <button onClick={() => handleConfirmPrice(tier)} disabled={!selectedItemId || !selectedStoreId || confirmingTier === tier || !rec.selling_price_local} className="mt-3 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] disabled:opacity-40">
                          {confirmingTier === tier ? '确认中...' : '确认并创建草稿'}
                        </button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <PricingDecisionContext result={result} item={selectedPricingItem} />
            </div>
          )}
        </div>

        {/* Right: Summary cards */}
        <div className="space-y-3">
          <StatCard
            label="采购成本"
            value={sourcePrice ? `¥${sourcePrice}` : '--'}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard
            label="平台费率"
            value={result?.estimated_fee_pct == null ? '待配置' : `${result.estimated_fee_pct}%`}
            icon={<Calculator className="w-4 h-4" />}
          />
          <StatCard
            label="推荐售价(平衡)"
            value={result?.status === 'ready' && result.recommendations.balanced ? `¥${result.recommendations.balanced.selling_price}` : '--'}
            icon={<Target className="w-4 h-4" />}
            change={result?.status === 'ready' ? result.recommendations.balanced?.net_profit_pct : undefined}
          />
          {result?.competitor_price_band && (
            <StatCard
              label="竞品价格带"
              value={`${result.competitor_price_band.currency} ${result.competitor_price_band.min}-${result.competitor_price_band.max}`}
              icon={<Shield className="w-4 h-4" />}
            />
          )}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
              <strong>💡 定价提示</strong><br />
              保守定价适合新上架获取初始销量<br />
              平衡定价适合稳定运营<br />
              激进定价适合爆款或独占品类
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function matchesPricingProduct(item: PricingWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}

function normalizeProfitSliderValue(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(Math.max(numeric, 0.1), 60)
}

function PricingDecisionContext({ result, item }: { result: PriceRecommendationData; item?: PricingWorkbenchItem }) {
  const balanced = result.recommendations.balanced
  const feePct = result.estimated_fee_pct ?? 0
  const sellingPrice = balanced?.selling_price ?? 0
  const platformFee = sellingPrice * feePct / 100
  const sourceCost = result.source_price_rmb
  const netProfit = balanced?.net_profit_rmb ?? null
  const maxAbs = Math.max(sourceCost, platformFee, Math.abs(netProfit ?? 0), 1)
  const profitRows = [
    { label: '采购成本 source_price_rmb', value: sourceCost, tone: 'var(--color-danger)' },
    { label: '平台费 estimated_fee_pct', value: platformFee, tone: 'var(--color-warning)' },
    { label: '净利润', value: netProfit ?? 0, tone: (netProfit ?? 0) < 0 ? 'var(--color-danger)' : 'var(--color-primary)' },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-[var(--color-fg)]">定价历史</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            当前展示本次定价快照；后续接入真实调价日志后按店铺、平台和商品版本形成价格时间线。
          </p>
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--color-muted)]">{item?.product_name || result.product_name || '当前定价商品'}</span>
              <span className="font-medium text-[var(--color-fg)]">{balanced ? `¥${balanced.selling_price}` : '--'}</span>
            </div>
            <p className="mt-1 text-[var(--color-muted)]">
              {[result.platform, result.market, balanced?.label].filter(Boolean).join(' · ') || '平台/市场待选择'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-[var(--color-fg)]">竞品价格带对比</p>
          {result.competitor_price_band ? (
            <div className="mt-3 space-y-2 text-xs">
              {[
                ['最低价', result.competitor_price_band.min],
                ['中位价', result.competitor_price_band.median],
                ['最高价', result.competitor_price_band.max],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-[var(--color-bg)] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-muted)]">{label as string}</span>
                    <span className="font-medium text-[var(--color-fg)]">{result.competitor_price_band?.currency} {Number(value).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[var(--color-muted)]">样本 {result.competitor_price_band.sample_count} 个；用于判断推荐售价相对竞品区间的位置。</p>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
              暂无真实竞品价格样本；补充竞品监控后展示平台价格带，不使用模拟竞品。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4" data-ui="pricing-profit-breakdown">
          <p className="text-sm font-semibold text-[var(--color-fg)]">利润拆分</p>
          <div className="mt-3 space-y-2">
            {profitRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-muted)]">{row.label}</span>
                  <span className="font-medium text-[var(--color-fg)]">¥{row.value.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-border)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(Math.abs(row.value) / maxAbs * 100, row.value ? 4 : 0)}%`, background: row.tone }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            以平衡档售价拆分采购成本、平台费和净利润，确认后写入本地 Listing 草稿，平台实际费用以账单同步为准。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
