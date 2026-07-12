import { useEffect, useState } from "react"
import { Check, Key, Trash2, Warehouse, X } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { Input } from "../../components/ui/Input"
import { createWarehouse, deleteWarehouse, getPinterestAccount, listSystemConfig, listWarehouses, updatePinterestAccount, updateSystemConfig } from "../../api/settings"
import { logger } from "../../utils/logger"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"
import { useConfig } from "../../hooks/useConfig"

export function ApiKeySettings({ toast }: { toast: any }) {
  const [configs, setConfigs] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState<string | null>(null); const [editVal, setEditVal] = useState('')
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const [pinModal, setPinModal] = useState(false); const [pinForm, setPinForm] = useState({ email: '', password: '' })
  const load = async () => { setLoading(true); try { const r = await listSystemConfig(); const items = (r.data || []) as any[]; setConfigs(items.map(entry => ({ ...entry, value_hint: getValueHint(entry.key, entry) }))); setEvidence(r) } catch (e: any) { logger.error('Load system config failed', e); setConfigs([]) }; setLoading(false) }
  const getValueHint = (key: string, entry: any) => {
    if (!entry?.configured) return null
    if (key === 'pinterest_account') {
      return maskEmail(entry.value) || '已配置'
    }
    return entry.sensitive ? '••••••••' : entry.value || '已配置'
  }
  useEffect(() => { load() }, [])
  const save = async (key: string) => { try { const d = configs.find(item => item.key === key); if (!d) return; if (key === 'pinterest_account') await updatePinterestAccount(pinForm); else await updateSystemConfig(key, editVal, d.label); toast.addToast('success', `${d.label} 已保存`); setEditing(null); setEditVal(''); setPinModal(false); load() } catch (e: any) { logger.error('Save system config failed', e); toast.addToast('error', '保存失败') } }
  if (loading) return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载...</div>
  return <Card><CardHeader><div className="flex items-center gap-2"><Key className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /><h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>接口密钥管理</h2></div><p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>所有第三方 API 密钥和账号统一在此配置，加密存储于数据库，全局生效</p></CardHeader>
  <div className="px-6"><EvidenceBanner evidence={evidence} compact /></div>
  <CardContent><table className="w-full text-xs"><thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}><th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>配置项</th><th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>分组/类型</th><th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>当前值</th><th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>最后更新</th><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>用途</th></tr></thead><tbody>{configs.map(c => <tr key={c.key} className="border-b" style={{ borderColor: 'var(--color-border)' }}><td className="py-2 pr-3 font-medium" style={{ color: 'var(--color-fg)' }}>{c.label}</td><td className="py-2 pr-3"><span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.sensitive ? 'var(--color-info-light)' : 'var(--color-warning-light)', color: c.sensitive ? 'var(--color-info)' : 'var(--color-warning)' }}>{c.group || '其他'} / {c.input_type || '文本'}</span></td><td className="py-2 pr-3">{c.key === 'pinterest_account' ? <div className="flex items-center gap-2">{c.configured ? <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>{c.value_hint}</span> : <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>未设置</span>}<button onClick={async () => { try { const r = await getPinterestAccount(); setPinForm({ email: r.data?.email || '', password: '' }) } catch (e: any) { logger.error('Load Pinterest config failed', e); setPinForm({ email: '', password: '' }) }; setPinModal(true) }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>编辑</button></div> : editing === c.key ? <div className="flex items-center gap-1"><input className="text-xs border rounded px-2 py-1 w-48" type={c.sensitive ? 'password' : c.input_type === 'url' ? 'url' : 'text'} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder={`输入${c.label}`} style={{ borderColor: 'var(--color-border)' }} autoFocus /><button onClick={() => save(c.key)} className="p-1 rounded" style={{ color: 'var(--color-success)' }}><Check className="w-3.5 h-3.5" /></button><button onClick={() => setEditing(null)} className="p-1 rounded" style={{ color: 'var(--color-muted)' }}><X className="w-3.5 h-3.5" /></button></div> : <div className="flex items-center gap-2">{c.configured ? <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{c.value_hint}</span> : <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>未设置</span>}<button onClick={() => { setEditing(c.key); setEditVal('') }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>编辑</button></div>}</td><td className="py-2 pr-3" style={{ color: 'var(--color-muted)' }}>{c.updated_at ? new Date(c.updated_at).toLocaleDateString('zh-CN') : '—'}</td><td className="py-2" style={{ color: 'var(--color-muted)' }}>{c.used_for}</td></tr>)}</tbody></table></CardContent>
  {pinModal && <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50" onClick={() => setPinModal(false)}><div className="rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}><h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>Pinterest 账号配置</h3><p className="text-xs" style={{ color: 'var(--color-muted)' }}>邮箱+密码作为 JSON 加密存储到数据库</p><Input label="邮箱" id="pe" type="email" value={pinForm.email} onChange={e => setPinForm({...pinForm, email: e.target.value})} /><Input label="密码" id="pp" type="password" value={pinForm.password} onChange={e => setPinForm({...pinForm, password: e.target.value})} /><div className="flex gap-2"><button onClick={() => save('pinterest_account')} className="flex-1 py-2 rounded-lg text-[var(--color-primary-text)] text-sm" style={{ background: 'var(--gradient-accent)' }}>保存</button><button onClick={() => setPinModal(false)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }}>取消</button></div></div></div>}
  </Card>
}

