import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Wallet, Banknote } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import {
  getFinanceSummary,
  getFinanceTraceback,
  importPlatformBills,
  syncPlatformBills,
  type FinancePeriod,
  type FinanceSummary,
  type FinanceTraceback,
  type PlatformBillImportRecord,
} from '../api/finance'
import { FinanceLedgerPanel } from '../features/finance/FinanceLedgerPanel'
import { logger } from '../utils/logger'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { ApiResponse } from '../types/common'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { businessActionForCode } from '../utils/businessLabels'
import { useConfig } from '../hooks/useConfig'
import { usePlatformStatuses } from '../hooks/usePlatforms'


const PERIOD_TABS = [
  { id: 'daily', label: '日报' },
  { id: 'weekly', label: '周报' },
  { id: 'monthly', label: '月报' },
]

export default function FinancePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const platformAccountId = searchParams.get('platform_account_id') || ''
  const [period, setPeriod] = useState<FinancePeriod>('daily')
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [traceback, setTraceback] = useState<FinanceTraceback | null>(null)
  const [summaryEvidence, setSummaryEvidence] = useState<ApiResponse<FinanceSummary> | null>(null)
  const [tracebackEvidence, setTracebackEvidence] = useState<ApiResponse<FinanceTraceback> | null>(null)
  const [billImportText, setBillImportText] = useState('')
  const [billImportMessage, setBillImportMessage] = useState('')
  const [billImporting, setBillImporting] = useState(false)
  const [billSyncAccountId, setBillSyncAccountId] = useState(platformAccountId)
  const [billSyncing, setBillSyncing] = useState(false)
  const [billSyncMessage, setBillSyncMessage] = useState('')
  const { finance_entry_types, platforms, markets } = useConfig()
  const platformStatusQuery = usePlatformStatuses()
  const platformStatuses = platformStatusQuery.data?.data || []

  useEffect(() => {
    getFinanceSummary(period)
      .then(r => { setSummary(r.data || null); setSummaryEvidence(r) })
      .catch(e => logger.error('Load finance summary failed', e))
    getFinanceTraceback(period)
      .then(r => { setTraceback(r.data || null); setTracebackEvidence(r) })
      .catch(e => logger.error('Load finance traceback failed', e))
  }, [period])

  const reloadSummary = () => {
    getFinanceSummary(period)
      .then(r => { setSummary(r.data || null); setSummaryEvidence(r) })
      .catch(e => logger.error('Reload finance summary failed', e))
    getFinanceTraceback(period)
      .then(r => { setTraceback(r.data || null); setTracebackEvidence(r) })
      .catch(e => logger.error('Reload finance traceback failed', e))
  }

  const handlePlatformBillImport = async () => {
    setBillImportMessage('')
    let records: PlatformBillImportRecord[]
    try {
      const parsed = JSON.parse(billImportText)
      if (!Array.isArray(parsed)) {
        setBillImportMessage('请粘贴平台账单 JSON 数组。')
        return
      }
      records = parsed as PlatformBillImportRecord[]
    } catch (e: any) {
      logger.error('Parse platform bill import JSON failed', e)
      setBillImportMessage('账单内容不是有效 JSON，请检查引号、逗号和数组格式。')
      return
    }
    if (!records.length) {
      setBillImportMessage('请至少提供 1 条平台账单记录。')
      return
    }
    setBillImporting(true)
    try {
      const result = await importPlatformBills({ records })
      const data = result.data
      setBillImportMessage(`已导入 ${data?.imported_count ?? 0} 条，跳过 ${data?.skipped_count ?? 0} 条。`)
      if ((data?.imported_count ?? 0) > 0) {
        setBillImportText('')
        reloadSummary()
      }
    } catch (e: any) {
      logger.error('Import platform bills failed', e)
      setBillImportMessage('平台账单导入失败，请检查字段是否包含 entry_type、amount_rmb、order_id 等必要信息。')
    } finally {
      setBillImporting(false)
    }
  }

  const handlePlatformBillSync = async () => {
    setBillSyncMessage('')
    if (!billSyncAccountId) {
      setBillSyncMessage('请先选择一个平台店铺。')
      return
    }
    setBillSyncing(true)
    try {
      const result = await syncPlatformBills({ platform_account_id: billSyncAccountId })
      const data = result.data
      if (!data) {
        setBillSyncMessage('平台账单同步未返回结果。')
        return
      }
      const imported = data.import_result.imported_count
      const skipped = data.import_result.skipped_count
      const gapText = data.data_gaps.length ? ` 缺口：${data.data_gaps.join('、')}` : ''
      setBillSyncMessage(data.status === 'success'
        ? `Open API 同步完成：导入 ${imported} 条，跳过 ${skipped} 条。${gapText}`
        : `Open API 暂不可用：${data.message || '平台账单 API 未接通'}。${data.next_action || ''}${gapText}`)
      if (imported > 0) reloadSummary()
    } catch (e: any) {
      logger.error('Sync platform bills failed', e)
      setBillSyncMessage(e?.response?.data?.detail || '平台账单 Open API 同步失败。')
    } finally {
      setBillSyncing(false)
    }
  }

  const totalRevenue = summary?.total_revenue_rmb ?? null
  const totalCost = summary?.total_cost_rmb ?? null
  const netProfit = summary?.net_profit_rmb ?? null
  const profitMargin = summary?.profit_margin_pct != null ? summary.profit_margin_pct.toFixed(1) : '--'
  const cashBalance = summary?.cash_balance_rmb ?? null
  const costBreakdown = summary?.cost_breakdown || {}
  const settlement = summary?.platform_settlement
  const movementTotals = Object.entries(settlement?.movement_totals || {}).filter(([, value]) => Number(value || 0) > 0)
  const dataRisks = [
    summary?.total_revenue_rmb == null
      ? { level: 'medium', title: '收入台账未入账', desc: '当前周期没有销售收入台账记录。', action: businessActionForCode('sales_income') }
      : null,
    totalCost == null
      ? { level: 'medium', title: '成本台账不完整', desc: '当前周期没有可汇总成本，净利润无法计算。', action: businessActionForCode('purchase_cost') }
      : null,
    !costBreakdown.purchase_cost
      ? { level: 'info', title: '采购成本缺失', desc: '采购付款尚未形成采购成本台账。', action: businessActionForCode('purchase_cost') }
      : null,
    !costBreakdown.platform_fee
      ? { level: 'info', title: '平台费缺失', desc: '平台佣金/交易费尚未形成平台费用台账。', action: businessActionForCode('platform_fee') }
      : null,
    cashBalance == null
      ? { level: 'info', title: '资金余额未录入', desc: '没有可用资金余额台账，无法判断采购安全线。', action: businessActionForCode('cash_balance') }
      : null,
  ].filter(Boolean) as { level: string; title: string; desc: string; action: { label: string; route: string } }[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">财务护卫</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>利润汇总 · 资金监控 · 风险预警</p>
        {platformAccountId && (
          <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            当前从经营指挥台按店铺下钻：{platformAccountId}。最近台账与平台账单同步默认使用该店铺。
          </p>
        )}
      </div>

      <Tabs tabs={PERIOD_TABS} activeTab={period} onChange={(tabId) => setPeriod(tabId as FinancePeriod)} />
      <EvidenceBanner evidence={summaryEvidence} />

      {/* Profit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>总收入</p>
              <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <p className="text-xl font-bold mt-1" style={{ color: totalRevenue == null ? 'var(--color-muted)' : totalRevenue < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>{totalRevenue == null ? '--' : `¥${totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {totalRevenue != null ? '来自财务台账' : '收入台账未入账'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>总成本</p>
              <TrendingDown className="w-4 h-4 text-[var(--color-danger)]" />
            </div>
            <p className="text-xl font-bold mt-1" style={{ color: totalCost == null ? 'var(--color-muted)' : totalCost < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>{totalCost == null ? '待接入' : `¥${totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{summary?.entry_count ? '来自财务台账' : '待录入采购、物流、平台费台账'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>净利润</p>
              <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <p className="text-xl font-bold mt-1" style={{ color: netProfit == null ? 'var(--color-muted)' : netProfit < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>{netProfit == null ? '待接入' : `¥${netProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              净利率 {profitMargin}%
            </p>
          </CardContent>
        </Card>
        {/* Cash Flow Monitoring - Key V3.0 feature */}
        <Card className="border-2" style={{ borderColor: 'var(--color-border)' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>可用资金</p>
              <Banknote className="w-4 h-4" style={{ color: cashBalance == null ? 'var(--color-muted)' : 'var(--color-primary)' }} />
            </div>
            <p className="text-xl font-bold mt-1" style={{ color: cashBalance == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>{cashBalance == null ? '待接入' : `¥${cashBalance.toFixed(2)}`}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {cashBalance == null ? '待录入资金余额台账' : '已录入资金余额，安全线待配置'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--color-fg)]">周期财务结构</h2>
        </CardHeader>
        <CardContent>
          {summary?.entry_count ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="mb-2 text-xs text-[var(--color-muted)]">收入 / 成本 / 净利润</p>
                {[
                  ['收入', totalRevenue, 'var(--color-success)'],
                  ['成本', totalCost, 'var(--color-danger)'],
                  ['净利润', netProfit, netProfit != null && netProfit < 0 ? 'var(--color-danger)' : 'var(--color-primary)'],
                ].map(([label, value, color]) => {
                  const numeric = typeof value === 'number' ? Math.abs(value) : 0
                  const maxValue = Math.max(Math.abs(totalRevenue || 0), Math.abs(totalCost || 0), Math.abs(netProfit || 0), 1)
                  return (
                    <div key={label as string} className="mb-2">
                      <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--color-muted)]">{label as string}</span><span className="text-[var(--color-fg)]">{typeof value === 'number' ? `¥${value.toFixed(2)}` : '--'}</span></div>
                      <div className="h-2 rounded-full bg-[var(--color-border)]"><div className="h-full rounded-full" style={{ width: `${Math.max((numeric / maxValue) * 100, numeric > 0 ? 4 : 0)}%`, background: color as string }} /></div>
                    </div>
                  )
                })}
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="mb-2 text-xs text-[var(--color-muted)]">成本拆分</p>
                {Object.entries(costBreakdown).filter(([, value]) => Number(value || 0) > 0).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--color-muted)]">当前周期未形成可拆分成本台账</p>
                ) : Object.entries(costBreakdown).filter(([, value]) => Number(value || 0) > 0).map(([key, value]) => (
                  <div key={key} className="mb-2 flex items-center justify-between rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs">
                    <span className="text-[var(--color-muted)]">{key}</span>
                    <span className="font-medium text-[var(--color-fg)]">¥{Number(value).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">当前{PERIOD_TABS.find(item => item.id === period)?.label}没有真实财务台账，图表保持空态；请先补录收入、采购、物流或平台费。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">订单 / 商品 / 店铺利润回溯</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">只按真实财务台账关联字段聚合；缺平台交易明细时显示缺口，不用订单金额补利润。</p>
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={tracebackEvidence} compact />
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['订单', traceback?.summary.order_count ?? 0],
              ['商品', traceback?.summary.product_count ?? 0],
              ['店铺', traceback?.summary.store_count ?? 0],
              ['流水', traceback?.summary.entry_count ?? 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-[var(--color-bg)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">{label as string}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{value as number}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <TracebackColumn title="按订单" empty="暂无可按订单回溯的台账" rows={(traceback?.by_order || []).slice(0, 4).map(item => ({
              id: item.order_id,
              title: item.order_id,
              meta: [labelFor(platforms || [], item.platform), labelFor(markets || [], item.market), item.account_name].filter(Boolean).join(' · '),
              revenue: item.revenue_rmb,
              cost: item.cost_rmb,
              profit: item.net_profit_rmb,
              gaps: item.data_gaps,
            }))} />
            <TracebackColumn title="按商品" empty="暂无可按商品回溯的台账" rows={(traceback?.by_product || []).slice(0, 4).map(item => ({
              id: item.product_id,
              title: item.product_name || item.product_id,
              meta: [labelFor(platforms || [], item.platform), labelFor(markets || [], item.market)].filter(Boolean).join(' · '),
              revenue: item.revenue_rmb,
              cost: item.cost_rmb,
              profit: item.net_profit_rmb,
              gaps: item.data_gaps,
            }))} />
            <TracebackColumn title="按店铺" empty="暂无可按店铺回溯的台账" rows={(traceback?.by_store || []).slice(0, 4).map(item => ({
              id: item.store_key,
              title: item.account_name || item.store_key,
              meta: [labelFor(platforms || [], item.platform), labelFor(markets || [], item.market)].filter(Boolean).join(' · '),
              revenue: item.revenue_rmb,
              cost: item.cost_rmb,
              profit: item.net_profit_rmb,
              gaps: item.data_gaps,
            }))} />
          </div>
        </CardContent>
      </Card>

      <FinanceLedgerPanel
        onLedgerChanged={reloadSummary}
        initialEntryType={searchParams.get('entry_type') || ''}
        initialOrderId={searchParams.get('order_id') || ''}
        initialPlatformAccountId={platformAccountId}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">平台账单批量导入 / Open API 同步</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            粘贴 Shopee、TEMU、TikTok Shop 卖家后台导出的订单费用、平台佣金、交易费、退款或提现流水；Open API 未真实接通时只显示缺口，不生成假流水。
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <textarea
              value={billImportText}
              onChange={(event) => setBillImportText(event.target.value)}
              placeholder='粘贴 JSON 数组：每条记录至少包含 entry_type、amount_rmb，可附带 import_ref、order_id、platform、market、account_name、product_name。'
              className="min-h-[132px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
            />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
              <p className="font-medium text-[var(--color-fg)]">导入口径</p>
              <ul className="mt-2 space-y-1">
                <li>1. import_ref 用于去重，重复账单不会再次入账。</li>
                <li>2. order_id、sourcing_item_id、account_name 用于订单、商品、店铺利润回溯。</li>
                <li>3. entry_type 支持平台费、交易费、退款、提现、供应商付款和物流成本。</li>
              </ul>
              <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <p className="text-[11px] font-medium text-[var(--color-fg)]">Open API 同步</p>
                <select
                  value={billSyncAccountId}
                  onChange={(event) => setBillSyncAccountId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">选择平台店铺</option>
                  {platformStatuses.map((item) => (
                    <option key={item.account_id} value={item.account_id}>
                      {labelFor(platforms || [], item.platform)} · {item.account_name} · {item.operation_details.find(detail => detail.id === 'finance_bills')?.status === 'implemented' ? '账单API已实现' : '账单API待接入'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePlatformBillSync}
                  disabled={billSyncing}
                  className="mt-2 w-full rounded-full border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
                >
                  {billSyncing ? '同步中...' : '同步平台账单 Open API'}
                </button>
                {billSyncMessage && (
                  <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-fg)]">
                    {billSyncMessage}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePlatformBillImport}
                disabled={billImporting}
                className="mt-4 w-full rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)] disabled:opacity-60"
              >
                {billImporting ? '导入中...' : '导入平台账单'}
              </button>
              {billImportMessage && (
                <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-fg)]">
                  {billImportMessage}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">平台资金结算</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按卖家后台口径跟踪钱包余额、提现、供应商付款、平台费用、退款和订单对账来源。</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">店铺钱包</p>
              {settlement?.wallet_balances?.length ? (
                <div className="space-y-2">
                  {settlement.wallet_balances.map((wallet) => (
                    <div key={wallet.source_entry_id} className="rounded-lg bg-[var(--color-surface)] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--color-fg)]">{wallet.account_name || [labelFor(platforms || [], wallet.platform), labelFor(markets || [], wallet.market)].filter(Boolean).join(' / ') || '平台钱包'}</span>
                        <span className="text-[var(--color-primary)]">{formatMoney(wallet.amount_rmb)}</span>
                      </div>
                      <p className="mt-1 text-[var(--color-muted)]">
                        {[labelFor(platforms || [], wallet.platform), labelFor(markets || [], wallet.market), wallet.amount_original != null ? `${wallet.currency} ${wallet.amount_original}` : null, wallet.reference_rate].filter(Boolean).join(' · ') || '无平台/市场明细'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">尚未录入或同步平台钱包余额。</p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">提现/付款/费用</p>
              {movementTotals.length ? (
                <div className="space-y-2">
                  {movementTotals.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs">
                      <span className="text-[var(--color-muted)]">{financeEntryLabel(finance_entry_types || [], key)}</span>
                      <span className="font-medium text-[var(--color-fg)]">{formatMoney(Number(value))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">尚未录入提现、付款或平台费用流水。</p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">订单对账</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--color-surface)] p-3">
                  <p className="text-[11px] text-[var(--color-muted)]">已关联订单</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{settlement?.order_reconciliation?.linked_order_count ?? 0}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-surface)] p-3">
                  <p className="text-[11px] text-[var(--color-muted)]">账单流水</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{settlement?.order_reconciliation?.linked_entry_count ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                缺 Shopee/TEMU/TikTok Shop 交易明细时，只展示账单导入或 Open API 接入缺口，不用订单金额推算平台利润。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">数据质量与资金风险</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(dataRisks.length ? dataRisks : [
              { level: 'info', title: '台账数据完整', desc: '当前周期收入、成本和资金余额已具备基础判断条件。', action: businessActionForCode('finance_ledger_entries') },
            ]).map((risk, i) => (
              <div key={i} className={`rounded-xl p-3 border text-sm ${
                risk.level === 'medium' ? 'border-[var(--color-warning)] bg-[var(--color-warning-light)]' :
                risk.level === 'high' ? 'border-[var(--color-danger)] bg-[var(--color-danger-light)]' :
                'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`w-3.5 h-3.5 ${
                    risk.level === 'medium' ? 'text-[var(--color-warning)]' :
                    risk.level === 'high' ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'
                  }`} />
                  <span className="font-medium text-[var(--color-fg)]">{risk.title}</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">{risk.desc}</p>
                <button onClick={() => navigate(risk.action.route)} className="mt-1 inline-block text-left text-[11px] text-[var(--color-primary)]">
                  对策：{risk.action.label}
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatMoney(value: number | null | undefined) {
  return value == null ? '--' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function financeEntryLabel(options: { id: string; label: string }[], key: string) {
  return options.find(item => item.id === key)?.label || key
}

function labelFor(options: { id: string; label: string }[], key: string | null) {
  return key ? options.find(item => item.id === key)?.label || key : ''
}

type TracebackRow = {
  id: string
  title: string
  meta: string
  revenue: number | null
  cost: number | null
  profit: number | null
  gaps: string[]
}

function TracebackColumn({ title, empty, rows }: { title: string; empty: string; rows: TracebackRow[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">{title}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg bg-[var(--color-surface)] p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-fg)]">{row.title}</p>
                  <p className="mt-1 text-[var(--color-muted)]">{row.meta || '来源字段待补'}</p>
                </div>
                <span style={{ color: row.profit == null ? 'var(--color-muted)' : row.profit < 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                  {formatMoney(row.profit)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--color-muted)]">
                <span>收入 {formatMoney(row.revenue)}</span>
                <span>成本 {formatMoney(row.cost)}</span>
                {row.gaps.length > 0 && <span className="text-[var(--color-warning)]">缺口 {row.gaps.join(' / ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
