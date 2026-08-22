import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import type { PlatformStoreProduct } from '../../api/products'
import type { PromotionCampaign } from '../../api/promotions'
import type { UnifiedFieldDictionary } from '../../api/config'
import type { PlatformAccount } from '../../types/common'
import { EMPTY_CREATE_FORM, PROMOTION_TYPE_OPTIONS, type PromotionCreateFormState } from './PromotionPageModel'
import { PromotionWatermarkSelector } from './PromotionWatermarkSelector'
import { Field, PromotionCandidateCard } from './PromotionPageParts'

export type PromotionActionMode = 'edit' | 'add-items' | 'discount'

type PromotionStoreContext = Pick<PlatformAccount, 'id' | 'platform' | 'account_name'> | {
  id: string
  platform: string
  account_name: string
  market?: string | null
}

export function PromotionCreatePanel({
  candidateListings,
  form,
  onCreate,
  onFormChange,
  onListingToggle,
  onStoreChange,
  onToggleCreate,
  saving,
  selectedListingIds,
  selectedStore,
  stores,
  unified_field_dictionary,
}: {
  candidateListings: PlatformStoreProduct[]
  form: PromotionCreateFormState
  onCreate: () => void
  onFormChange: (form: PromotionCreateFormState) => void
  onListingToggle: (listingId: string) => void
  onStoreChange: (platformAccountId: string) => void
  onToggleCreate: (visible: boolean) => void
  saving: boolean
  selectedListingIds: string[]
  selectedStore: PromotionStoreContext | null
  stores: PlatformAccount[]
  unified_field_dictionary?: UnifiedFieldDictionary
}) {
  return (
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
        <Field label="活动名称" value={form.name} onChange={(value) => onFormChange({ ...form, name: value })} placeholder="如：7月新品测品折扣" />
        <Select label="活动类型" value={form.promotionType} onChange={(promotionType) => onFormChange({ ...form, promotionType })} options={PROMOTION_TYPE_OPTIONS} />
        <Select
          label="所属店铺"
          value={form.platformAccountId}
          onChange={onStoreChange}
          options={[{ value: '', label: '请选择店铺' }, ...stores.map((store) => ({ value: store.id, label: `${store.account_name} · ${store.platform}` }))]}
        />
        <Field label="活动折扣比例(%)" value={form.discountValue} onChange={(value) => onFormChange({ ...form, discountValue: value })} placeholder="如：10" type="number" />
        <Field label="券门槛/预算" value={form.ruleThreshold} onChange={(value) => onFormChange({ ...form, ruleThreshold: value })} placeholder="如满99可用 / 预算500" />
        <Field label="限购/秒杀库存" value={form.ruleLimit} onChange={(value) => onFormChange({ ...form, ruleLimit: value })} placeholder="如每人1件 / 秒杀50件" />
        <Field label="联盟佣金(%)" value={form.ruleCommission} onChange={(value) => onFormChange({ ...form, ruleCommission: value })} placeholder="联盟活动填写" type="number" />
        <Field label="开始时间" value={form.startsAt} onChange={(value) => onFormChange({ ...form, startsAt: value })} placeholder="2026-07-15T00:00:00+08:00" />
        <Field label="结束时间" value={form.endsAt} onChange={(value) => onFormChange({ ...form, endsAt: value })} placeholder="2026-07-22T23:59:59+08:00" />
        <Field label="单品活动库存上限" value={form.stockLimit} onChange={(value) => onFormChange({ ...form, stockLimit: value })} placeholder="不填则不限制" type="number" />
      </div>
      <div className="promotions-sub-panel mt-4">
        <PromotionWatermarkSelector
          platform={selectedStore?.platform}
          value={{ templateId: form.watermarkTemplateId, scope: form.watermarkScope }}
          onChange={(value) => onFormChange({ ...form, watermarkTemplateId: value.templateId, watermarkScope: value.scope })}
        />
      </div>
      <PromotionListingPicker
        candidateListings={candidateListings}
        form={form}
        onFormChange={onFormChange}
        onListingToggle={onListingToggle}
        selectedListingIds={selectedListingIds}
        selectedStore={selectedStore}
        unified_field_dictionary={unified_field_dictionary}
        requireStore
      />
      <div className="promotions-form-actions mt-4">
        <Button variant="secondary" onClick={() => onToggleCreate(false)} disabled={saving}>取消</Button>
        <Button onClick={onCreate} disabled={saving}>{saving ? '保存中...' : '保存促销活动'}</Button>
      </div>
    </section>
  )
}

