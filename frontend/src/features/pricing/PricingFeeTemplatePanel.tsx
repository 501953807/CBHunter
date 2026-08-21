import type { FeeRateItem } from '../../api/settings'
import { percentLabel } from './PricingPageUtils'

export function PricingFeeTemplatePanel({
  template,
  platform,
  market,
  loading,
  onOpenSettings,
}: {
  template?: FeeRateItem
  platform: string
  market: string
  loading: boolean
  onOpenSettings: () => void
}) {
  const hasSelection = Boolean(platform && market)
  const rows = template
    ? [
      { label: '平台佣金', value: template.commission },
      { label: '交易/支付费', value: template.transaction },
      { label: '技术服务费', value: template.tech },
      { label: '税费/VAT', value: template.low_value_tax },
    ]
    : []
  return (
    <section
      aria-label="定价模板与费用口径"
      data-ui="pricing-fee-template-panel"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">定价模板 / 费用口径</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {hasSelection ? `${platform}/${market}` : '选择商品后自动匹配平台和市场'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
        >
          配置
        </button>
      </div>
      {loading ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
          正在读取费率模板...
        </p>
      ) : template ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg)] px-3 py-2 text-xs">
            <span className="text-[var(--color-muted)]">综合费率</span>
            <span className="font-semibold text-[var(--color-fg)]">{template.total_pct || percentLabel(template.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {rows.map(row => (
              <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px]">
                <p className="text-[var(--color-muted)]">{row.label}</p>
                <p className="font-medium text-[var(--color-fg)]">{percentLabel(row.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-muted)]">
            计算推荐售价时读取当前模板；平台真实账单同步后由财务护卫复核，不用前端估算冒充最终利润。
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl border border-dashed border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
            {hasSelection ? '当前平台/市场缺少费率模板，无法输出真实推荐售价。' : '请选择待定价商品以匹配费率模板。'}
          </p>
          {hasSelection && (
            <button type="button" onClick={onOpenSettings} className="text-xs text-[var(--color-primary)] hover:underline">
              前往设置中心维护费率与汇率
            </button>
          )}
        </div>
      )}
    </section>
  )
}
