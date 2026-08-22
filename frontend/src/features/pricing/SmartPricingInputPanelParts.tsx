import { Card, CardContent } from '../../components/ui/Card'
import { PricingItemSelector } from './PricingItemSelector'
import type { PricingWorkbenchItem } from '../../api/pricing'
import type { PricingAdjustmentTemplateItem } from '../../api/settings'

type OptionItem = { id: string; label: string; flag?: string }

export function PricingInputPanel({
  workbenchLoading,
  workbenchError,
  onReloadWorkbench,
  initialProductId,
  initialTargetPlatform,
  initialTargetStore,
  initialTargetMarket,
  pricingItems,
  selectedItemId,
  selectedStoreId,
  onSelectItem,
  onSelectStore,
  sourcePrice,
  platform,
  market,
  targetProfit,
  targetProfitSliderValue,
  pricingMode,
  shippingCost,
  activityDiscount,
  minProfit,
  selectedPricingTemplateId,
  pricingPlatforms,
  markets,
  matchingPricingTemplates,
  savingTemplate,
  loading,
  onChangeSourcePrice,
  onChangePlatform,
  onChangeMarket,
  onChangePricingMode,
  onChangeTargetProfit,
  onApplyPricingTemplate,
  onSavePricingTemplate,
  onChangeShippingCost,
  onChangeActivityDiscount,
  onChangeMinProfit,
  onRecommend,
}: {
  workbenchLoading: boolean
  workbenchError: boolean
  onReloadWorkbench: () => void
  initialProductId: string
  initialTargetPlatform: string
  initialTargetStore: string
  initialTargetMarket: string
  pricingItems: PricingWorkbenchItem[]
  selectedItemId: string
  selectedStoreId: string
  onSelectItem: (itemId: string) => void
  onSelectStore: (storeId: string) => void
  sourcePrice: string
  platform: string
  market: string
  targetProfit: string
  targetProfitSliderValue: number
  pricingMode: 'cost_based' | 'selling_based' | ''
  shippingCost: string
  activityDiscount: string
  minProfit: string
  selectedPricingTemplateId: string
  pricingPlatforms: OptionItem[]
  markets: OptionItem[]
  matchingPricingTemplates: PricingAdjustmentTemplateItem[]
  savingTemplate: boolean
  loading: boolean
  onChangeSourcePrice: (value: string) => void
  onChangePlatform: (value: string) => void
  onChangeMarket: (value: string) => void
  onChangePricingMode: (value: 'cost_based' | 'selling_based') => void
  onChangeTargetProfit: (value: string) => void
  onApplyPricingTemplate: (templateId: string) => void
  onSavePricingTemplate: () => void
  onChangeShippingCost: (value: string) => void
  onChangeActivityDiscount: (value: string) => void
  onChangeMinProfit: (value: string) => void
  onRecommend: () => void
}) {
  return (
    <Card className="pricing-panel">
      <CardContent className="space-y-4 pt-4">
        {workbenchError && (
          <div data-ui="pricing-workbench-error" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs">
            <span className="text-[var(--color-danger)]">定价商品队列加载失败，请检查后端服务或当前登录权限。</span>
            <button type="button" onClick={onReloadWorkbench} className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]">
              重新加载定价队列
            </button>
          </div>
        )}
        {workbenchLoading && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            正在加载定价商品队列...
          </div>
        )}
        {(initialProductId || initialTargetPlatform || initialTargetStore || initialTargetMarket) && (
          <div data-ui="pricing-content-context-handoff" className="pricing-context-chip flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-xs" aria-label="内容工厂带入的定价上下文">
            <span className="font-semibold text-[var(--color-fg)]">内容工厂带入</span>
            {initialProductId && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">商品 {initialProductId}</span>}
            {initialTargetPlatform && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">平台 {initialTargetPlatform}</span>}
            {initialTargetStore && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">店铺 {initialTargetStore}</span>}
            {initialTargetMarket && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">市场 {initialTargetMarket}</span>}
          </div>
        )}
        <PricingItemSelector items={pricingItems} selectedItemId={selectedItemId} selectedStoreId={selectedStoreId} onSelectItem={onSelectItem} onSelectStore={onSelectStore} />
        <div className="pricing-form-grid">
          <FormNumberField label="采购价 (RMB)" value={sourcePrice} onChange={onChangeSourcePrice} placeholder="请输入真实采购价" emphasized />
          <SelectField label="平台" value={platform} onChange={onChangePlatform} options={pricingPlatforms} />
          <SelectField label="市场" value={market} onChange={onChangeMarket} options={markets} />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--color-fg)' }}>
            <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => onChangePricingMode('cost_based')} />
            成本利润率
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--color-fg)' }}>
            <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => onChangePricingMode('selling_based')} />
            售价利润率
          </label>
        </div>
        <ProfitSlider pricingMode={pricingMode} targetProfit={targetProfit} targetProfitSliderValue={targetProfitSliderValue} onChangeTargetProfit={onChangeTargetProfit} />
        <PricingAdjustmentTemplateInputs
          selectedPricingTemplateId={selectedPricingTemplateId}
          matchingPricingTemplates={matchingPricingTemplates}
          platform={platform}
          market={market}
          savingTemplate={savingTemplate}
          shippingCost={shippingCost}
          activityDiscount={activityDiscount}
          minProfit={minProfit}
          onApplyPricingTemplate={onApplyPricingTemplate}
          onSavePricingTemplate={onSavePricingTemplate}
          onChangeShippingCost={onChangeShippingCost}
          onChangeActivityDiscount={onChangeActivityDiscount}
          onChangeMinProfit={onChangeMinProfit}
        />
        <button
          onClick={onRecommend}
          disabled={loading || !platform || !market || !sourcePrice || !targetProfit || !pricingMode}
          className="w-full rounded-full py-2.5 font-medium text-[var(--color-primary-text)] transition-colors disabled:opacity-40"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {loading ? '计算中...' : '计算推荐售价'}
        </button>
      </CardContent>
    </Card>
  )
}

