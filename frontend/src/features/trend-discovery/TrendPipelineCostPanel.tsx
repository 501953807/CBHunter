import { useState } from "react"
import { Plus } from "lucide-react"
import { COST_FIELDS, type CostPayload, type PurchaseForm } from "./TrendPipelineUtils"

export function PipelineCostPanel({
  item,
  pipelineStages,
  itemSuppliers,
  purchasingFor,
  purchaseForm,
  setPurchaseForm,
  onStageChange,
  onOpenPurchase,
  onCancelPurchase,
  onSubmitPurchase,
  onCalculateCost,
}: any) {
  return (
    <div className="space-y-3">
      <StageButtons item={item} pipelineStages={pipelineStages} onStageChange={onStageChange} />
      <CostSummary item={item} />
      <button onClick={() => onOpenPurchase(item)}
        className="text-[11px] text-[var(--color-success)] bg-[var(--color-success-light)] border border-[var(--color-success)] rounded-lg py-1.5 w-full text-center hover:opacity-90">
        <Plus className="w-3 h-3 inline mr-1" />
        记录采购成本到财务台账
      </button>
      {purchasingFor === item.id && (
        <PurchaseFormPanel
          itemSuppliers={itemSuppliers}
          purchaseForm={purchaseForm}
          setPurchaseForm={setPurchaseForm}
          onSubmit={() => onSubmitPurchase(item.id)}
          onCancel={onCancelPurchase}
        />
      )}
      <CostCalculator item={item} onCalculateCost={onCalculateCost} />
    </div>
  )
}

