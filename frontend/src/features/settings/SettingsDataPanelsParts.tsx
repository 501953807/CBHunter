import { Check, CircleAlert, CircleCheck, DollarSign, Edit3, RefreshCw, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import type { UnifiedFieldDictionaryItem } from '../../api/config'

export function FieldDictionaryRow({
  item,
  editing,
  onEdit,
  onCancel,
  onChange,
}: {
  item: UnifiedFieldDictionaryItem
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onChange: (updater: (item: UnifiedFieldDictionaryItem) => UnifiedFieldDictionaryItem) => void
}) {
  const rawFieldText = (platform: "shopee" | "temu" | "tiktok" | "miaoshou") => item.platforms?.[platform]?.field || ""
  const fieldText = (platform: "shopee" | "temu" | "tiktok" | "miaoshou") => rawFieldText(platform) || "待映射"
  const updateText = (field: keyof UnifiedFieldDictionaryItem, value: string) => {
    onChange(current => ({ ...current, [field]: value }))
  }
  const updatePlatformField = (platform: "shopee" | "temu" | "tiktok" | "miaoshou", value: string) => {
    onChange(current => ({
      ...current,
      platforms: {
        ...(current.platforms || {}),
        [platform]: {
          ...((current.platforms || {})[platform] || {}),
          field: value,
        },
      },
    }))
  }
  const textInput = (value: string, onValueChange: (value: string) => void, width = "w-28") => (
    <input
      value={value}
      onChange={event => onValueChange(event.target.value)}
      className={`${width} rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]`}
    />
  )
  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0">
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-fg)]">{item.key}</td>
      <td className="px-3 py-2 font-medium text-[var(--color-fg)]">{editing ? textInput(item.label, value => updateText("label", value)) : item.label}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.data_type, value => updateText("data_type", value), "w-24") : item.data_type}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.module, value => updateText("module", value), "w-24") : item.module}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("shopee"), value => updatePlatformField("shopee", value)) : fieldText("shopee")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("temu"), value => updatePlatformField("temu", value)) : fieldText("temu")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("tiktok"), value => updatePlatformField("tiktok", value)) : fieldText("tiktok")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("miaoshou"), value => updatePlatformField("miaoshou", value)) : fieldText("miaoshou")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.country_difference || "", value => updateText("country_difference", value), "w-32") : item.country_difference || "无"}</td>
      <td className="px-3 py-2">
        {editing ? (
          <button onClick={onCancel} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
            完成
          </button>
        ) : (
          <button onClick={onEdit} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-primary)]">
            编辑
          </button>
        )}
      </td>
    </tr>
  )
}

export function buildFeeGovernanceSummary(grouped: Record<string, any[]>, rates: any[], pricingTemplates: any[]) {
  const rows = Object.values(grouped).flat()
  const markets = new Set(rows.map(item => `${item.platform || ''}_${item.market || ''}`))
  return {
    platformCount: Object.keys(grouped).length,
    marketCount: markets.size,
    completeFeeRows: rows.filter(item => !hasFeeGap(item)).length,
    missingFeeRows: rows.filter(hasFeeGap).length,
    exchangeCurrencyCount: rates.length,
    pricingTemplateCount: pricingTemplates.length,
  }
}

export function hasFeeGap(item: any) {
  return ['commission', 'transaction', 'tech', 'low_value_tax'].some(key => item?.[key] == null)
}

export function FeeGovernanceMetric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
  const color = tone === 'success'
    ? 'var(--color-success)'
    : tone === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-fg)'
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
      <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div className="mt-1 text-base font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

