import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackagePlus, RefreshCw } from 'lucide-react'
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
import { Button } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { useConfig } from '../hooks/useConfig'
import { usePlatforms } from '../hooks/usePlatforms'
import { logger } from '../utils/logger'
import { PromotionGovernancePanel, buildPromotionGovernanceSummary, normalizePromotionGovernanceSummary } from '../features/promotions/PromotionGovernancePanel'
import { PromotionTypeRuleGuide } from '../features/promotions/PromotionTypeRuleGuide'
import { buildMarketingWatermark, marketingWatermarkToForm } from '../features/promotions/PromotionWatermarkUtils'
import { PromotionCampaignTable } from '../features/promotions/PromotionPageParts'
import { PromotionActionPanel, PromotionCreatePanel, type PromotionActionMode } from '../features/promotions/PromotionFormParts'
import {
  EMPTY_CREATE_FORM,
  buildMarketingRules,
  marketingRulesToForm,
  type PromotionCreateFormState,
} from '../features/promotions/PromotionPageModel'

export default function PromotionsPage() {
  const confirmAction = useConfirm()
  const [items, setItems] = useState<PromotionCampaign[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [governanceSummary, setGovernanceSummary] = useState<PromotionGovernanceSummary | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionMode, setActionMode] = useState<PromotionActionMode | null>(null)
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

  const startCampaignAction = (campaign: PromotionCampaign, mode: PromotionActionMode) => {
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
        <PromotionCreatePanel
          candidateListings={candidateListings}
          form={form}
          onCreate={handleCreateCampaign}
          onFormChange={setForm}
          onListingToggle={toggleListing}
          onStoreChange={(value) => { setForm({ ...form, platformAccountId: value }); setSelectedListingIds([]) }}
          onToggleCreate={setShowCreate}
          saving={saving}
          selectedListingIds={selectedListingIds}
          selectedStore={selectedStore}
          stores={stores}
          unified_field_dictionary={unified_field_dictionary}
        />
      )}

      {actionCampaign && actionMode && (
        <PromotionActionPanel
          actionCampaign={actionCampaign}
          actionMode={actionMode}
          candidateListings={candidateListings}
          form={form}
          onAddItems={handleAddItemsToCampaign}
          onClose={() => { setActionMode(null); setActionCampaign(null); setSelectedListingIds([]); setForm(EMPTY_CREATE_FORM) }}
          onDiscountSave={handleUpdateCampaignDiscount}
          onFormChange={setForm}
          onListingToggle={toggleListing}
          onUpdate={handleUpdateCampaign}
          saving={saving}
          selectedListingIds={selectedListingIds}
          selectedStore={selectedStore}
          unified_field_dictionary={unified_field_dictionary}
        />
      )}

      <PromotionCampaignTable
        campaigns={items}
        saving={saving}
        unified_field_dictionary={unified_field_dictionary}
        onEndCampaign={handleEndCampaign}
        onStartAction={startCampaignAction}
        onSyncCampaign={handleSyncCampaign}
      />
    </div>
  )
}