function FormNumberField({ label, value, onChange, placeholder, emphasized = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  emphasized?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={emphasized ? 'w-full rounded-lg px-3 py-2 text-lg font-bold outline-none' : 'w-full rounded-lg px-3 py-2 text-sm outline-none'}
        style={{ background: emphasized ? 'var(--color-bg)' : 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: OptionItem[]
}) {
  return (
    <div>
      <label className="mb-1 block text-xs" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg px-3 py-2 outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
        {options.map(option => <option key={option.id} value={option.id}>{option.flag ? `${option.flag} ` : ''}{option.label}</option>)}
      </select>
    </div>
  )
}

function ProfitSlider({
  pricingMode,
  targetProfit,
  targetProfitSliderValue,
  onChangeTargetProfit,
}: {
  pricingMode: 'cost_based' | 'selling_based' | ''
  targetProfit: string
  targetProfitSliderValue: number
  onChangeTargetProfit: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {pricingMode === 'cost_based' ? '目标成本利润率' : pricingMode === 'selling_based' ? '目标售价净利率' : '目标利润率'}
        </label>
        <span className="text-xs font-medium text-[var(--color-primary)]">{targetProfit || targetProfitSliderValue}%</span>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" data-ui="pricing-profit-slider">
        <input aria-label="目标利润率滑块" type="range" min="0.1" max="60" step="0.1" value={targetProfitSliderValue} onChange={event => onChangeTargetProfit(event.target.value)} className="w-full accent-[var(--color-primary)]" />
        <div className="mt-2 flex items-center gap-3">
          <input
            type="number"
            min="0.1"
            max="60"
            step="0.1"
            value={targetProfit}
            onChange={event => onChangeTargetProfit(event.target.value)}
            placeholder="请输入目标利润率"
            className="w-32 rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
          />
          <p className="text-xs text-[var(--color-muted)]">拖动滑块快速调整利润率，精确数值可在输入框修正。</p>
        </div>
      </div>
    </div>
  )
}

function PricingAdjustmentTemplateInputs({
  selectedPricingTemplateId,
  matchingPricingTemplates,
  platform,
  market,
  savingTemplate,
  shippingCost,
  activityDiscount,
  minProfit,
  onApplyPricingTemplate,
  onSavePricingTemplate,
  onChangeShippingCost,
  onChangeActivityDiscount,
  onChangeMinProfit,
}: {
  selectedPricingTemplateId: string
  matchingPricingTemplates: PricingAdjustmentTemplateItem[]
  platform: string
  market: string
  savingTemplate: boolean
  shippingCost: string
  activityDiscount: string
  minProfit: string
  onApplyPricingTemplate: (templateId: string) => void
  onSavePricingTemplate: () => void
  onChangeShippingCost: (value: string) => void
  onChangeActivityDiscount: (value: string) => void
  onChangeMinProfit: (value: string) => void
}) {
  return (
    <div data-ui="pricing-adjustment-template-inputs" className="pricing-form-panel pricing-form-grid rounded-[var(--radius-xl)] p-3">
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">定价附加模板</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">复用当前平台/市场的物流费、活动折扣和最低利润底线。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedPricingTemplateId} onChange={event => onApplyPricingTemplate(event.target.value)} className="min-w-56 rounded-lg px-3 py-2 text-xs outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
            <option value="">{matchingPricingTemplates.length ? '选择定价模板' : '当前平台/市场暂无模板'}</option>
            {matchingPricingTemplates.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}
          </select>
          <button type="button" onClick={onSavePricingTemplate} disabled={!platform || !market || savingTemplate} className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-40">
            {savingTemplate ? '保存中...' : '保存当前为模板'}
          </button>
        </div>
      </div>
      <FormNumberField label="物流费 (RMB)" value={shippingCost} onChange={onChangeShippingCost} placeholder="如 4.00" />
      <FormNumberField label="活动折扣 (%)" value={activityDiscount} onChange={onChangeActivityDiscount} placeholder="如 10" />
      <FormNumberField label="最低利润额 (RMB)" value={minProfit} onChange={onChangeMinProfit} placeholder="如 12.00" />
      <p className="col-span-full text-[11px] leading-5 text-[var(--color-muted)]">
        物流费计入总成本；活动折扣按成交后实收折算；最低利润额用于防止活动价或平台费压穿利润底线。
      </p>
    </div>
  )
}
