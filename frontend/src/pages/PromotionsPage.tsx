import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, PackagePlus, RefreshCw } from 'lucide-react'
import {
  addPromotionCampaignItems,
  createPromotionCampaign,
  getPromotionCampaigns,
  syncPromotionCampaign,
  updatePromotionCampaign,
  updatePromotionCampaignDiscount,
  updatePromotionCampaignStatus,
  type PromotionCampaign,
  type PromotionGovernanceSummary,
} from '../api/promotions'
import { getPlatformStoreProducts } from '../api/products'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { Select } from '../components/ui/Select'
import { useConfig } from '../hooks/useConfig'
import { usePlatforms } from '../hooks/usePlatforms'
import { logger } from '../utils/logger'
import { PromotionGovernancePanel, buildPromotionGovernanceSummary, normalizePromotionGovernanceSummary } from '../features/promotions/PromotionGovernancePanel'
import { PromotionTypeRuleGuide } from '../features/promotions/PromotionTypeRuleGuide'
import { PromotionWatermarkSelector } from '../features/promotions/PromotionWatermarkSelector'
import { buildMarketingWatermark, marketingWatermarkSummary, marketingWatermarkToForm } from '../features/promotions/PromotionWatermarkUtils'
import { promotionPlatformSyncSummary } from '../features/promotions/PromotionSyncUtils'
import { Field, PromotionCandidateCard, PromotionEffectSummary, PromotionListingFieldDictionary } from '../features/promotions/PromotionPageParts'
import {
  EMPTY_CREATE_FORM,
  PROMOTION_TYPE_OPTIONS,
  buildMarketingRules,
  marketingRulesSummary,
  marketingRulesToForm,
  promotionTypeLabel,
  type PromotionCreateFormState,
} from '../features/promotions/PromotionPageModel'

