export interface PromotionCreateFormState {
  name: string
  promotionType: string
  platformAccountId: string
  startsAt: string
  endsAt: string
  discountValue: string
  stockLimit: string
  productSearch: string
  ruleThreshold: string
  ruleLimit: string
  ruleCommission: string
  watermarkTemplateId: string
  watermarkScope: string
}

export const EMPTY_CREATE_FORM: PromotionCreateFormState = {
  name: '',
  promotionType: 'discount',
  platformAccountId: '',
  startsAt: '',
  endsAt: '',
  discountValue: '',
  stockLimit: '',
  productSearch: '',
  ruleThreshold: '',
  ruleLimit: '',
  ruleCommission: '',
  watermarkTemplateId: '',
  watermarkScope: 'first_main_image',
}

export const PROMOTION_TYPE_OPTIONS = [
  { value: 'discount', label: '折扣活动' },
  { value: 'coupon', label: '优惠券' },
  { value: 'flash_sale', label: '秒杀活动' },
  { value: 'affiliate', label: '联盟活动' },
]

export function formatPromotionMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function promotionTypeLabel(type: string) {
  return PROMOTION_TYPE_OPTIONS.find(option => option.value === type)?.label || type
}

export function buildMarketingRules(form: PromotionCreateFormState) {
  return {
    rule_schema: 'promotion_marketing_rules.v1',
    promotion_type: form.promotionType,
    threshold_or_budget: form.ruleThreshold.trim() || null,
    purchase_limit_or_flash_stock: form.ruleLimit.trim() || null,
    affiliate_commission_pct: form.ruleCommission.trim() ? Number(form.ruleCommission) : null,
    platform_sync_state: 'local_rules_not_synced',
  }
}

export function marketingRulesToForm(value: unknown): Partial<PromotionCreateFormState> {
  const rules = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    ruleThreshold: String(rules.threshold_or_budget || ''),
    ruleLimit: String(rules.purchase_limit_or_flash_stock || ''),
    ruleCommission: rules.affiliate_commission_pct == null ? '' : String(rules.affiliate_commission_pct),
  }
}

export function marketingRulesSummary(value: unknown) {
  const rules = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const parts = [
    rules.threshold_or_budget ? `门槛/预算：${rules.threshold_or_budget}` : '',
    rules.purchase_limit_or_flash_stock ? `限购/库存：${rules.purchase_limit_or_flash_stock}` : '',
    rules.affiliate_commission_pct ? `佣金：${rules.affiliate_commission_pct}%` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '平台规则字段待补'
}