export function PromotionActionPanel({
  actionCampaign,
  actionMode,
  candidateListings,
  form,
  onAddItems,
  onClose,
  onDiscountSave,
  onFormChange,
  onListingToggle,
  onUpdate,
  saving,
  selectedListingIds,
  selectedStore,
  unified_field_dictionary,
}: {
  actionCampaign: PromotionCampaign
  actionMode: PromotionActionMode
  candidateListings: PlatformStoreProduct[]
  form: PromotionCreateFormState
  onAddItems: () => void
  onClose: () => void
  onDiscountSave: () => void
  onFormChange: (form: PromotionCreateFormState) => void
  onListingToggle: (listingId: string) => void
  onUpdate: () => void
  saving: boolean
  selectedListingIds: string[]
  selectedStore: PromotionStoreContext | null
  unified_field_dictionary?: UnifiedFieldDictionary
}) {
  return (
    <section className="promotions-action-panel" aria-label="促销活动行内操作">
      <div className="promotions-section-heading mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">{actionMode === 'edit' ? '修改活动' : actionMode === 'add-items' ? '添加参与商品' : '修改活动折扣'}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            当前活动：{actionCampaign.name} · {actionCampaign.store.account_name}。操作只更新本地促销活动，不回写 Listing。
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>关闭</Button>
      </div>
      {actionMode === 'edit' ? (
        <>
          <div className="promotions-inline-form-grid">
            <Field label="活动名称" value={form.name} onChange={(value) => onFormChange({ ...form, name: value })} />
            <Select label="活动类型" value={form.promotionType} onChange={(promotionType) => onFormChange({ ...form, promotionType })} options={PROMOTION_TYPE_OPTIONS} />
            <Field label="券门槛/预算" value={form.ruleThreshold} onChange={(value) => onFormChange({ ...form, ruleThreshold: value })} placeholder="按平台规则待同步" />
            <Field label="限购/秒杀库存" value={form.ruleLimit} onChange={(value) => onFormChange({ ...form, ruleLimit: value })} placeholder="限购或锁库存" />
            <Field label="联盟佣金(%)" value={form.ruleCommission} onChange={(value) => onFormChange({ ...form, ruleCommission: value })} placeholder="联盟活动填写" type="number" />
            <Field label="开始时间" value={form.startsAt} onChange={(value) => onFormChange({ ...form, startsAt: value })} placeholder="2026-07-20T00:00:00+08:00" />
            <Field label="结束时间" value={form.endsAt} onChange={(value) => onFormChange({ ...form, endsAt: value })} placeholder="2026-07-25T23:59:59+08:00" />
            <Field label="叠加规则" value={form.stockLimit} onChange={(value) => onFormChange({ ...form, stockLimit: value })} placeholder="如 no_stack" />
            <Button onClick={onUpdate} disabled={saving}>{saving ? '保存中...' : '保存活动'}</Button>
          </div>
          <div className="promotions-sub-panel mt-3">
            <PromotionWatermarkSelector
              platform={actionCampaign.platform}
              value={{ templateId: form.watermarkTemplateId, scope: form.watermarkScope }}
              onChange={(value) => onFormChange({ ...form, watermarkTemplateId: value.templateId, watermarkScope: value.scope })}
            />
          </div>
        </>
      ) : actionMode === 'discount' ? (
        <div className="promotions-discount-grid">
          <Field label="新的活动折扣比例(%)" value={form.discountValue} onChange={(value) => onFormChange({ ...form, discountValue: value })} placeholder="如：15" type="number" />
          <Button onClick={onDiscountSave} disabled={saving}>{saving ? '保存中...' : '保存折扣'}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="promotions-add-items-grid">
            <Field label="搜索商品" value={form.productSearch} onChange={(value) => onFormChange({ ...form, productSearch: value })} placeholder="标题、平台商品ID、SKU" />
            <Field label="追加商品折扣比例(%)" value={form.discountValue} onChange={(value) => onFormChange({ ...form, discountValue: value })} placeholder="默认沿用活动折扣" type="number" />
            <Field label="单品库存上限" value={form.stockLimit} onChange={(value) => onFormChange({ ...form, stockLimit: value })} placeholder="不填则不限制" type="number" />
          </div>
          <PromotionListingPicker
            candidateListings={candidateListings}
            form={form}
            onFormChange={onFormChange}
            onListingToggle={onListingToggle}
            selectedListingIds={selectedListingIds}
            selectedStore={selectedStore}
            unified_field_dictionary={unified_field_dictionary}
          />
          <div className="flex justify-end">
            <Button onClick={onAddItems} disabled={saving}>{saving ? '保存中...' : '追加参与商品'}</Button>
          </div>
        </div>
      )}
    </section>
  )
}

function PromotionListingPicker({
  candidateListings,
  form,
  onFormChange,
  onListingToggle,
  requireStore = false,
  selectedListingIds,
  selectedStore,
  unified_field_dictionary,
}: {
  candidateListings: PlatformStoreProduct[]
  form: PromotionCreateFormState
  onFormChange: (form: PromotionCreateFormState) => void
  onListingToggle: (listingId: string) => void
  requireStore?: boolean
  selectedListingIds: string[]
  selectedStore: PromotionStoreContext | null
  unified_field_dictionary?: UnifiedFieldDictionary
}) {
  return (
    <div className="promotions-picker-panel mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">选择参与商品</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            当前店铺：{selectedStore ? `${selectedStore.account_name} · ${selectedStore.platform}` : '未选择'}；已选择 {selectedListingIds.length} 个 Listing。
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Field label="搜索商品" value={form.productSearch} onChange={(value) => onFormChange({ ...form, productSearch: value })} placeholder="标题、平台商品ID、SKU" />
        </div>
      </div>
      {requireStore && !form.platformAccountId ? (
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
              onToggle={() => onListingToggle(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function resetPromotionActionForm() {
  return EMPTY_CREATE_FORM
}
