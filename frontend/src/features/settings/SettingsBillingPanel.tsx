import { useEffect, useState } from 'react'
import { CreditCard, ShieldCheck, WalletCards } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import {
  createPaymentOrder,
  getBillingPlans,
  getCurrentSubscription,
  getEntitlements,
  getQuotaUsage,
  type CurrentSubscription,
  type QuotaUsage,
  type SubscriptionPlan,
} from '../../api/billing'
import type { EntitlementConfig } from '../../api/config'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'

export function BillingSettings({ toast }: { toast: any }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null)
  const [entitlements, setEntitlements] = useState<EntitlementConfig | null>(null)
  const [usage, setUsage] = useState<QuotaUsage[]>([])
  const [entitlementEvidence, setEntitlementEvidence] = useState<ApiResponse<EntitlementConfig> | null>(null)
  const [usageEvidence, setUsageEvidence] = useState<ApiResponse<QuotaUsage[]> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [planRes, subRes, entRes, usageRes] = await Promise.all([
        getBillingPlans(),
        getCurrentSubscription(),
        getEntitlements(),
        getQuotaUsage(),
      ])
      setPlans(planRes.data || [])
      setSubscription(subRes.data || null)
      setEntitlements(entRes.data || null)
      setUsage(usageRes.data || [])
      setEntitlementEvidence(entRes)
      setUsageEvidence(usageRes)
    } catch (e: any) {
      logger.error('Load billing settings failed', e)
      toast.addToast('error', '套餐权益加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createOrder = async (planCode: string, channel: 'wechat' | 'alipay') => {
    try {
      const res = await createPaymentOrder(planCode, channel)
      if (res.data?.status === 'configuration_required') {
        toast.addToast('warning', res.data.message || '真实支付网关尚未接入，订单未提交')
      } else {
        toast.addToast('success', '支付订单已创建')
      }
      load()
    } catch (e: any) {
      logger.error('Create payment order failed', e)
      toast.addToast('error', '创建支付订单失败')
    }
  }

  if (loading) {
    return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载...</div>
  }

  const activePlan = subscription?.plan_code || entitlements?.subscription.plan_code || 'free'
  const planNameByCode = Object.fromEntries(plans.map(plan => [plan.code, plan.name]))

  return (
    <div className="space-y-5">
      <EvidenceBanner evidence={entitlementEvidence} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WalletCards className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>当前套餐权益</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="套餐" value={planNameByCode[activePlan] || planLabel(activePlan)} />
            <Metric label="订阅状态" value={subscriptionStatusLabel(subscription?.status || entitlements?.subscription.status)} />
            <Metric label="数据缺口" value={(entitlements?.data_gaps || []).join(', ') || '无'} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {plans.map(plan => (
          <Card key={plan.code} className={plan.code === activePlan ? 'ring-2 ring-[var(--color-primary)]' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{plan.name}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{plan.description}</p>
                </div>
                {plan.code === activePlan && <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-success)' }} />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>
                {(plan.price_cents / 100).toFixed(0)} {plan.currency}
                <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-muted)' }}>/{plan.billing_cycle}</span>
              </div>
              <div className="mt-3 space-y-2">
                {plan.entitlements.map(item => (
                  <div key={item.feature_code} className="flex items-center justify-between gap-3 text-xs">
                    <span style={{ color: 'var(--color-muted)' }}>{item.feature_name}</span>
                    <span style={{ color: item.enabled ? 'var(--color-fg)' : 'var(--color-danger)' }}>
                      {item.enabled ? item.limit_value ?? '启用' : '未启用'}{item.unit || ''}
                    </span>
                  </div>
                ))}
              </div>
              {plan.price_cents > 0 && plan.code !== activePlan && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => createOrder(plan.code, 'wechat')} className="px-3 py-2 rounded text-xs border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>微信支付</button>
                  <button onClick={() => createOrder(plan.code, 'alipay')} className="px-3 py-2 rounded text-xs border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>支付宝</button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>额度使用</h2>
          </div>
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={usageEvidence} compact />
          {usage.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无额度消耗记录</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>权益</th>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>周期</th>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>已用</th>
                </tr>
              </thead>
              <tbody>
                {usage.map(item => (
                  <tr key={`${item.feature_code}-${item.period_key}`} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2" style={{ color: 'var(--color-fg)' }}>{entitlements?.features[item.feature_code]?.feature_name || featureLabel(item.feature_code)}</td>
                    <td className="py-2" style={{ color: 'var(--color-muted)' }}>{item.period_key}</td>
                    <td className="py-2" style={{ color: 'var(--color-muted)' }}>{item.used_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{value}</div>
    </div>
  )
}

function planLabel(code?: string) {
  if (code === 'free') return '免费体验版'
  if (code === 'growth') return '成长版'
  if (code === 'pro') return '专业版'
  return code || '未开通'
}

function subscriptionStatusLabel(status?: string) {
  if (status === 'active') return '当前生效'
  if (status === 'default_free') return '免费体验版生效'
  if (status === 'expired') return '已过期'
  if (status === 'cancelled') return '已取消'
  return status || '未开通'
}

function featureLabel(code: string) {
  const labels: Record<string, string> = {
    'users.max': '用户数量',
    'stores.max': '接入店铺',
    'ai.tasks.monthly': 'AI任务',
    'competitor.monitors.max': '竞品监控',
    'report.subscriptions.max': '报表订阅',
    'exports.enabled': '数据导出',
  }
  return labels[code] || code
}