export default function PromotionsPage() {
  const confirmAction = useConfirm()
  const [items, setItems] = useState<PromotionCampaign[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [governanceSummary, setGovernanceSummary] = useState<PromotionGovernanceSummary | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionMode, setActionMode] = useState<'edit' | 'add-items' | 'discount' | null>(null)
  const [actionCampaign, setActionCampaign] = useState<PromotionCampaign | null>(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<PromotionCreateFormState>(EMPTY_CREATE_FORM)
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([])
  const { unified_field_dictionary } = useConfig()
  const { data: platformsData } = usePlatforms()
  const stores = platformsData?.data || []
  const effectivePlatformAccountId = actionMode === 'add-items' && actionCampaign ? actionCampaign.store.id : form.platformAccountId
  const selectedStore = stores.find((store) => store.id === effectivePlatformAccountId) || (actionCampaign ? {
    id: actionCampaign.store.id,
    platform: actionCampaign.platform,
    account_name: actionCampaign.store.account_name,
  } : null)
  const candidateQuery = useQuery({
    queryKey: ['promotion-candidate-listings', effectivePlatformAccountId, form.productSearch],
    enabled: !!effectivePlatformAccountId,
    queryFn: () => getPlatformStoreProducts({
      platform_account_id: effectivePlatformAccountId,
      search: form.productSearch || undefined,
      page_size: 50,
    }),
  })
  const candidateListings = candidateQuery.data?.data || []
  const applyCampaignList = (nextItems: PromotionCampaign[]) => {
    setItems(nextItems)
    setGovernanceSummary(buildPromotionGovernanceSummary(nextItems))
  }

  const load = () => {
    setLoading(true)
    setMessage('')
    getPromotionCampaigns()
      .then((result) => {
        setItems(result.data || [])
        setGovernanceSummary(normalizePromotionGovernanceSummary(result.meta?.summary, result.data || []))
        if (result.status === 'data_required') setMessage('暂无促销活动。请先在平台后台或本系统创建活动，再添加参与商品。')
      })
      .catch((e: any) => {
        logger.error('Load promotion campaigns failed', e)
        setMessage(e?.message || '促销活动加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreateCampaign = async () => {
    if (!form.name.trim()) {
      setMessage('请填写促销活动名称。')
      return
    }
    if (!form.platformAccountId) {
      setMessage('请选择促销活动所属店铺。')
      return
    }
    if (selectedListingIds.length === 0) {
      setMessage('请选择至少 1 个参与促销的商品。')
      return
    }
    const discountValue = Number(form.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setMessage('请填写有效的活动折扣比例。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const selectedListings = candidateListings.filter((item) => selectedListingIds.includes(item.id))
      const result = await createPromotionCampaign({
        platform_account_id: form.platformAccountId,
        name: form.name.trim(),
        promotion_type: form.promotionType,
        platform_data: { marketing_rules: buildMarketingRules(form), marketing_watermark: buildMarketingWatermark(form) },
        starts_at: form.startsAt || undefined,
        ends_at: form.endsAt || undefined,
        items: selectedListings.map((item) => ({
          platform_listing_id: item.id,
          discount_value: discountValue,
          stock_limit: form.stockLimit ? Number(form.stockLimit) : undefined,
        })),
      })
      if (result.data) {
        applyCampaignList([result.data as PromotionCampaign, ...items])
        setShowCreate(false)
        setForm(EMPTY_CREATE_FORM)
        setSelectedListingIds([])
        setMessage('促销活动已创建为本地活动；平台 Open API 接通前不会显示为平台已生效。')
      }
    } catch (e: any) {
      logger.error('Create promotion campaign failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '促销活动创建失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleListing = (listingId: string) => {
    setSelectedListingIds((current) => current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId])
  }

  const handleEndCampaign = async (campaignId: string) => {
    const campaign = items.find((item) => item.id === campaignId)
    const ok = await confirmAction({
      title: '结束促销活动',
      message: `确认结束${campaign ? `「${campaign.name}」` : '该促销活动'}？本系统会先结束本地活动状态；平台 Open API 未接通前不会向平台执行结束动作。`,
      confirmText: '确认结束',
      tone: 'danger',
    })
    if (!ok) return
    setSaving(true)
    setMessage('')
    try {
      const result = await updatePromotionCampaignStatus(campaignId, 'ended')
      if (result.data) {
        applyCampaignList(items.map((item) => item.id === campaignId ? result.data as PromotionCampaign : item))
        setMessage('促销活动已在本地结束；平台 Open API 接通前不会执行平台结束动作。')
      }
    } catch (e: any) {
      logger.error('End promotion campaign failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '促销活动结束失败')
    } finally {
      setSaving(false)
    }
  }

  const startCampaignAction = (campaign: PromotionCampaign, mode: 'edit' | 'add-items' | 'discount') => {
    setShowCreate(false)
    setActionCampaign(campaign)
    setActionMode(mode)
    setSelectedListingIds([])
    setMessage('')
    setForm({
      ...EMPTY_CREATE_FORM,
      name: mode === 'edit' ? campaign.name : '',
      promotionType: mode === 'edit' ? campaign.promotion_type : 'discount',
      platformAccountId: campaign.store.id,
      startsAt: mode === 'edit' ? String(campaign.starts_at || '') : '',
      endsAt: mode === 'edit' ? String(campaign.ends_at || '') : '',
	      discountValue: mode === 'discount' ? String(campaign.items[0]?.discount_value || '') : '',
	      ...marketingRulesToForm(campaign.platform_data?.marketing_rules),
	      ...marketingWatermarkToForm(campaign.platform_data?.marketing_watermark),
	    })
	  }

  const handleUpdateCampaign = async () => {
    if (!actionCampaign) return
    if (!form.name.trim()) {
      setMessage('请填写促销活动名称。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const result = await updatePromotionCampaign(actionCampaign.id, {
        name: form.name.trim(),
        promotion_type: form.promotionType,
	        platform_data: { marketing_rules: buildMarketingRules(form), marketing_watermark: buildMarketingWatermark(form) },
        starts_at: form.startsAt || undefined,
        ends_at: form.endsAt || undefined,
        stack_rule: form.stockLimit.trim() || undefined,
      })
      if (result.data) {
        applyCampaignList(items.map((item) => item.id === actionCampaign.id ? result.data as PromotionCampaign : item))
        setActionMode(null)
        setActionCampaign(null)
        setForm(EMPTY_CREATE_FORM)
        setMessage('促销活动基础信息已更新；未修改参与商品或 Listing。')
      }
    } catch (e: any) {
      logger.error('Update promotion campaign failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '修改促销活动失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItemsToCampaign = async () => {
    if (!actionCampaign) return
    if (selectedListingIds.length === 0) {
      setMessage('请选择要追加到当前活动的商品。')
      return
    }
    const discountValue = Number(form.discountValue || actionCampaign.items[0]?.discount_value || 0)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setMessage('请填写有效的追加商品折扣比例。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const selectedListings = candidateListings.filter((item) => selectedListingIds.includes(item.id))
      const result = await addPromotionCampaignItems(actionCampaign.id, selectedListings.map((item) => ({
        platform_listing_id: item.id,
        discount_value: discountValue,
        stock_limit: form.stockLimit ? Number(form.stockLimit) : undefined,
      })))
      if (result.data) {
        applyCampaignList(items.map((item) => item.id === actionCampaign.id ? result.data as PromotionCampaign : item))
        setActionMode(null)
        setActionCampaign(null)
        setSelectedListingIds([])
        setForm(EMPTY_CREATE_FORM)
        setMessage('参与商品已追加到本地促销活动；未执行平台同步。')
      }
    } catch (e: any) {
      logger.error('Add promotion campaign items failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '追加促销商品失败')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCampaignDiscount = async () => {
    if (!actionCampaign) return
    const discountValue = Number(form.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setMessage('请填写有效的活动折扣比例。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const result = await updatePromotionCampaignDiscount(actionCampaign.id, discountValue)
      if (result.data) {
        applyCampaignList(items.map((item) => item.id === actionCampaign.id ? result.data as PromotionCampaign : item))
        setActionMode(null)
        setActionCampaign(null)
        setForm(EMPTY_CREATE_FORM)
        setMessage('活动折扣已更新到本地活动明细；未写入商品主档或 Listing 覆盖。')
      }
    } catch (e: any) {
      logger.error('Update promotion campaign discount failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '修改促销折扣失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncCampaign = async (campaignId: string) => {
    const campaign = items.find((item) => item.id === campaignId)
    const ok = await confirmAction({
      title: '同步促销活动',
      message: `确认同步${campaign ? `「${campaign.name}」` : '该促销活动'}？当前只会调用已配置的平台同步能力；未实现 Open API 时会返回缺口，不会冒充平台已生效。`,
      confirmText: '确认同步',
      tone: 'warning',
    })
    if (!ok) return
    setSaving(true)
    setMessage('')
    try {
      const result = await syncPromotionCampaign(campaignId)
      if (result.data) {
        applyCampaignList(items.map((item) => item.id === campaignId ? result.data as PromotionCampaign : item))
      }
      const gaps = result.data_gaps?.length ? `缺口：${result.data_gaps.join('、')}` : '平台同步未执行'
      setMessage(`促销活动平台同步未完成；${gaps}。`)
    } catch (e: any) {
      logger.error('Sync promotion campaign failed', e)
      setMessage(e?.response?.data?.detail || e?.message || '促销活动同步失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="promotions-shell space-y-5">
      <section className="promotions-hero">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">PROMOTION OPERATIONS</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--color-fg)]">促销活动</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
              促销折扣是独立活动对象：一个活动归属于一个平台店铺，可以包含多个参与商品或 Listing。商品编辑页不再直接维护折扣价。
            </p>
          </div>
          <div className="promotions-hero-actions">
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="mr-1 h-4 w-4" />刷新</Button>
            <Button onClick={() => { setShowCreate((value) => !value); setMessage('') }}><PackagePlus className="mr-1 h-4 w-4" />创建促销活动</Button>
          </div>
        </div>
      </section>

      <div className="promotions-governance-panel">
        <PromotionGovernancePanel summary={governanceSummary || buildPromotionGovernanceSummary(items)} />
      </div>
      <div className="promotions-rule-panel">
        <PromotionTypeRuleGuide />
      </div>

      {message && <p className="promotions-message">{message}</p>}

      {showCreate && (
        <section className="promotions-form-panel" aria-label="创建促销活动">
          <div className="promotions-section-heading mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-fg)]">创建本地促销活动</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                先选择一个平台店铺，再从该店铺 Listing 中选择多个参与商品；本阶段只保存本地活动和缺口，不执行平台同步。
              </p>
            </div>
            <Badge variant="outline">本地活动</Badge>
          </div>
          <div className="promotions-form-grid">
            <Field label="活动名称" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="如：7月新品测品折扣" />
            <Select label="活动类型" value={form.promotionType} onChange={(promotionType) => setForm({ ...form, promotionType })} options={PROMOTION_TYPE_OPTIONS} />
            <Select
              label="所属店铺"
              value={form.platformAccountId}
              onChange={(value) => { setForm({ ...form, platformAccountId: value }); setSelectedListingIds([]) }}
              options={[{ value: '', label: '请选择店铺' }, ...stores.map((store) => ({ value: store.id, label: `${store.account_name} · ${store.platform}` }))]}
            />
            <Field label="活动折扣比例(%)" value={form.discountValue} onChange={(value) => setForm({ ...form, discountValue: value })} placeholder="如：10" type="number" />
            <Field label="券门槛/预算" value={form.ruleThreshold} onChange={(value) => setForm({ ...form, ruleThreshold: value })} placeholder="如满99可用 / 预算500" />
            <Field label="限购/秒杀库存" value={form.ruleLimit} onChange={(value) => setForm({ ...form, ruleLimit: value })} placeholder="如每人1件 / 秒杀50件" />
            <Field label="联盟佣金(%)" value={form.ruleCommission} onChange={(value) => setForm({ ...form, ruleCommission: value })} placeholder="联盟活动填写" type="number" />
            <Field label="开始时间" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} placeholder="2026-07-15T00:00:00+08:00" />
	            <Field label="结束时间" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} placeholder="2026-07-22T23:59:59+08:00" />
	            <Field label="单品活动库存上限" value={form.stockLimit} onChange={(value) => setForm({ ...form, stockLimit: value })} placeholder="不填则不限制" type="number" />
	          </div>
	          <div className="promotions-sub-panel mt-4">
	            <PromotionWatermarkSelector
	              platform={selectedStore?.platform}
	              value={{ templateId: form.watermarkTemplateId, scope: form.watermarkScope }}
	              onChange={(value) => setForm({ ...form, watermarkTemplateId: value.templateId, watermarkScope: value.scope })}
	            />
	          </div>
	          <div className="promotions-picker-panel mt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">选择参与商品</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  当前店铺：{selectedStore ? `${selectedStore.account_name} · ${selectedStore.platform}` : '未选择'}；已选择 {selectedListingIds.length} 个 Listing。
                </p>
              </div>
              <div className="w-full sm:w-72">
                <Field label="搜索商品" value={form.productSearch} onChange={(value) => setForm({ ...form, productSearch: value })} placeholder="标题、平台商品ID、SKU" />
              </div>
            </div>
            {!form.platformAccountId ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted)]">请先选择所属店铺，再添加参与促销的商品。</p>
            ) : candidateListings.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted)]">当前店铺暂无可选 Listing；请先同步平台商品或创建本地 Listing 草稿。</p>
            ) : (
              <div className="promotions-candidate-grid mt-3">
                {candidateListings.map((listing) => (
                  <PromotionCandidateCard
                    key={listing.id}
                    item={listing}
                    selected={selectedListingIds.includes(listing.id)}
                    unified_field_dictionary={unified_field_dictionary}
                    onToggle={() => toggleListing(listing.id)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="promotions-form-actions mt-4">
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>取消</Button>
            <Button onClick={handleCreateCampaign} disabled={saving}>{saving ? '保存中...' : '保存促销活动'}</Button>
          </div>
        </section>
      )}

      {actionCampaign && actionMode && (
        <section className="promotions-action-panel" aria-label="促销活动行内操作">
          <div className="promotions-section-heading mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-fg)]">{actionMode === 'edit' ? '修改活动' : actionMode === 'add-items' ? '添加参与商品' : '修改活动折扣'}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                当前活动：{actionCampaign.name} · {actionCampaign.store.account_name}。操作只更新本地促销活动，不回写 Listing。
              </p>
            </div>
            <Button variant="secondary" onClick={() => { setActionMode(null); setActionCampaign(null); setSelectedListingIds([]); setForm(EMPTY_CREATE_FORM) }}>关闭</Button>
          </div>
          {actionMode === 'edit' ? (
            <>
              <div className="promotions-inline-form-grid">
                <Field label="活动名称" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <Select label="活动类型" value={form.promotionType} onChange={(promotionType) => setForm({ ...form, promotionType })} options={PROMOTION_TYPE_OPTIONS} />
              <Field label="券门槛/预算" value={form.ruleThreshold} onChange={(value) => setForm({ ...form, ruleThreshold: value })} placeholder="按平台规则待同步" />
              <Field label="限购/秒杀库存" value={form.ruleLimit} onChange={(value) => setForm({ ...form, ruleLimit: value })} placeholder="限购或锁库存" />
              <Field label="联盟佣金(%)" value={form.ruleCommission} onChange={(value) => setForm({ ...form, ruleCommission: value })} placeholder="联盟活动填写" type="number" />
              <Field label="开始时间" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} placeholder="2026-07-20T00:00:00+08:00" />
              <Field label="结束时间" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} placeholder="2026-07-25T23:59:59+08:00" />
                <Field label="叠加规则" value={form.stockLimit} onChange={(value) => setForm({ ...form, stockLimit: value })} placeholder="如 no_stack" />
                <Button onClick={handleUpdateCampaign} disabled={saving}>{saving ? '保存中...' : '保存活动'}</Button>
              </div>
              <div className="promotions-sub-panel mt-3">
                <PromotionWatermarkSelector
                  platform={actionCampaign.platform}
                  value={{ templateId: form.watermarkTemplateId, scope: form.watermarkScope }}
                  onChange={(value) => setForm({ ...form, watermarkTemplateId: value.templateId, watermarkScope: value.scope })}
                />
              </div>
            </>
          ) : actionMode === 'discount' ? (
            <div className="promotions-discount-grid">
              <Field label="新的活动折扣比例(%)" value={form.discountValue} onChange={(value) => setForm({ ...form, discountValue: value })} placeholder="如：15" type="number" />
              <Button onClick={handleUpdateCampaignDiscount} disabled={saving}>{saving ? '保存中...' : '保存折扣'}</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="promotions-add-items-grid">
                <Field label="搜索商品" value={form.productSearch} onChange={(value) => setForm({ ...form, productSearch: value })} placeholder="标题、平台商品ID、SKU" />
                <Field label="追加商品折扣比例(%)" value={form.discountValue} onChange={(value) => setForm({ ...form, discountValue: value })} placeholder="默认沿用活动折扣" type="number" />
                <Field label="单品库存上限" value={form.stockLimit} onChange={(value) => setForm({ ...form, stockLimit: value })} placeholder="不填则不限制" type="number" />
              </div>
              <p className="text-xs text-[var(--color-muted)]">选择参与商品：{selectedStore ? `${selectedStore.account_name} · ${selectedStore.platform}` : '当前活动店铺'}；已选择 {selectedListingIds.length} 个 Listing。</p>
              {candidateListings.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted)]">当前店铺暂无可追加 Listing。</p>
              ) : (
                <div className="promotions-candidate-grid">
                  {candidateListings.map((listing) => (
                    <PromotionCandidateCard
                      key={listing.id}
                      item={listing}
                      selected={selectedListingIds.includes(listing.id)}
                      unified_field_dictionary={unified_field_dictionary}
                      onToggle={() => toggleListing(listing.id)}
                    />
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleAddItemsToCampaign} disabled={saving}>{saving ? '保存中...' : '追加参与商品'}</Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="promotions-table-panel">
        <div className="promotions-section-heading mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">活动列表</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">集中维护本地促销活动、参与商品、活动价格、营销水印和平台同步边界。</p>
          </div>
          <span className="promotions-count-pill">活动 {items.length} 个</span>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            暂无促销活动。促销活动应先独立创建，再添加多个参与商品。
          </div>
        ) : (
          <div className="promotions-table-shell">
            <table className="professional-table w-full text-left text-sm">
              <thead className="bg-[var(--color-bg)] text-xs text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2">活动名称/ID</th>
                  <th className="px-3 py-2">所属店铺</th>
                  <th className="px-3 py-2">活动产品</th>
                  <th className="px-3 py-2">活动效果</th>
                  <th className="px-3 py-2">状态/活动时间</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="promotions-row border-t border-[var(--color-border)] align-top">
                    <td className="px-3 py-3">
	                      <p className="font-medium text-[var(--color-fg)]">{item.name}</p>
	                      <p className="mt-1 text-xs text-[var(--color-primary)]">{promotionTypeLabel(item.promotion_type)}</p>
	                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{marketingRulesSummary(item.platform_data?.marketing_rules)}</p>
	                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{marketingWatermarkSummary(item.platform_data?.marketing_watermark)}</p>
	                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{promotionPlatformSyncSummary(item.platform_data?.promotion_platform_sync)}</p>
	                      <p className="mt-1 text-xs text-[var(--color-muted)]">{item.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge>{item.platform.toUpperCase()}</Badge>
                      <p className="mt-2 text-xs text-[var(--color-muted)]">{item.store.account_name}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[var(--color-fg)]">{item.product_count} 个产品参与</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{item.items.map((entry) => entry.product_name).join('、') || '待添加商品'}</p>
                      <PromotionListingFieldDictionary campaign={item} unified_field_dictionary={unified_field_dictionary} />
                    </td>
                    <td className="px-3 py-3">
                      <PromotionEffectSummary campaign={item} />
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={item.status === 'active' || item.status === 'ongoing' ? 'success' : 'default'}>{item.status}</Badge>
                      <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-muted)]"><CalendarDays className="h-3.5 w-3.5" />{item.starts_at || '开始待定'} - {item.ends_at || '结束待定'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => startCampaignAction(item, 'edit')}>修改活动</button>
                        <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => startCampaignAction(item, 'add-items')}>添加产品</button>
                        <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => startCampaignAction(item, 'discount')}>修改折扣</button>
                        <button type="button" className="promotions-row-action text-[var(--color-danger)] disabled:text-[var(--color-muted)]" disabled={saving || item.status === 'ended'} onClick={() => handleEndCampaign(item.id)}>结束活动</button>
                        <button type="button" className="promotions-row-action text-[var(--color-muted)]" disabled={saving} onClick={() => handleSyncCampaign(item.id)}>同步</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
