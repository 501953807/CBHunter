import { CalendarDays } from 'lucide-react'
import type { PromotionCampaign } from '../../api/promotions'
import type { UnifiedFieldDictionary } from '../../api/config'
import type { PlatformStoreProduct } from '../../api/products'
import { Badge } from '../../components/ui/Badge'
import { productImageSrc } from '../../utils/productImages'
import { formatPromotionMoney, marketingRulesSummary, promotionTypeLabel } from './PromotionPageModel'
import { marketingWatermarkSummary } from './PromotionWatermarkUtils'
import { promotionPlatformSyncSummary } from './PromotionSyncUtils'

export function PromotionEffectSummary({ campaign }: { campaign: PromotionCampaign }) {
  const summary = campaign.price_summary
  if (!summary || summary.priced_item_count === 0) {
    return (
      <div aria-label="活动效果" className="text-xs text-[var(--color-muted)]">
        <p>待补促销价</p>
        <p className="mt-1">未生成成交效果，不用假数据填充。</p>
      </div>
    )
  }
  return (
    <div aria-label="活动效果" className="space-y-1 text-xs">
      <p className="font-medium text-[var(--color-fg)]">预计让利 {formatPromotionMoney(summary.discount_amount_total)}</p>
      <p className="text-[var(--color-muted)]">原价 {formatPromotionMoney(summary.original_price_total)} → 促销 {formatPromotionMoney(summary.promotion_price_total)}</p>
      <p className="text-[var(--color-muted)]">平均折扣 {summary.avg_discount_pct == null ? '待计算' : `${summary.avg_discount_pct.toFixed(2)}%`} · {summary.priced_item_count} 个商品有价格</p>
      <p className="text-[11px] text-[var(--color-muted)]">{summary.note}</p>
    </div>
  )
}

export function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[var(--color-fg)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="promotions-field-input"
      />
    </label>
  )
}