function StageButtons({ item, pipelineStages, onStageChange }: any) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium text-[var(--color-muted)]">阶段推进:</span>
      {pipelineStages.map((stage: any) => {
        const current = item.pipeline_stage === stage.id
        const isDiscontinued = stage.tone === 'danger'
        return (
          <button key={stage.id} onClick={() => current ? undefined : onStageChange(item.id, stage.id)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors
              ${current ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)]'
              : isDiscontinued ? 'text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger-light)]'
              : 'text-[var(--color-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg)]'}`}>
            {current ? '✓ ' : ''}{stage.label}
          </button>
        )
      })}
    </div>
  )
}

function CostSummary({ item }: any) {
  return (
    <div className="grid grid-cols-4 gap-2 text-[11px]">
      <Metric label="采购价" value={item.source_price_rmb && item.source_price_rmb > 0 ? `¥${item.source_price_rmb}` : '采购价待录入'} />
      <Metric label="售价" value={item.selling_price_local ? `${item.selling_price_local}` : '-'} />
      <Metric label="总成本" value={item.total_cost_rmb ? `¥${item.total_cost_rmb}` : '-'} />
      <div className="bg-[var(--color-bg)] rounded p-1.5 text-center">
        <span className="text-[var(--color-muted)]">利润率</span>
        <p className={`font-medium ${item.profit_margin_pct ? (item.profit_margin_pct >= 15 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]') : ''}`}>
          {item.profit_margin_pct ? `${item.profit_margin_pct}%` : '-'}
        </p>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg)] rounded p-1.5 text-center">
      <span className="text-[var(--color-muted)]">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function PurchaseFormPanel({ itemSuppliers, purchaseForm, setPurchaseForm, onSubmit, onCancel }: {
  itemSuppliers: any[]
  purchaseForm: PurchaseForm
  setPurchaseForm: (value: PurchaseForm | ((prev: PurchaseForm) => PurchaseForm)) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="bg-[var(--color-success-light)] rounded-lg p-2.5 space-y-2">
      {itemSuppliers.length > 0 && (
        <select className="w-full text-xs border border-[var(--color-success)] rounded px-2 py-1 bg-[var(--color-surface)]"
          value={purchaseForm.supplier_id}
          onChange={e => {
            const supplier = itemSuppliers.find((s: any) => s.id === e.target.value)
            setPurchaseForm(prev => ({
              ...prev,
              supplier_id: e.target.value,
              unit_cost_rmb: supplier?.purchase_price_rmb != null ? String(supplier.purchase_price_rmb) : prev.unit_cost_rmb,
              domestic_shipping_rmb: supplier?.shipping_estimate_rmb != null ? String(supplier.shipping_estimate_rmb) : prev.domestic_shipping_rmb,
            }))
          }}>
          <option value="">不关联供应商</option>
          {itemSuppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
        </select>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input className="text-xs border border-[var(--color-success)] rounded px-2 py-1" type="number" min="1" placeholder="数量"
          value={purchaseForm.quantity} onChange={e => setPurchaseForm({...purchaseForm, quantity: e.target.value})} />
        <input className="text-xs border border-[var(--color-success)] rounded px-2 py-1" type="number" min="0" step="0.01" placeholder="单价 RMB"
          value={purchaseForm.unit_cost_rmb} onChange={e => setPurchaseForm({...purchaseForm, unit_cost_rmb: e.target.value})} />
        <input className="text-xs border border-[var(--color-success)] rounded px-2 py-1" type="number" min="0" step="0.01" placeholder="国内运费 RMB"
          value={purchaseForm.domestic_shipping_rmb} onChange={e => setPurchaseForm({...purchaseForm, domestic_shipping_rmb: e.target.value})} />
      </div>
      <input className="w-full text-xs border border-[var(--color-success)] rounded px-2 py-1" placeholder="备注（可选）"
        value={purchaseForm.description} onChange={e => setPurchaseForm({...purchaseForm, description: e.target.value})} />
      <div className="flex gap-2">
        <button onClick={onSubmit}
          className="text-xs bg-[var(--color-success)] text-[var(--color-primary-text)] px-3 py-1 rounded hover:opacity-90">确认入账</button>
        <button onClick={onCancel}
          className="text-xs text-[var(--color-muted)] px-2 py-1 hover:text-[var(--color-fg)]">取消</button>
      </div>
    </div>
  )
}

function CostCalculator({ item, onCalculateCost }: { item: any; onCalculateCost: (item: any, payload: CostPayload) => void }) {
  const [validationMessage, setValidationMessage] = useState('')

  const collectPayload = () => {
    setValidationMessage('')
    if (!item.source_price_rmb || item.source_price_rmb <= 0) {
      setValidationMessage('请先填写真实采购价')
      return
    }
    const getVal = (key: string) => {
      const el = document.getElementById(`${item.id}-${key}`) as HTMLInputElement
      return parseFloat(el?.value || '')
    }
    const payload = {
      source_price_rmb: item.source_price_rmb,
      selling_price_local: getVal('selling_price_local'),
      domestic_shipping_rmb: getVal('domestic_shipping_rmb'),
      intl_shipping_rmb: getVal('intl_shipping_rmb'),
      packaging_cost_rmb: getVal('packaging_cost_rmb'),
      platform_fee_pct: getVal('platform_fee_pct'),
      payment_fee_pct: getVal('payment_fee_pct'),
      return_reserve_pct: getVal('return_reserve_pct'),
      exchange_rate: getVal('exchange_rate'),
    }
    const missing = Object.entries(payload)
      .filter(([_, value]) => typeof value !== 'number' || !Number.isFinite(value))
      .map(([key]) => key)
    if (missing.length > 0) {
      setValidationMessage(`请补齐成本字段：${missing.join('、')}`)
      return
    }
    onCalculateCost(item, payload)
  }

  return (
    <details className="text-[11px]">
      <summary className="cursor-pointer text-[var(--color-primary)] hover:text-[var(--color-primary)]">成本核算</summary>
      <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-[var(--color-primary-light)] rounded">
        {COST_FIELDS.map(field => (
          <div key={field.key}>
            <label className="text-[11px] text-[var(--color-muted)]">{field.label}</label>
            <input className="w-full text-[11px] border border-[var(--color-border)] rounded px-1 py-0.5"
              defaultValue={(item as any)[field.key] ?? ''}
              onChange={() => {}} id={`${item.id}-${field.key}`} />
          </div>
        ))}
        <button onClick={collectPayload}
          className="col-span-3 text-xs bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded py-1 hover:bg-[var(--color-primary-hover)]">
          计算
        </button>
        {validationMessage && (
          <p className="col-span-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]">
            {validationMessage}
          </p>
        )}
      </div>
    </details>
  )
}
