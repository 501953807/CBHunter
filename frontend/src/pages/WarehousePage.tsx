import { useState, useEffect } from 'react'
import { Plus, Warehouse, MapPin, Phone, DollarSign, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { createWarehouse, deleteWarehouse, listWarehouses } from '../api/settings'
import { logger } from '../utils/logger'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { ApiResponse } from '../types/common'
import type { WarehouseConfig } from '../api/settings'

export default function WarehousePage() {
  const confirmAction = useConfirm()
  const [warehouses, setWarehouses] = useState<WarehouseConfig[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<WarehouseConfig[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', contact: '', fee_per_parcel: '', is_default: false })

  const load = async () => {
    setLoading(true)
    try {
      const r = await listWarehouses()
      setWarehouses(r.data || [])
      setEvidence(r)
    } catch (e: any) { logger.error('Operation failed', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.name || !form.city || !form.address) return
    const feePerParcel = form.fee_per_parcel === '' ? undefined : parseFloat(form.fee_per_parcel)
    try {
      await createWarehouse({
        name: form.name, city: form.city, address: form.address,
        contact: form.contact,
        fee_per_parcel: Number.isFinite(feePerParcel) ? feePerParcel : undefined,
        is_default: form.is_default })
      setForm({ name: '', city: '', address: '', contact: '', fee_per_parcel: '', is_default: false })
      setShowForm(false)
      load()
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: '删除货代/云仓',
      message: '确定删除该货代/云仓配置？删除后采购地址和转运流程不会再使用该配置。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteWarehouse(id)
      load()
    } catch (e: any) { logger.error('Operation failed', e) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">货代/云仓管理</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            1688采购地址 → 云仓收货 → 质检贴单 → 转发平台仓
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1" />添加货代</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)]" placeholder="* 货代名称" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)]" placeholder="* 所在城市" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
            </div>
            <input className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)]" placeholder="* 收货地址" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)]" placeholder="联系人/电话" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} />
              <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)]" type="number" step="0.1" placeholder="单包裹处理费 ¥" value={form.fee_per_parcel} onChange={e => setForm({...form, fee_per_parcel: e.target.value})} />
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} />
              设为默认货代（1688采购地址自动使用此地址）
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.name || !form.city || !form.address}>保存</Button>
              <button onClick={() => setShowForm(false)} className="text-sm text-[var(--color-muted)] px-3 py-2">取消</button>
            </div>
          </CardContent>
        </Card>
      )}

      <EvidenceBanner evidence={evidence} compact />

      {loading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 bg-[var(--color-bg)] rounded-xl animate-pulse" />)}</div>
      ) : warehouses.length === 0 ? (
        <Card><CardContent className="pt-4 text-center py-10" style={{ color: 'var(--color-muted)' }}>
          <Warehouse className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无货代</p>
          <p className="text-xs mt-1">添加入驻的第三方云仓/货代信息</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {warehouses.map(wh => (
            <Card key={wh.id}>
              <CardContent className="pt-3 px-3.5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center">
                      <Warehouse className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{wh.name}</h3>
                        {wh.is_default && <span className="text-[11px] text-[var(--color-primary)] bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded">默认</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--color-muted)]">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{wh.city}</span>
                        {wh.contact && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{wh.contact}</span>}
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{wh.fee_per_parcel == null ? '处理费未录入' : `¥${wh.fee_per_parcel}/件`}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] mt-1">{wh.address}</p>
                    </div>
                  </div>
                  {wh.id && <button onClick={() => handleDelete(wh.id!)} className="text-[var(--color-muted)] hover:text-[var(--color-danger)]"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
