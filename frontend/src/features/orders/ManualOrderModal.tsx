import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createManualOrder } from '../../api/orders'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useConfig } from '../../hooks/useConfig'
import { usePlatforms } from '../../hooks/usePlatforms'
import { logger } from '../../utils/logger'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type DraftItem = { name: string; sku: string; quantity: string; unit_price: string }
const emptyItem = (): DraftItem => ({ name: '', sku: '', quantity: '', unit_price: '' })

export function ManualOrderModal({ open, onClose, onCreated }: Props) {
  const accountsQuery = usePlatforms()
  const { platforms, markets } = useConfig()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    platform_account_id: '', merchant_order_number: '', buyer_name: '', currency: '',
    total: '', ordered_at: '', notes: '',
  })
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const supportedIds = new Set(platforms.map((item) => item.id))
  const accounts = (accountsQuery.data?.data || []).filter((item) => item.is_active && supportedIds.has(item.platform))
  const currencies = Array.from(new Set(markets.map((item) => item.currency).filter(Boolean))) as string[]
  const canSubmit = Boolean(
    accounts.length > 0 && form.platform_account_id && form.merchant_order_number.trim()
    && form.currency && form.ordered_at && Number(form.total) > 0
    && items.length > 0 && items.every((item) => (
      item.name.trim() && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0
      && item.unit_price !== '' && Number(item.unit_price) >= 0
    )),
  )

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  const submit = async () => {
    const total = Number(form.total)
    const parsedItems = items.map((item) => ({
      name: item.name.trim(), sku: item.sku.trim() || null,
      quantity: Number(item.quantity), unit_price: Number(item.unit_price),
    }))
    if (!form.platform_account_id || !form.merchant_order_number.trim() || !form.currency || !form.ordered_at || !Number.isFinite(total) || total <= 0 || parsedItems.some((item) => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      setError('请完整填写店铺、订单号、币种、金额、下单时间和至少一条有效商品明细。')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createManualOrder({
        platform_account_id: form.platform_account_id,
        merchant_order_number: form.merchant_order_number.trim(),
        buyer_name: form.buyer_name.trim() || null,
        currency: form.currency,
        total,
        ordered_at: new Date(form.ordered_at).toISOString(),
        notes: form.notes.trim() || null,
        items: parsedItems,
      })
      onCreated()
      onClose()
    } catch (e: any) {
      logger.error('手工创建订单失败', e)
      setError(e?.response?.data?.detail || e?.message || '手工创建订单失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="手工创建订单" size="lg" footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={submit} disabled={saving || !canSubmit}>{saving ? '保存中' : '保存手工订单'}</Button></>}>
      <div className="space-y-4">
        <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">仅用于平台 Open API 尚未接通的店铺。订单将标记为“手工录入”，不会冒充平台同步，也不会自动生成财务收入。</p>
        {accounts.length === 0 && <p className="text-xs text-[var(--color-danger)]">暂无可用店铺，请先在平台账号中配置 Shopee、TEMU 或 TikTok Shop 店铺。</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select label="店铺账号" placeholder="请选择" value={form.platform_account_id} onChange={(value) => setForm({ ...form, platform_account_id: value })} options={accounts.map((item) => ({ value: item.id, label: `${item.account_name} · ${platforms.find((platform) => platform.id === item.platform)?.label || item.platform}` }))} />
          <Input label="商家订单号" value={form.merchant_order_number} onChange={(event) => setForm({ ...form, merchant_order_number: event.target.value })} />
          <Input label="买家名称" value={form.buyer_name} onChange={(event) => setForm({ ...form, buyer_name: event.target.value })} />
          <Select label="币种" placeholder="请选择" value={form.currency} onChange={(value) => setForm({ ...form, currency: value })} options={currencies.map((currency) => ({ value: currency, label: currency }))} />
          <Input label="订单总额" type="number" min="0.01" step="0.01" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
          <Input label="下单时间" type="datetime-local" value={form.ordered_at} onChange={(event) => setForm({ ...form, ordered_at: event.target.value })} />
        </div>
        <Input label="订单备注" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        <div>
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[var(--color-fg)]">商品明细</h3><Button variant="secondary" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}><Plus className="h-3.5 w-3.5" />添加商品</Button></div>
          <div className="mt-2 space-y-2">
            {items.map((item, index) => <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-[var(--color-border)] p-2 md:grid-cols-[minmax(0,2fr)_1fr_90px_120px_32px]">
              <Input placeholder="商品名称" value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
              <Input placeholder="SKU（可选）" value={item.sku} onChange={(event) => updateItem(index, { sku: event.target.value })} />
              <Input placeholder="数量" type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
              <Input placeholder="单价" type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: event.target.value })} />
              <button aria-label="删除商品明细" title="删除商品明细" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-9 w-8 place-items-center rounded text-[var(--color-danger)] disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </div>)}
          </div>
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </Modal>
  )
}
