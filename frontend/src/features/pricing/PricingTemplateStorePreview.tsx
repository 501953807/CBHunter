import { Calculator, Store, Tag } from 'lucide-react'
import type { FeeRateItem, PricingAdjustmentTemplateItem } from '../../api/settings'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../../api/pricing'

type Props = {
  item?: PricingWorkbenchItem
  storeId: string
  feeTemplate?: FeeRateItem
  adjustmentTemplate?: PricingAdjustmentTemplateItem
  result?: PriceRecommendationData | null
  shippingCost: string
  activityDiscount: string
  minProfit: string
  targetProfit: string
}

export function PricingTemplateStorePreview({
  item,
  storeId,
  feeTemplate,
  adjustmentTemplate,
  result,
  shippingCost,
  activityDiscount,
  minProfit,
  targetProfit,
}: Props) {
  const selectedStore = item?.store_options.find(store => store.id === storeId)
  const balanced = result?.status === 'ready' ? result.recommendations.balanced : null
  const feePct = result?.estimated_fee_pct ?? feeRatePercent(feeTemplate)
  const effectivePrice = balanced?.effective_selling_price_rmb ?? balanced?.selling_price ?? null
  const platformFee = effectivePrice != null && feePct != null ? effectivePrice * feePct / 100 : null
  const currency = result?.currency || balanced?.currency || '待计算'
  const exchangeRate = result?.exchange_rate ?? null
  const rows = [
    { label: '采购价', value: item ? `¥${item.source_price_rmb}` : '待选择商品' },
    { label: '物流费', value: valueOrDash(shippingCost, '¥') },
    { label: '活动折扣', value: valueOrDash(activityDiscount, '', '%') },
    { label: '目标利润率', value: valueOrDash(targetProfit, '', '%') },
    { label: '最低利润额', value: valueOrDash(minProfit, '¥') },
    { label: '本地币种', value: currency },
    { label: '汇率口径', value: exchangeRate == null ? '待计算/待配置' : `1 RMB = ${exchangeRate} ${currency}` },
    { label: '平台综合费率', value: feePct == null ? '待配置' : `${feePct.toFixed(1)}%` },
    { label: '预估平台费', value: platformFee == null ? '待计算' : `¥${platformFee.toFixed(2)}` },
    { label: '平衡档人民币售价', value: balanced?.selling_price == null ? '待计算' : `¥${balanced.selling_price}` },
    { label: '平衡档店铺售价', value: balanced?.selling_price_local == null ? '待计算' : `${balanced.currency || ''} ${balanced.selling_price_local}` },
  ]

  return (
    <section
      aria-label="定价模板店铺售价覆盖预览"
      data-ui="pricing-template-store-override-preview"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">模板定价与店铺覆盖预览</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            将平台费率、物流、活动折扣、利润底线合并为当前店铺 Listing 售价草稿。
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
          CORE-V5 定价模板
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex items-center gap-2 text-[var(--color-fg)]">
            <Store className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="font-semibold">目标店铺</span>
          </div>
          <p className="mt-1 text-[var(--color-muted)]">
            {selectedStore ? `${selectedStore.platform} · ${selectedStore.account_name}${selectedStore.shop_id ? ` · ${selectedStore.shop_id}` : ''}` : '请选择商品和店铺'}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {item?.listing_store_override?.store_label ? `内容工厂覆盖店铺：${item.listing_store_override.store_label}` : '未检测到内容工厂店铺覆盖时，使用当前选择店铺。'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {rows.map(row => (
            <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <p className="text-[var(--color-muted)]">{row.label}</p>
              <p className="mt-1 font-semibold text-[var(--color-fg)]">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex items-center gap-2 text-[var(--color-fg)]">
            <Tag className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="font-semibold">模板与汇率来源</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TemplateSource label="平台费率模板" value={feeTemplate ? `${feeTemplate.platform}/${feeTemplate.market}` : '待配置'} />
            <TemplateSource label="定价附加模板" value={adjustmentTemplate?.label || '使用当前手工参数'} />
            <TemplateSource label="汇率来源" value={exchangeRate == null ? '设置中心汇率未完成或尚未计算' : `${result?.market || item?.market || '目标市场'} · ${currency}`} />
            <TemplateSource label="换算边界" value="人民币售价用于本地草稿，店铺售价按目标市场币种显示" />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3 text-[11px] leading-5 text-[var(--color-primary)]">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Calculator className="h-4 w-4" />
            <span>写入边界</span>
          </div>
          确认价格时只创建或更新当前商品、当前店铺的本地 Listing 价格草稿；不会改动其他平台/店铺同源商品，也不会声明平台实际发布成功。
        </div>
      </div>
    </section>
  )
}

function TemplateSource({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function valueOrDash(value: string, prefix = '', suffix = '') {
  const trimmed = value.trim()
  return trimmed ? `${prefix}${trimmed}${suffix}` : '未设置'
}

function feeRatePercent(template?: FeeRateItem) {
  if (!template?.total && template?.total !== 0) return null
  return Number(template.total) * 100
}