export function WarehouseSettings({ toast }: { toast: any }) {
  const confirmAction = useConfirm()
  const [whs, setWhs] = useState<any[]>([]); const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const { warehouse_service_types = [], warehouse_integration_statuses = [], warehouse_inventory_sync_modes = [] } = useConfig()
  const [form, setForm] = useState({ name: '', address: '', city: '', contact: '', service_type: '', market_scope: '', integration_status: '', inventory_sync_mode: '' })
  const load = async () => { try { const r = await listWarehouses(); setWhs(r.data || []); setEvidence(r) } catch (e: any) { logger.error('Load warehouses failed', e); setWhs([]) } }
  useEffect(() => { load() }, [])
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      service_type: prev.service_type || warehouse_service_types[0]?.id || '',
      integration_status: prev.integration_status || warehouse_integration_statuses[0]?.id || '',
      inventory_sync_mode: prev.inventory_sync_mode || warehouse_inventory_sync_modes[0]?.id || '',
    }))
  }, [warehouse_integration_statuses, warehouse_inventory_sync_modes, warehouse_service_types])
  const resetForm = () => setForm({ name: '', address: '', city: '', contact: '', service_type: warehouse_service_types[0]?.id || '', market_scope: '', integration_status: warehouse_integration_statuses[0]?.id || '', inventory_sync_mode: warehouse_inventory_sync_modes[0]?.id || '' })
  const add = async () => { if (!form.name || !form.service_type || !form.integration_status || !form.inventory_sync_mode) return; try { await createWarehouse(form); toast.addToast('success', '已添加'); resetForm(); load() } catch (e: any) { logger.error('Create warehouse failed', e); toast.addToast('error', '失败') } }
  const del = async (warehouse: any) => {
    const ok = await confirmAction({
      title: '删除仓储配置',
      message: `确认删除仓储/货代「${warehouse.name}」？删除后发货选择和采购转运说明将不能继续引用该配置。`,
      confirmText: '确认删除仓储',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteWarehouse(warehouse.id); toast.addToast('success', '已删除'); load() } catch (e: any) { logger.error('Delete warehouse failed', e); toast.addToast('error', '失败') }
  }
  return <Card><CardHeader><div className="flex items-center gap-2"><Warehouse className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /><h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>仓储配置</h2></div><p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>当前仅维护轻量云仓/货代地址与发货联动说明，不建设保税仓、海外仓、关务或税务模块。</p></CardHeader><div className="px-6"><EvidenceBanner evidence={evidence} compact /></div><CardContent><div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3"><input className="text-xs border rounded px-2 py-1.5" placeholder="名称" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /><input className="text-xs border rounded px-2 py-1.5" placeholder="城市/区域" value={form.city} onChange={e => setForm({...form, city: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /><input className="text-xs border rounded px-2 py-1.5 lg:col-span-2" placeholder="地址" value={form.address} onChange={e => setForm({...form, address: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /><input className="text-xs border rounded px-2 py-1.5" placeholder="联系人/电话" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /></div><div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4"><select className="text-xs border rounded px-2 py-1.5" value={form.service_type} onChange={e => setForm({...form, service_type: e.target.value})} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{warehouse_service_types.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input className="text-xs border rounded px-2 py-1.5" placeholder="覆盖市场，如 MY/PH" value={form.market_scope} onChange={e => setForm({...form, market_scope: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /><select className="text-xs border rounded px-2 py-1.5" value={form.integration_status} onChange={e => setForm({...form, integration_status: e.target.value})} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{warehouse_integration_statuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select className="text-xs border rounded px-2 py-1.5" value={form.inventory_sync_mode} onChange={e => setForm({...form, inventory_sync_mode: e.target.value})} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{warehouse_inventory_sync_modes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button onClick={add} className="text-xs px-3 py-1.5 rounded text-[var(--color-primary-text)]" style={{ background: 'var(--gradient-accent)' }}>添加</button></div><div className="rounded-lg p-3 mb-3 text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>联动关系：发货时用于选择仓库/货代地址；库存预警仍以 Listing 和订单数据为主；如未来接入平台仓 API，会在此显示 API 状态并进入审批规划。</div><table className="w-full text-xs"><thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>名称</th><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>类型/市场</th><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>API/库存联动</th><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>地址</th><th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th></tr></thead><tbody>{whs.map((w: any) => <tr key={w.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}><td className="py-2" style={{ color: 'var(--color-fg)' }}>{w.name}</td><td className="py-2" style={{ color: 'var(--color-muted)' }}>{optionLabel(warehouse_service_types, w.service_type)} · {w.market_scope || '未限定'}</td><td className="py-2" style={{ color: 'var(--color-muted)' }}>{optionLabel(warehouse_integration_statuses, w.integration_status)} / {optionLabel(warehouse_inventory_sync_modes, w.inventory_sync_mode)}</td><td className="py-2" style={{ color: 'var(--color-muted)' }}>{[w.city, w.address].filter(Boolean).join(' ')}</td><td className="py-2"><button onClick={() => void del(w)} className="text-[var(--color-danger)]"><Trash2 className="w-3 h-3" /></button></td></tr>)}</tbody></table></CardContent></Card>
}

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes('@')) return value || ''
  const [name, domain] = value.split('@')
  const prefix = name.slice(0, Math.min(2, name.length))
  return `${prefix}${'•'.repeat(Math.max(3, name.length - prefix.length))}@${domain}`
}

function optionLabel(options: { id: string; label: string }[], value?: string) {
  return options.find(item => item.id === value)?.label || value || '未设置'
}
