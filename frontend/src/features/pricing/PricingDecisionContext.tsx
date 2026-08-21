import { Card, CardContent } from '../../components/ui/Card'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../../api/pricing'

export function PricingDecisionContext({ result, item }: { result: PriceRecommendationData; item?: PricingWorkbenchItem }) {
  const balanced = result.recommendations.balanced
  const feePct = result.estimated_fee_pct ?? 0
  const sellingPrice = balanced?.selling_price ?? 0
  const effectiveSellingPrice = balanced?.effective_selling_price_rmb ?? sellingPrice
  const platformFee = effectiveSellingPrice * feePct / 100
  const totalCost = result.pricing_adjustments?.total_cost_rmb ?? result.source_price_rmb
  const netProfit = balanced?.net_profit_rmb ?? null
  const maxAbs = Math.max(totalCost, effectiveSellingPrice, platformFee, Math.abs(netProfit ?? 0), 1)
  const profitRows = [
    { label: '采购+物流总成本', value: totalCost, tone: 'var(--color-danger)' },
    { label: '折后实收价格', value: effectiveSellingPrice, tone: 'var(--color-success)' },
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
            以平衡档售价拆分采购成本、物流费、活动折扣、平台费和净利润，确认后写入本地 Listing 草稿，平台实际费用以账单同步为准。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
