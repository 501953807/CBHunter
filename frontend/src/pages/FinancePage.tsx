import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import {
  getFinanceSummary,
  getFinanceTraceback,
  importPlatformBills,
  syncPlatformBills,
  type FinancePeriod,
  type PlatformBillImportRecord,
} from '../api/finance'
import { FinanceLedgerPanel } from '../features/finance/FinanceLedgerPanel'
import { FinanceV5SkuFieldDictionary } from '../features/finance/FinanceV5SkuFieldDictionary'
import { logger } from '../utils/logger'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useConfig } from '../hooks/useConfig'
import { usePlatformStatuses } from '../hooks/usePlatforms'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import {
  PERIOD_TABS,
  PLATFORM_BILL_JSON_EXAMPLE,
  formatMoney,
  labelFor,
} from '../features/finance/FinancePageUtils'
import { FinanceTrendSnapshot } from '../features/finance/FinanceTrendSnapshot'
import { TracebackColumn } from '../features/finance/FinanceTracebackColumn'
import {
  FinanceRiskPanel,
  FinanceStructurePanel,
  FinanceSummaryCards,
  PlatformBillPanel,
  PlatformSettlementPanel,
} from '../features/finance/FinancePageParts'

export default function FinancePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const platformAccountId = searchParams.get('platform_account_id') || ''
  const initialEntryType = searchParams.get('entry_type') || ''
  const isCashBalancePrefill = initialEntryType === 'cash_balance'
  const [period, setPeriod] = useState<FinancePeriod>('daily')
  const [billImportText, setBillImportText] = useState('')
  const [billImportMessage, setBillImportMessage] = useState('')
  const [billImporting, setBillImporting] = useState(false)
  const [billSyncAccountId, setBillSyncAccountId] = useState(platformAccountId)
  const [billSyncing, setBillSyncing] = useState(false)
  const [billSyncMessage, setBillSyncMessage] = useState('')
  const { finance_entry_types, platforms, markets, unified_field_dictionary } = useConfig()
  const platformStatusQuery = usePlatformStatuses()
  const platformStatuses = platformStatusQuery.data?.data || []
  const financeSummaryQuery = useQuery({
    queryKey: ['finance-summary', period, platformAccountId],
    queryFn: () => getFinanceSummary(period, { platform_account_id: platformAccountId || undefined }),
  })
  const financeTracebackQuery = useQuery({
    queryKey: ['finance-traceback', period, platformAccountId],
    queryFn: () => getFinanceTraceback(period, { platform_account_id: platformAccountId || undefined }),
  })
  const summary = financeSummaryQuery.data?.data || null
  const traceback = financeTracebackQuery.data?.data || null
  const summaryEvidence = financeSummaryQuery.data || null
  const tracebackEvidence = financeTracebackQuery.data || null

  const reloadSummary = () => {
    financeSummaryQuery.refetch().catch(e => logger.error('Reload finance summary failed', e))
    financeTracebackQuery.refetch().catch(e => logger.error('Reload finance traceback failed', e))
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

  const fillBillImportExample = () => {
    setBillImportText(PLATFORM_BILL_JSON_EXAMPLE)
    setBillImportMessage('已填入平台账单 JSON 示例，请按真实平台导出数据修改后再导入。')
  }

  const totalRevenue = summary?.total_revenue_rmb ?? null
  const totalCost = summary?.total_cost_rmb ?? null
  const netProfit = summary?.net_profit_rmb ?? null
  const profitMargin = summary?.profit_margin_pct != null ? summary.profit_margin_pct.toFixed(1) : '--'
  const cashBalance = summary?.cash_balance_rmb ?? null
  const costBreakdown = summary?.cost_breakdown || {}
  const settlement = summary?.platform_settlement
  const movementTotals = Object.entries(settlement?.movement_totals || {}).filter(([, value]) => Number(value || 0) > 0)
  const dataRisks = summary?.risk_signals || []
  const financeTrendPoints = [
    { label: '收入趋势', value: totalRevenue ?? 0, tone: 'var(--color-success)' },
    { label: '成本趋势', value: totalCost ?? 0, tone: 'var(--color-danger)' },
    { label: '利润趋势', value: netProfit ?? 0, tone: netProfit != null && netProfit < 0 ? 'var(--color-danger)' : 'var(--color-primary)' },
    { label: '资金趋势', value: cashBalance ?? 0, tone: 'var(--color-info)' },
  ]

  return (
    <div className="finance-shell space-y-6 page-enter">
      <div className="finance-hero rounded-[var(--radius-2xl)] px-5 py-5">
        <p className="luxury-section-kicker">finance guard</p>
        <h1 className="luxury-page-title mt-1">财务利润</h1>
        <p className="luxury-page-description mt-2">按平台、店铺、市场统一查看收入、成本、净利润、资金余额、账单同步、利润回溯和资金风险。</p>
      </div>
      <StoreContextBanner
        platformAccountId={platformAccountId}
        statuses={platformStatuses}
        currentModule="finance"
        clearHref="/finance"
      />

      <Tabs tabs={PERIOD_TABS} activeTab={period} onChange={(tabId) => setPeriod(tabId as FinancePeriod)} />
      <EvidenceBanner evidence={summaryEvidence} />
      {financeSummaryQuery.isError && (
        <div
          data-ui="finance-summary-error"
          className="finance-error-panel flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] px-3 py-2 text-xs"
        >
          <span className="text-[var(--color-danger)]">财务汇总加载失败，当前收入、成本、净利润和资金余额暂不可用。</span>
          <button
            type="button"
            onClick={() => financeSummaryQuery.refetch()}
            className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
          >
            重新加载财务汇总
          </button>
        </div>
      )}

      <FinanceSummaryCards
        cashBalance={cashBalance}
        entryCount={summary?.entry_count || 0}
        netProfit={netProfit}
        profitMargin={profitMargin}
        totalCost={totalCost}
        totalRevenue={totalRevenue}
      />

      <FinanceTrendSnapshot
        periodLabel={PERIOD_TABS.find(item => item.id === period)?.label || '当前筛选'}
        points={financeTrendPoints}
        hasData={Boolean(summary?.entry_count)}
      />

      <FinanceStructurePanel
        costBreakdown={costBreakdown}
        entryCount={summary?.entry_count || 0}
        netProfit={netProfit}
        period={period}
        totalCost={totalCost}
        totalRevenue={totalRevenue}
      />

      <Card className="finance-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">订单 / 商品 / 店铺利润回溯</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">只按真实财务台账关联字段聚合；缺平台交易明细时显示缺口，不用订单金额补利润。</p>
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={tracebackEvidence} compact />
          {financeTracebackQuery.isError && (
            <div
              data-ui="finance-traceback-error"
              className="finance-error-panel mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">利润回溯加载失败，当前订单、商品和店铺利润拆解暂不可用。</span>
              <button
                type="button"
                onClick={() => financeTracebackQuery.refetch()}
                className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
              >
                重新加载利润回溯
              </button>
            </div>
          )}
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
            {[
              ['回溯收入', traceback?.summary.total_revenue_rmb == null ? '--' : formatMoney(traceback.summary.total_revenue_rmb)],
              ['回溯成本', traceback?.summary.total_cost_rmb == null ? '--' : formatMoney(traceback.summary.total_cost_rmb)],
              ['回溯净利', traceback?.summary.net_profit_rmb == null ? '--' : formatMoney(traceback.summary.net_profit_rmb)],
              ['退款/售后', formatMoney(traceback?.summary.refund_rmb ?? 0)],
              ['结算流动', formatMoney(traceback?.summary.settlement_movement_rmb ?? 0)],
              ['对象数', `${traceback?.summary.order_count ?? 0}单 / ${traceback?.summary.product_count ?? 0}品 / ${traceback?.summary.store_count ?? 0}店`],
            ].map(([label, value]) => (
              <div key={label as string} className="finance-mini-tile rounded-[var(--radius-lg)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">{label as string}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-fg)]">{value as string}</p>
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
          <FinanceV5SkuFieldDictionary
            products={traceback?.by_product || []}
            unified_field_dictionary={unified_field_dictionary}
          />
        </CardContent>
      </Card>

      <FinanceLedgerPanel
        onLedgerChanged={reloadSummary}
        initialEntryType={initialEntryType}
        initialOrderId={searchParams.get('order_id') || ''}
        initialPlatformAccountId={platformAccountId}
      />
      {isCashBalancePrefill && (
        <p className="finance-input-panel rounded-[var(--radius-xl)] px-4 py-3 text-xs text-[var(--color-primary)]">
          当前已定位到“补录资金余额”场景，真实台账补录表单已预填 entry_type=cash_balance；请录入对应平台店铺钱包或公司现金余额。
        </p>
      )}

      <PlatformBillPanel
        billImporting={billImporting}
        billImportMessage={billImportMessage}
        billImportText={billImportText}
        billSyncAccountId={billSyncAccountId}
        billSyncing={billSyncing}
        billSyncMessage={billSyncMessage}
        financeEntryTypes={finance_entry_types || []}
        onBillImport={handlePlatformBillImport}
        onBillImportTextChange={setBillImportText}
        onBillSync={handlePlatformBillSync}
        onBillSyncAccountChange={setBillSyncAccountId}
        onFillExample={fillBillImportExample}
        platformStatuses={platformStatuses}
        platforms={platforms || []}
      />

      <PlatformSettlementPanel
        financeEntryTypes={finance_entry_types || []}
        markets={markets || []}
        movementTotals={movementTotals}
        platforms={platforms || []}
        settlement={settlement}
      />

      <FinanceRiskPanel dataRisks={dataRisks} onNavigate={navigate} />
    </div>
  )
}
