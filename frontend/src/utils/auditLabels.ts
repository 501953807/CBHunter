import { labelBusinessCode } from './businessLabels'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  fetch: '抓取',
  run: '执行',
  decide: '选品决策',
  config_update: '配置更新',
  config_create: '配置新增',
  profile_update: '更新资料',
  password_change: '修改密码',
  platform_account_create: '新增平台店铺',
  platform_account_update: '更新平台店铺',
  platform_account_delete: '删除平台店铺',
  product_create: '新增商品',
  product_update: '更新商品',
  product_delete: '删除商品',
  product_export: '导出商品',
  product_import: '导入商品',
  order_create: '创建订单',
  order_update: '更新订单',
  shipment_create: '创建物流单',
  shipment_update: '更新物流单',
  warehouse_create: '新增仓储配置',
  warehouse_update: '更新仓储配置',
  warehouse_delete: '删除仓储配置',
  fee_rate_update: '更新费率',
  exchange_rate_refresh: '刷新汇率',
  exchange_rate_refresh_blocked: '阻断汇率刷新',
  notification_mark_read: '标记通知已读',
  finance_ledger_create: '创建财务台账',
  finance_ledger_update: '更新财务台账',
  finance_ledger_delete: '删除财务台账',
  ai_suggestion_run: '运行 AI 建议',
  ai_suggestion_accept: '采纳 AI 建议',
  ai_suggestion_ignore: '忽略 AI 建议',
  task_run: '执行系统任务',
  task_update: '更新系统任务',
  user_role_update: '更新用户角色',
  user_store_access_update: '更新店铺授权',
}

export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  system_config: '系统配置',
  user: '用户',
  platform_account: '平台店铺',
  product: '商品',
  order: '订单',
  shipment: '物流单',
  warehouse: '仓储配置',
  fee_template: '费率模板',
  exchange_rate: '汇率',
  notification: '通知',
  finance_ledger: '财务台账',
  ai_suggestion: 'AI 建议',
  task_run: '系统任务',
  role: '角色',
  store_access: '店铺授权',
  trend_keyword: '趋势关键词',
  captured_keyword: '捕获关键词',
  trending_product: '热卖商品',
  competitor_product: '竞品',
  inventory_alert_rule: '库存预警规则',
  product_discovery: '选品发现',
  scout_decision: '选品决策',
  supply_product: '1688 供应商品',
  sourcing_item: '品源商品',
  listing_template: '刊登模板',
  report_subscription: '报表订阅',
}

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] || labelBusinessCode(action)
}

export function auditResourceLabel(resourceType: string) {
  return AUDIT_RESOURCE_LABELS[resourceType] || labelBusinessCode(resourceType)
}

export function shortResourceId(resourceId: string | null | undefined) {
  if (!resourceId) return ''
  return resourceId.length > 18 ? `${resourceId.slice(0, 8)}…${resourceId.slice(-4)}` : resourceId
}
