import client from './client'
import type { ApiResponse } from '../types/common'
import type { EntitlementConfig, EntitlementItem } from './config'

export interface SubscriptionPlan {
  code: string
  name: string
  description?: string
  price_cents: number
  currency: string
  billing_cycle: string
  entitlements: EntitlementItem[]
}

export interface CurrentSubscription {
  status: string
  plan_code?: string | null
  started_at?: string | null
  expires_at?: string | null
  source?: string | null
}

export interface QuotaUsage {
  feature_code: string
  period_key: string
  used_value: number
}

export interface PaymentOrderResult {
  id?: string
  status: 'configuration_required' | string
  order_status?: string
  channel: 'wechat' | 'alipay'
  amount_cents?: number
  currency?: string
  gateway_submitted?: boolean
  message?: string
  required_config?: string[]
  data_gaps?: string[]
}

export async function getBillingPlans() {
  const res = await client.get<ApiResponse<SubscriptionPlan[]>>('/billing/plans')
  return res.data
}

export async function getCurrentSubscription() {
  const res = await client.get<ApiResponse<CurrentSubscription>>('/billing/subscription')
  return res.data
}

export async function getEntitlements() {
  const res = await client.get<ApiResponse<EntitlementConfig>>('/billing/entitlements')
  return res.data
}

export async function getQuotaUsage() {
  const res = await client.get<ApiResponse<QuotaUsage[]>>('/billing/quota-usage')
  return res.data
}

export async function createPaymentOrder(plan_code: string, channel: 'wechat' | 'alipay') {
  const res = await client.post<ApiResponse<PaymentOrderResult>>('/billing/orders', { plan_code, channel })
  return res.data
}
