import { useEffect, useState } from "react"
import { Modal } from "../../components/ui/Modal"
import { useCreateAlertRule } from "../../hooks/useInventoryAlerts"
import { useConfig } from "../../hooks/useConfig"

export function AddRuleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAlertRule()
  const { inventory_alert_severities = [] } = useConfig()
  const [form, setForm] = useState({ product_id: '', sku: '', product_name: '', safety_stock: 10, severity: '' })

  useEffect(() => {
    if (!form.severity && inventory_alert_severities.length > 0) {
      setForm(prev => ({ ...prev, severity: inventory_alert_severities[0].id }))
    }
  }, [form.severity, inventory_alert_severities])

  const handleSubmit = () => {
    if (!form.sku || !form.product_name || !form.severity) return
    create.mutate(form, { onSuccess: () => onClose() })
  }

  return (
    <Modal open onClose={onClose} title="添加预警规则" size="sm"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg transition-colors hover:bg-[var(--color-border)]" style={{ color: 'var(--color-muted)' }}>取消</button>
        <button onClick={handleSubmit} disabled={create.isPending || !form.severity} className="px-4 py-2 text-sm rounded-lg text-[var(--color-primary-text)] disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
          {create.isPending ? '创建中...' : '创建'}
        </button>
      </>}>
      <div className="space-y-3">
        <Field label="SKU" value={form.sku} onChange={value => setForm({ ...form, sku: value })} placeholder="输入SKU" />
        <Field label="商品名称" value={form.product_name} onChange={value => setForm({ ...form, product_name: value })} placeholder="输入商品名称" />
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>安全库存阈值</label>
          <input type="number" value={form.safety_stock} onChange={e => setForm({ ...form, safety_stock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>严重程度</label>
          <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
            {inventory_alert_severities.length === 0 && <option value="">请先配置库存预警级别</option>}
            {inventory_alert_severities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div><label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>{label}</label><input value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }} placeholder={placeholder} /></div>
}