export function FeeRateGovernanceSummary({
  activePlatform,
  feeStatusText,
  governanceSummary,
  items,
}: {
  activePlatform: string
  feeStatusText: string
  governanceSummary: ReturnType<typeof buildFeeGovernanceSummary>
  items: any[]
}) {
  const hasConfigurationGap = governanceSummary.missingFeeRows || governanceSummary.exchangeCurrencyCount === 0

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      data-ui="settings-fee-rate-governance-summary"
      aria-label="费率汇率治理摘要"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>费率、汇率与定价模板治理摘要</h3>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
            这里只读取已启用平台费率模板、汇率记录和定价附加模板；缺失项保持待配置，不按 0% 或固定汇率代算。
          </p>
        </div>
        <span
          className="rounded-full px-2 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: hasConfigurationGap ? 'var(--color-warning-light)' : 'var(--color-success-light)',
            color: hasConfigurationGap ? 'var(--color-warning)' : 'var(--color-success)',
          }}
        >
          {hasConfigurationGap ? '配置待补齐' : '配置可用于定价'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <FeeGovernanceMetric label="平台" value={governanceSummary.platformCount} />
        <FeeGovernanceMetric label="市场" value={governanceSummary.marketCount} />
        <FeeGovernanceMetric label="完整费率" value={governanceSummary.completeFeeRows} />
        <FeeGovernanceMetric label="费率缺口" value={governanceSummary.missingFeeRows} tone={governanceSummary.missingFeeRows ? 'warning' : 'success'} />
        <FeeGovernanceMetric label="汇率币种" value={governanceSummary.exchangeCurrencyCount} tone={governanceSummary.exchangeCurrencyCount ? 'success' : 'warning'} />
        <FeeGovernanceMetric label="定价模板" value={governanceSummary.pricingTemplateCount} />
      </div>
      <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-2">
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <span className="font-medium" style={{ color: 'var(--color-fg)' }}>当前平台费率：</span>
          <span style={{ color: 'var(--color-muted)' }}>
            {activePlatform || '未选择'} · {items.length} 个市场 · 缺口 {items.filter(hasFeeGap).length}
          </span>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <span className="font-medium" style={{ color: 'var(--color-fg)' }}>接口说明：</span>
          <span style={{ color: feeStatusText ? 'var(--color-muted)' : 'var(--color-warning)' }}>
            {feeStatusText || '费率接口暂未返回来源说明或缺口。'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ExchangeRatesPanel({
  rates,
  refreshingRates,
  onRefreshRates,
}: {
  rates: any[]
  refreshingRates: boolean
  onRefreshRates: () => void
}) {
  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>实时汇率 (1 CNY =)</span>
        <button
          onClick={onRefreshRates}
          disabled={refreshingRates}
          className="flex items-center gap-1 rounded border px-2 py-1 text-[11px] hover:bg-[var(--color-bg)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <RefreshCw className={`h-3 w-3 ${refreshingRates ? 'animate-spin' : ''}`} />
          {refreshingRates ? '刷新中' : '刷新汇率'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 md:grid-cols-8">
        {rates.map((rate: any) => (
          <div key={rate.to_currency} className="rounded px-2 py-1 text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
            <div className="text-[11px] font-semibold" style={{ color: 'var(--color-fg)' }}>{rate.rate < 0.01 ? rate.rate.toFixed(6) : rate.rate.toFixed(4)}</div>
            <div className="text-[11px]" style={{ color: 'var(--color-primary)' }}>{rate.to_currency}</div>
          </div>
        ))}
        {rates.length === 0 ? (
          <div className="col-span-full py-1 text-center text-[11px]" style={{ color: 'var(--color-muted)' }}>点击刷新获取最新汇率</div>
        ) : null}
      </div>
    </div>
  )
}

export function ProfitCalculatorPanel({
  bestMarket,
  calcDisabledReason,
  calcLoading,
  calcResults,
  costRmb,
  markupPct,
  shippingRmb,
  onCalculate,
  onCostChange,
  onMarkupChange,
  onShippingChange,
}: {
  bestMarket: any
  calcDisabledReason: string
  calcLoading: boolean
  calcResults: any[]
  costRmb: string
  markupPct: string
  shippingRmb: string
  onCalculate: () => void
  onCostChange: (value: string) => void
  onMarkupChange: (value: string) => void
  onShippingChange: (value: string) => void
}) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-fg)' }}><DollarSign className="h-4 w-4 text-[var(--color-primary)]" />利润试算器</h3>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ProfitInput label="进货成本 (¥)" value={costRmb} onValueChange={onCostChange} />
        <ProfitInput label="头程运费 (¥)" value={shippingRmb} onValueChange={onShippingChange} />
        <ProfitInput label="加价率 (%)" value={markupPct} onValueChange={onMarkupChange} />
        <div className="flex items-end">
          <button
            onClick={onCalculate}
            disabled={calcLoading || Boolean(calcDisabledReason)}
            className="w-full rounded-lg px-3 py-2 text-xs text-[var(--color-primary-text)] disabled:opacity-40"
            style={{ background: 'var(--gradient-accent)' }}
          >
            {calcLoading ? '计算中...' : '计算利润'}
          </button>
        </div>
      </div>
      {calcDisabledReason ? <p className="mb-2 text-[11px] text-[var(--color-warning)]">暂不能试算：{calcDisabledReason}</p> : null}
      <div className="mb-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        总成本: {costRmb === '' || shippingRmb === '' ? '--' : `¥${(Number(costRmb) + Number(shippingRmb)).toFixed(2)}`} · 加价率: {markupPct === '' ? '--' : `${markupPct}%`} · 目标售价: {markupPct === '' ? '--' : `${(1 + Number(markupPct) / 100).toFixed(1)}x`}
      </div>
      {bestMarket ? (
        <div className={`mb-2 flex items-center gap-2 rounded-lg p-2 ${bestMarket.is_profitable ? 'bg-[var(--color-success-light)]' : 'bg-[var(--color-danger-light)]'}`}>
          {bestMarket.is_profitable ? <CircleCheck className="h-4 w-4 text-[var(--color-success)]" /> : <CircleAlert className="h-4 w-4 text-[var(--color-danger)]" />}
          <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>最佳: {bestMarket.platform} · {bestMarket.market}</span>
          <span className="text-xs font-semibold" style={{ color: bestMarket.is_profitable ? 'var(--color-success)' : 'var(--color-danger)' }}>¥{bestMarket.profit_rmb} ({bestMarket.margin_pct}%)</span>
        </div>
      ) : null}
      {calcResults.length > 0 ? <ProfitResultTable calcResults={calcResults} /> : null}
    </div>
  )
}