export function PromotionCandidateCard({
  item,
  selected,
  unified_field_dictionary,
  onToggle,
}: {
  item: PlatformStoreProduct
  selected: boolean
  unified_field_dictionary?: UnifiedFieldDictionary
  onToggle: () => void
}) {
  const fieldRows = promotionListingFieldRows([
    ['product_title', item.title],
    ['platform_product_id', item.platform_product_id],
    ['sku_id', item.product_master?.sku],
    ['sku_stock', item.stock],
    ['sku_price', item.price],
  ], item.platform || item.store.platform, unified_field_dictionary)
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`promotions-candidate-card ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
    >
      <div className="flex gap-3">
        {item.images?.[0] ? <img src={productImageSrc(item.images[0])} alt="参与促销商品图" className="h-14 w-14 rounded-lg object-cover bg-[var(--color-bg)]" /> : <div className="h-14 w-14 rounded-lg bg-[var(--color-bg)]" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-[var(--color-fg)]">{item.title}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{item.store.account_name} · 库存 {item.stock} · 售价 {item.price.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">平台商品ID：{item.platform_product_id || '本地草稿'}</p>
          <PromotionFieldChips rows={fieldRows} />
        </div>
        <span className="text-xs font-semibold text-[var(--color-primary)]">{selected ? '已选' : '选择'}</span>
      </div>
    </button>
  )
}

export function PromotionListingFieldDictionary({
  campaign,
  unified_field_dictionary,
}: {
  campaign: PromotionCampaign
  unified_field_dictionary?: UnifiedFieldDictionary
}) {
  const rows = campaign.items.slice(0, 2).flatMap(item =>
    promotionListingFieldRows([
      ['product_title', item.listing_title || item.product_name],
      ['sku_id', item.sku],
      ['sku_stock', item.stock_limit],
      ['sku_price', item.original_price],
      ['promotion_price', item.promotion_price],
    ], campaign.platform, unified_field_dictionary).map(row => ({ ...row, productName: item.product_name || item.listing_title })),
  )
  if (!rows.length) return null
  return (
    <div data-ui="promotion-v5-listing-field-dictionary" className="mt-2 space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <p className="text-[11px] font-medium text-[var(--color-fg)]">促销商品字段字典</p>
      {rows.slice(0, 6).map(row => (
        <p key={`${row.productName}-${row.key}-${row.value}`} className="text-[11px] text-[var(--color-muted)]">
          <span className="text-[var(--color-fg)]">{row.label}</span> · {row.platformField}：{row.value}
        </p>
      ))}
    </div>
  )
}

export function PromotionCampaignTable({
  campaigns,
  saving,
  unified_field_dictionary,
  onEndCampaign,
  onStartAction,
  onSyncCampaign,
}: {
  campaigns: PromotionCampaign[]
  saving: boolean
  unified_field_dictionary?: UnifiedFieldDictionary
  onEndCampaign: (campaignId: string) => void
  onStartAction: (campaign: PromotionCampaign, mode: 'edit' | 'add-items' | 'discount') => void
  onSyncCampaign: (campaignId: string) => void
}) {
  return (
    <section className="promotions-table-panel">
      <div className="promotions-section-heading mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">活动列表</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">集中维护本地促销活动、参与商品、活动价格、营销水印和平台同步边界。</p>
        </div>
        <span className="promotions-count-pill">活动 {campaigns.length} 个</span>
      </div>
      {campaigns.length === 0 ? (
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
              {campaigns.map((item) => (
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
                    <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                      <CalendarDays className="h-3.5 w-3.5" />{item.starts_at || '开始待定'} - {item.ends_at || '结束待定'}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => onStartAction(item, 'edit')}>修改活动</button>
                      <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => onStartAction(item, 'add-items')}>添加产品</button>
                      <button type="button" className="promotions-row-action text-[var(--color-primary)]" onClick={() => onStartAction(item, 'discount')}>修改折扣</button>
                      <button type="button" className="promotions-row-action text-[var(--color-danger)] disabled:text-[var(--color-muted)]" disabled={saving || item.status === 'ended'} onClick={() => onEndCampaign(item.id)}>结束活动</button>
                      <button type="button" className="promotions-row-action text-[var(--color-muted)]" disabled={saving} onClick={() => onSyncCampaign(item.id)}>同步</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type PromotionV5FieldRow = {
  key: string
  label: string
  platformField: string
  value: string
}

function PromotionFieldChips({ rows }: { rows: PromotionV5FieldRow[] }) {
  if (!rows.length) return null
  return (
    <div data-ui="promotion-v5-candidate-field-dictionary" className="mt-2 flex flex-wrap gap-1">
      {rows.slice(0, 3).map(row => (
        <span key={`${row.key}-${row.value}`} className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {row.label} · {row.value}
        </span>
      ))}
    </div>
  )
}

function promotionListingFieldRows(
  values: Array<[string, string | number | null | undefined]>,
  platform: string,
  unified_field_dictionary?: UnifiedFieldDictionary,
): PromotionV5FieldRow[] {
  return values
    .map(([key, value]) => {
      const field = unified_field_dictionary?.fields.find(item => item.key === key)
      const platformKey = normalizePromotionPlatformKey(platform)
      const platformField = field?.platforms?.[platformKey]?.field || field?.platforms?.miaoshou?.field || '平台字段待映射'
      return {
        key,
        label: field?.label || promotionFallbackLabel(key),
        platformField: `${platform || '平台待识别'} 字段：${platformField}`,
        value: value == null || value === '' ? '' : String(value),
      }
    })
    .filter(row => row.value)
}

function promotionFallbackLabel(key: string) {
  const labels: Record<string, string> = {
    product_title: '商品标题',
    platform_product_id: '平台商品 ID',
    sku_id: 'SKU',
    sku_stock: '库存',
    sku_price: '售价',
    promotion_price: '促销价',
  }
  return labels[key] || key
}

function normalizePromotionPlatformKey(platform: string) {
  const value = platform.toLowerCase()
  if (value.includes('tiktok')) return 'tiktok'
  if (value.includes('temu')) return 'temu'
  if (value.includes('shopee')) return 'shopee'
  return value
}
