const PROMOTION_RULE_GAPS = [
  {
    type: 'discount',
    label: '折扣活动',
    fields: ['折扣比例', '活动库存', '活动时间', '参与 Listing'],
    next: '可先本地保存，平台同步需促销折扣 Open API。',
  },
  {
    type: 'coupon',
    label: '优惠券',
    fields: ['券门槛', '券面额', '发放数量', '可叠加规则'],
    next: '需补券门槛、预算和平台券状态回执。',
  },
  {
    type: 'flash_sale',
    label: '秒杀活动',
    fields: ['秒杀库存', '秒杀价', '活动时段', '限购数量'],
    next: '需补秒杀时段、库存锁定和平台报名回执。',
  },
  {
    type: 'affiliate',
    label: '联盟活动',
    fields: ['佣金比例', '达人范围', '结算周期', '推广素材'],
    next: '需补联盟佣金、达人/机构范围和费用回写。',
  },
]

export function PromotionTypeRuleGuide() {
  return (
    <section data-ui="promotion-type-rule-gap-guide" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-primary)]">平台营销规则字段缺口</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">活动类型不是平台生效结果</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            当前先管理本地促销活动对象；不同平台的优惠券、秒杀、联盟字段和回执接通前，只显示待配置和待同步。
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-warning)] px-3 py-1 text-xs text-[var(--color-warning)]">待平台规则字段</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {PROMOTION_RULE_GAPS.map(item => (
          <div key={item.type} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="font-semibold text-[var(--color-fg)]">{item.label}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.fields.map(field => <span key={field} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{field}</span>)}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">{item.next}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