function ProfitInput({ label, value, onValueChange }: { label: string; value: string; onValueChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-0.5 block text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={event => onValueChange(event.target.value)}
        className="w-full rounded border px-2 py-1.5 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-bg)' }}
      />
    </div>
  )
}

function ProfitResultTable({ calcResults }: { calcResults: any[] }) {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-[11px]">
        <thead style={{ backgroundColor: 'var(--color-bg)' }}>
          <tr>
            {['平台', '市场', '售价', '费率', '利润¥', '利润率'].map((head, index) => (
              <th key={head} className={`px-1.5 py-1 ${index > 1 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--color-muted)' }}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calcResults.map((result: any, index: number) => (
            <tr key={`${result.platform}-${result.market}-${index}`} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <td className="px-1.5 py-1" style={{ color: 'var(--color-fg)' }}>{result.platform}</td>
              <td className="px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>{result.market}</td>
              <td className="px-1.5 py-1 text-right" style={{ color: 'var(--color-fg)' }}>{result.selling_local.toFixed(2)}</td>
              <td className="px-1.5 py-1 text-right" style={{ color: 'var(--color-muted)' }}>{result.fee_pct}%</td>
              <td className="px-1.5 py-1 text-right font-semibold" style={{ color: result.is_profitable ? 'var(--color-success)' : 'var(--color-danger)' }}>{result.profit_rmb > 0 ? '+' : ''}{result.profit_rmb}</td>
              <td className="px-1.5 py-1 text-right" style={{ color: result.margin_pct >= 20 ? 'var(--color-success)' : result.margin_pct > 0 ? 'var(--color-fg)' : 'var(--color-danger)' }}>{result.margin_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FeeRateTable({
  activePlatform,
  editingId,
  fields,
  fieldLabels,
  form,
  items,
  platformNames,
  onCancelEdit,
  onEditItem,
  onFormChange,
  onSaveItem,
  onSelectPlatform,
}: {
  activePlatform: string
  editingId: string | null
  fields: readonly string[]
  fieldLabels: Record<string, string>
  form: Record<string, string>
  items: any[]
  platformNames: string[]
  onCancelEdit: () => void
  onEditItem: (item: any) => void
  onFormChange: (field: string, value: string) => void
  onSaveItem: () => void
  onSelectPlatform: (platform: string) => void
}) {
  const saveDisabled = Object.values(form).some(value => value === '')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[var(--color-success)]" />
          <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>费率与汇率</h2>
        </div>
        <div className="mt-2 flex w-fit gap-1 rounded-lg bg-[var(--color-bg)] p-0.5">
          {platformNames.map(platform => (
            <button
              key={platform}
              onClick={() => onSelectPlatform(platform)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${activePlatform === platform ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded bg-[var(--color-primary)] text-[11px] font-bold text-[var(--color-primary-text)]">{platform[0]}</span>{platform}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="py-2 pr-3 text-left font-medium" style={{ color: 'var(--color-muted)' }}>市场</th>
              {fields.map(field => <th key={field} className="py-2 pr-3 text-right font-medium" style={{ color: 'var(--color-muted)' }}>{fieldLabels[field]}</th>)}
              <th className="py-2 pr-3 text-right font-medium" style={{ color: 'var(--color-muted)' }}>总费率</th>
              <th className="py-2 text-center font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <FeeRateRow
                key={item.id || item.market}
                editing={editingId === item.id}
                fields={fields}
                fieldLabels={fieldLabels}
                form={form}
                item={item}
                saveDisabled={saveDisabled}
                onCancelEdit={onCancelEdit}
                onEditItem={() => onEditItem(item)}
                onFormChange={onFormChange}
                onSaveItem={onSaveItem}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function FeeRateRow({
  editing,
  fields,
  form,
  item,
  saveDisabled,
  onCancelEdit,
  onEditItem,
  onFormChange,
  onSaveItem,
}: {
  editing: boolean
  fields: readonly string[]
  fieldLabels: Record<string, string>
  form: Record<string, string>
  item: any
  saveDisabled: boolean
  onCancelEdit: () => void
  onEditItem: () => void
  onFormChange: (field: string, value: string) => void
  onSaveItem: () => void
}) {
  return (
    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-2 pr-3 font-medium" style={{ color: 'var(--color-fg)' }}>{item.market}</td>
      {fields.map(field => (
        <td key={field} className="py-2 pr-3 text-right">
          {editing ? (
            <input
              type="number"
              step="0.001"
              className="w-14 rounded border px-1 py-0.5 text-right text-xs"
              value={form[field] || ''}
              onChange={event => onFormChange(field, event.target.value)}
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
            />
          ) : (
            <span style={{ color: item[field] == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>{item[field] == null ? '--' : `${(item[field] * 100).toFixed(1)}%`}</span>
          )}
        </td>
      ))}
      <td className="py-2 pr-3 text-right font-semibold" style={{ color: item.total_pct == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>{item.total_pct ?? '--'}</td>
      <td className="py-2 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={onSaveItem} disabled={saveDisabled} className="text-[var(--color-success)] disabled:opacity-40" aria-label="保存费率"><Check className="h-3 w-3" /></button>
            <button onClick={onCancelEdit} className="text-[var(--color-muted)]" aria-label="取消编辑"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <button onClick={onEditItem} className="text-[var(--color-primary)]" aria-label="编辑费率"><Edit3 className="h-3 w-3" /></button>
        )}
      </td>
    </tr>
  )
}
