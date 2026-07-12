export interface BusinessAction {
  label: string
  route: string
}

const BUSINESS_CODE_LABELS: Record<string, string> = {
  trend_keywords: '趋势关键词',
  sourcing_items: '品源与货源',
  'sourcing_items.source_price_rmb': '采购价',
  competitor_or_competition_level: '竞品与竞争度',
  competitor_products: '竞品记录',
  'competitor_products.delisted_status': '竞品下架状态',
  finance_ledger_entries: '财务台账',
  'finance_ledger_entries.cash_balance': '可用资金余额',
  'finance_ledger_entries.revenue': '销售收入台账',
  'finance_ledger_entries.cost': '成本台账',
  sales_income: '销售收入',
  revenue: '销售收入',
  purchase_cost: '采购成本',
  platform_fee: '平台费用',
  logistics_cost: '物流成本',
  advertising_cost: '广告费用',
  cash_balance: '可用资金余额',
  fee_templates: '平台费率模板',
  'fee_templates.market': '市场费率模板',
  'fee_templates.commission_pct': '平台佣金',
  'fee_templates.transaction_fee_pct': '交易费率',
  'fee_templates.tech_service_pct': '技术服务费率',
  exchange_rates: '汇率配置',
  'markets.currency': '市场币种',
  platform_accounts: '平台店铺账号',
  platform_open_api: '平台 Open API 授权',
  platform_credentials: '平台凭证',
  orders: '订单数据',
  order_items: '订单明细',
  inventory: '库存数据',
  listing_templates: '刊登模板',
  operation_records: '运营记录',
  operation_tasks: '运营任务',
  action_results: '执行结果',
  operating_cockpit: '经营指挥台数据',
  'dict.carriers': '承运商字典',
  'dict.shipping_methods': '物流方式字典',
  system_config: '系统配置',
  'system_config.ai': 'AI 服务配置',
  'system_config.payment': '支付配置',
  'system_config.payment.wechat': '微信支付配置',
  'system_config.payment.alipay': '支付宝配置',
}

const BUSINESS_CODE_ACTIONS: Record<string, BusinessAction> = {
  trend_keywords: { label: '采集趋势关键词', route: '/trends' },
  sourcing_items: { label: '补充品源与成本', route: '/scout/sources' },
  competitor_or_competition_level: { label: '补充竞品与竞争度', route: '/monitor' },
  competitor_products: { label: '维护竞品记录', route: '/monitor' },
  finance_ledger_entries: { label: '维护财务台账', route: '/finance' },
  sales_income: { label: '补录销售收入', route: '/finance?entry_type=sales_income' },
  revenue: { label: '补录销售收入', route: '/finance?entry_type=sales_income' },
  purchase_cost: { label: '补录采购成本', route: '/finance?entry_type=purchase_cost' },
  platform_fee: { label: '配置平台费率', route: '/settings/fees' },
  logistics_cost: { label: '补录物流成本', route: '/finance?entry_type=logistics_cost' },
  advertising_cost: { label: '补录广告费用', route: '/finance?entry_type=advertising_cost' },
  cash_balance: { label: '录入可用资金', route: '/finance?entry_type=cash_balance' },
  fee_templates: { label: '配置平台费率', route: '/settings/fees' },
  exchange_rates: { label: '维护汇率配置', route: '/settings/fees' },
  platform_accounts: { label: '配置平台店铺', route: '/platforms' },
  platform_open_api: { label: '配置平台授权', route: '/platforms' },
  platform_credentials: { label: '配置平台凭证', route: '/platforms' },
  orders: { label: '同步或创建订单', route: '/orders' },
  order_items: { label: '补齐订单明细', route: '/orders' },
  inventory: { label: '维护库存数据', route: '/inventory-alerts' },
  listing_templates: { label: '维护刊登模板', route: '/publish/templates' },
  operation_records: { label: '记录运营动作', route: '/operations' },
  operation_tasks: { label: '维护运营任务', route: '/operations' },
  action_results: { label: '复盘执行结果', route: '/operations' },
  operating_cockpit: { label: '查看经营指挥台', route: '/command-center' },
  'dict.carriers': { label: '维护承运商字典', route: '/settings/dict' },
  'dict.shipping_methods': { label: '维护物流方式', route: '/settings/dict' },
  system_config: { label: '查看配置巡检', route: '/settings/quality' },
}

export function labelBusinessCode(code: string): string {
  if (!code) return '待补数据'
  if (BUSINESS_CODE_LABELS[code]) return BUSINESS_CODE_LABELS[code]
  const matchedKey = Object.keys(BUSINESS_CODE_LABELS)
    .filter((key) => code.startsWith(`${key}.`))
    .sort((a, b) => b.length - a.length)[0]
  return matchedKey ? BUSINESS_CODE_LABELS[matchedKey] : code.replaceAll('_', ' ')
}

export function businessActionForCode(code: string): BusinessAction {
  if (BUSINESS_CODE_ACTIONS[code]) return BUSINESS_CODE_ACTIONS[code]
  const matchedKey = Object.keys(BUSINESS_CODE_ACTIONS)
    .filter((key) => code.startsWith(`${key}.`))
    .sort((a, b) => b.length - a.length)[0]
  return matchedKey ? BUSINESS_CODE_ACTIONS[matchedKey] : { label: '查看配置巡检', route: '/settings/quality' }
}

export function uniqueBusinessActions(codes: string[], fallback?: BusinessAction): BusinessAction[] {
  const seen = new Set<string>()
  const actions = codes.map(businessActionForCode).filter((action) => {
    const key = `${action.route}-${action.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return actions.length > 0 ? actions : fallback ? [fallback] : []
}
