import { AlertTriangle, Banknote, ShieldCheck, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import type { FinancePeriod, FinanceRiskSignal, FinanceSummary, PlatformSettlementSummary } from '../../api/finance'
import type { PlatformIntegrationStatus } from '../../api/platforms'
import { PERIOD_TABS, PLATFORM_BILL_JSON_EXAMPLE, financeEntryLabel, formatMoney, labelFor } from './FinancePageUtils'

type DictOption = { id: string; label: string }

export function FinanceSummaryCards({
  cashBalance,
  entryCount,
  netProfit,
  profitMargin,
  totalCost,
  totalRevenue,
}: {
  cashBalance: number | null
  entryCount: number
  netProfit: number | null
  profitMargin: string
  totalCost: number | null
  totalRevenue: number | null
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="finance-summary-card" data-tone="revenue">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>总收入</p>
            <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
          </div>
          <p className="text-xl font-bold mt-1" style={{ color: totalRevenue == null ? 'var(--color-muted)' : totalRevenue < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>
            {totalRevenue == null ? '--' : `¥${totalRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {totalRevenue != null ? '来自财务台账' : '收入台账未入账'}
          </p>
        </CardContent>
      </Card>
      <Card className="finance-summary-card" data-tone="cost">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>总成本</p>
            <TrendingDown className="w-4 h-4 text-[var(--color-danger)]" />
          </div>
          <p className="text-xl font-bold mt-1" style={{ color: totalCost == null ? 'var(--color-muted)' : totalCost < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>
            {totalCost == null ? '待接入' : `¥${totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{entryCount ? '来自财务台账' : '待录入采购、物流、平台费台账'}</p>
        </CardContent>
      </Card>
      <Card className="finance-summary-card" data-tone="profit">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>净利润</p>
            <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <p className="text-xl font-bold mt-1" style={{ color: netProfit == null ? 'var(--color-muted)' : netProfit < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>
            {netProfit == null ? '待接入' : `¥${netProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>净利率 {profitMargin}%</p>
        </CardContent>
      </Card>
      <Card className="finance-summary-card" data-tone="cash">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>可用资金</p>
            <Banknote className="w-4 h-4" style={{ color: cashBalance == null ? 'var(--color-muted)' : 'var(--color-primary)' }} />
          </div>
          <p className="text-xl font-bold mt-1" style={{ color: cashBalance == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>
            {cashBalance == null ? '待接入' : `¥${cashBalance.toFixed(2)}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {cashBalance == null ? '待录入资金余额台账' : '已录入资金余额，安全线待配置'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function FinanceStructurePanel({
  costBreakdown,
  entryCount,
  netProfit,
  period,
  totalCost,
  totalRevenue,
}: {
  costBreakdown: Record<string, number>
  entryCount: number
  netProfit: number | null
  period: FinancePeriod
  totalCost: number | null
  totalRevenue: number | null
}) {
  const costItems = Object.entries(costBreakdown).filter(([, value]) => Number(value || 0) > 0)
  const maxValue = Math.max(Math.abs(totalRevenue || 0), Math.abs(totalCost || 0), Math.abs(netProfit || 0), 1)

  return (
    <Card className="finance-panel">
      <CardHeader>
        <h2 className="font-semibold text-[var(--color-fg)]">统计日期区间财务结构</h2>
      </CardHeader>
      <CardContent>
        {entryCount ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="finance-structure-card rounded-[var(--radius-xl)] p-3">
              <p className="mb-2 text-xs text-[var(--color-muted)]">收入 / 成本 / 净利润</p>
              {[
                ['收入', totalRevenue, 'var(--color-success)'],
                ['成本', totalCost, 'var(--color-danger)'],
                ['净利润', netProfit, netProfit != null && netProfit < 0 ? 'var(--color-danger)' : 'var(--color-primary)'],
              ].map(([label, value, color]) => {
                const numeric = typeof value === 'number' ? Math.abs(value) : 0
                return (
                  <div key={label as string} className="mb-2">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-[var(--color-muted)]">{label as string}</span>
                      <span className="text-[var(--color-fg)]">{typeof value === 'number' ? `¥${value.toFixed(2)}` : '--'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-border)]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((numeric / maxValue) * 100, numeric > 0 ? 4 : 0)}%`, background: color as string }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="finance-structure-card rounded-[var(--radius-xl)] p-3">
              <p className="mb-2 text-xs text-[var(--color-muted)]">成本拆分</p>
              {costItems.length === 0 ? (
                <p className="finance-empty-panel rounded-[var(--radius-lg)] py-6 text-center text-xs text-[var(--color-muted)]">当前筛选范围未形成可拆分成本台账</p>
              ) : costItems.map(([key, value]) => (
                <div key={key} className="finance-mini-tile mb-2 flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-xs">
                  <span className="text-[var(--color-muted)]">{key}</span>
                  <span className="font-medium text-[var(--color-fg)]">¥{Number(value).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="finance-empty-panel rounded-[var(--radius-xl)] p-6 text-center text-sm text-[var(--color-muted)]">当前{PERIOD_TABS.find(item => item.id === period)?.label}没有真实财务台账，图表保持空态；请先补录收入、采购、物流或平台费。</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PlatformBillPanel({
  billImporting,
  billImportMessage,
  billImportText,
  billSyncAccountId,
  billSyncing,
  billSyncMessage,
  financeEntryTypes,
  onBillImport,
  onBillImportTextChange,
  onBillSync,
  onBillSyncAccountChange,
  onFillExample,
  platformStatuses,
  platforms,
}: {
  billImporting: boolean
  billImportMessage: string
  billImportText: string
  billSyncAccountId: string
  billSyncing: boolean
  billSyncMessage: string
  financeEntryTypes: DictOption[]
  onBillImport: () => void
  onBillImportTextChange: (value: string) => void
  onBillSync: () => void
  onBillSyncAccountChange: (value: string) => void
  onFillExample: () => void
  platformStatuses: PlatformIntegrationStatus[]
  platforms: DictOption[]
}) {
  return (
    <Card className="finance-bill-panel">
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
            onChange={(event) => onBillImportTextChange(event.target.value)}
            placeholder='粘贴 JSON 数组：每条记录至少包含 entry_type、amount_rmb，可附带 import_ref、order_id、platform、market、account_name、product_name。'
            className="luxury-input min-h-[132px] rounded-[var(--radius-xl)] p-3 text-xs"
          />
          <div className="finance-input-panel rounded-[var(--radius-xl)] p-3 text-xs text-[var(--color-muted)]">
            <p className="font-medium text-[var(--color-fg)]">导入口径</p>
            <ul className="mt-2 space-y-1">
              <li>1. import_ref 用于去重，重复账单不会再次入账。</li>
              <li>2. order_id、sourcing_item_id、account_name 用于订单、商品、店铺利润回溯。</li>
              <li>3. entry_type 支持平台费、交易费、退款、提现、供应商付款和物流成本。</li>
            </ul>
            <div className="finance-empty-panel mt-3 rounded-[var(--radius-lg)] p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[var(--color-fg)]">平台账单 JSON 示例</p>
                <button type="button" onClick={onFillExample} className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-primary)] hover:border-[var(--color-primary)]">
                  一键填入示例
                </button>
              </div>
              <pre className="finance-code-preview mt-2 max-h-24 overflow-auto rounded-[var(--radius-md)] p-2 text-[10px] leading-relaxed">
                {PLATFORM_BILL_JSON_EXAMPLE}
              </pre>
            </div>
            <div className="finance-input-panel mt-4 rounded-[var(--radius-lg)] p-2">
              <p className="text-[11px] font-medium text-[var(--color-fg)]">Open API 同步</p>
              <select value={billSyncAccountId} onChange={(event) => onBillSyncAccountChange(event.target.value)} className="luxury-select mt-2 w-full rounded-[var(--radius-lg)] px-2 py-1.5 text-xs">
                <option value="">选择平台店铺</option>
                {platformStatuses.map((item) => (
                  <option key={item.account_id} value={item.account_id}>
                    {labelFor(platforms, item.platform)} · {item.account_name} · {item.operation_details.find(detail => detail.id === 'finance_bills')?.status === 'implemented' ? '账单API已实现' : '账单API待接入'}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-[var(--color-muted)]">支持类型：{financeEntryTypes.slice(0, 6).map(item => item.label).join('、') || '待从业务字典加载'}</p>
              <button type="button" onClick={onBillSync} disabled={billSyncing} className="mt-2 w-full rounded-full border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] disabled:opacity-60">
                {billSyncing ? '同步中...' : '同步平台账单 Open API'}
              </button>
              {billSyncMessage && <p className="finance-mini-tile mt-2 rounded-[var(--radius-lg)] px-2 py-1.5 text-[11px] text-[var(--color-fg)]">{billSyncMessage}</p>}
            </div>
            <button type="button" onClick={onBillImport} disabled={billImporting} className="mt-4 w-full rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)] disabled:opacity-60">
              {billImporting ? '导入中...' : '导入平台账单'}
            </button>
            {billImportMessage && <p className="finance-mini-tile mt-3 rounded-[var(--radius-lg)] px-3 py-2 text-[var(--color-fg)]">{billImportMessage}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PlatformSettlementPanel({
  financeEntryTypes,
  markets,
  movementTotals,
  platforms,
  settlement,
}: {
  financeEntryTypes: DictOption[]
  markets: DictOption[]
  movementTotals: Array<[string, number]>
  platforms: DictOption[]
  settlement: PlatformSettlementSummary | undefined
}) {
  return (
    <Card className="finance-settlement-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="font-semibold text-[var(--color-fg)]">平台资金结算</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">按卖家后台口径跟踪钱包余额、提现、供应商付款、平台费用、退款和订单对账来源。</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="finance-settlement-card rounded-[var(--radius-xl)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">店铺钱包</p>
            {settlement?.wallet_balances?.length ? (
              <div className="space-y-2">
                {settlement.wallet_balances.map((wallet) => (
                  <div key={wallet.source_entry_id} className="finance-mini-tile rounded-[var(--radius-lg)] p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-fg)]">{wallet.account_name || [labelFor(platforms, wallet.platform), labelFor(markets, wallet.market)].filter(Boolean).join(' / ') || '平台钱包'}</span>
                      <span className="text-[var(--color-primary)]">{formatMoney(wallet.amount_rmb)}</span>
                    </div>
                    <p className="mt-1 text-[var(--color-muted)]">
                      {[labelFor(platforms, wallet.platform), labelFor(markets, wallet.market), wallet.amount_original != null ? `${wallet.currency} ${wallet.amount_original}` : null, wallet.reference_rate].filter(Boolean).join(' · ') || '无平台/市场明细'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="finance-empty-panel rounded-[var(--radius-lg)] p-4 text-center text-xs text-[var(--color-muted)]">尚未录入或同步平台钱包余额。</p>
            )}
          </div>
          <div className="finance-settlement-card rounded-[var(--radius-xl)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">提现/付款/费用</p>
            {movementTotals.length ? (
              <div className="space-y-2">
                {movementTotals.map(([key, value]) => (
                  <div key={key} className="finance-mini-tile flex items-center justify-between rounded-[var(--radius-lg)] px-3 py-2 text-xs">
                    <span className="text-[var(--color-muted)]">{financeEntryLabel(financeEntryTypes, key)}</span>
                    <span className="font-medium text-[var(--color-fg)]">{formatMoney(Number(value))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="finance-empty-panel rounded-[var(--radius-lg)] p-4 text-center text-xs text-[var(--color-muted)]">尚未录入提现、付款或平台费用流水。</p>
            )}
          </div>
          <div className="finance-settlement-card rounded-[var(--radius-xl)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">订单对账</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="finance-mini-tile rounded-[var(--radius-lg)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">已关联订单</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{settlement?.order_reconciliation?.linked_order_count ?? 0}</p>
              </div>
              <div className="finance-mini-tile rounded-[var(--radius-lg)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">账单流水</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{settlement?.order_reconciliation?.linked_entry_count ?? 0}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted)]">缺 Shopee/TEMU/TikTok Shop 交易明细时，只展示账单导入或 Open API 接入缺口，不用订单金额推算平台利润。</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function FinanceRiskPanel({
  dataRisks,
  onNavigate,
}: {
  dataRisks: FinanceSummary['risk_signals']
  onNavigate: (route: string) => void
}) {
  const risks: FinanceRiskSignal[] = dataRisks?.length ? dataRisks : [{
    code: 'ledger-ready',
    level: 'info',
    title: '台账数据完整',
    detail: '当前筛选范围收入、成本和资金余额已具备基础判断条件。',
    action_label: '查看财务台账',
    action_route: '/finance#finance-ledger',
  }]

  return (
    <Card className="finance-risk-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="font-semibold text-[var(--color-fg)]">数据质量与资金风险</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {risks.map((risk, index) => (
            <div key={`${risk.code}-${index}`} className={`finance-risk-card rounded-[var(--radius-xl)] p-3 text-sm ${
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
              <p className="text-xs text-[var(--color-muted)]">{risk.detail}</p>
              <button onClick={() => onNavigate(risk.action_route)} className="mt-1 inline-block text-left text-[11px] text-[var(--color-primary)]">
                对策：{risk.action_label}
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
