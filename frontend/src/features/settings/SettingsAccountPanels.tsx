import { useEffect, useState } from "react"
import { Check, ChevronDown, ChevronUp, Cloud, Cpu, CreditCard, Edit3, LockKeyhole, Plus, Settings2, Terminal, Trash2, User, X } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { Input } from "../../components/ui/Input"
import { createUser, deleteUser, getMyProviders, listProviders, listUsers, saveMyProviders, updateUser, updateUserPassword } from "../../api/settings"
import { logger } from "../../utils/logger"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"
import { AIProviderTaskMatrix } from "./AIProviderTaskMatrix"

export function ProfileSettings({ toast }: { toast: any }) {
  const confirmAction = useConfirm()
  const [users, setUsers] = useState<any[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<any[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', display_name: '', password: '' })
  const [pwTarget, setPwTarget] = useState<string | null>(null)
  const [pwForm, setPwForm] = useState({ new1: '', new2: '' })

  const loadUsers = async () => {
    setLoading(true)
    try { const r = await listUsers(); setUsers(r.data || []); setEvidence(r) } catch (e: any) { logger.error('Load users failed', e); setUsers([]) }
    setLoading(false)
  }
  useEffect(() => { loadUsers() }, [])

  const handleSave = async () => {
    try {
      if (adding) {
        await createUser(form)
        toast.addToast('success', '账号已创建')
        setAdding(false)
      } else {
        await updateUser(editing!, { display_name: form.display_name, email: form.email })
        toast.addToast('success', '已保存')
        setEditing(null)
      }
      setForm({ username: '', email: '', display_name: '', password: '' })
      loadUsers()
    } catch (e: any) { logger.error('Save user failed', e); toast.addToast('error', e?.response?.data?.detail || '保存失败') }
  }

  const handleDelete = async (username: string) => {
    const ok = await confirmAction({
      title: '删除系统账号',
      message: `确定删除账号「${username}」？删除后该用户将无法登录系统。`,
      confirmText: '删除账号',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteUser(username); toast.addToast('success', '已删除'); loadUsers() }
    catch (e: any) { logger.error('Delete user failed', e); toast.addToast('error', '删除失败') }
  }

  const handlePassword = async () => {
    if (pwForm.new1 !== pwForm.new2) { toast.addToast('error', '两次密码不一致'); return }
    if (pwForm.new1.length < 6) { toast.addToast('error', '密码至少6位'); return }
    try { await updateUserPassword(pwTarget!, pwForm.new1); toast.addToast('success', '密码已修改'); setPwTarget(null) }
    catch (e: any) { logger.error('Update user password failed', e); toast.addToast('error', '密码修改失败') }
  }

  if (loading) return <div className="text-sm text-[var(--color-muted)] py-8 text-center">加载中...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>账号列表 ({users.length})</h2>
            </div>
            {!adding && (
              <button onClick={() => { setAdding(true); setForm({ username: '', email: '', display_name: '', password: '' }) }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-[var(--color-primary-text)]" style={{ background: 'var(--gradient-accent)' }}>
                <Plus className="w-3 h-3" /> 新建账号
              </button>
            )}
          </div>
        </CardHeader>
        <div className="px-6"><EvidenceBanner evidence={evidence} compact /></div>
        <CardContent>
          {adding && (
            <div className="mb-4 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <input className="text-xs border rounded px-2 py-1.5" placeholder="用户名" value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-surface)' }} />
                <input className="text-xs border rounded px-2 py-1.5" placeholder="邮箱" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-surface)' }} />
                <input className="text-xs border rounded px-2 py-1.5" placeholder="显示名称" value={form.display_name}
                  onChange={e => setForm({...form, display_name: e.target.value})}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-surface)' }} />
                <input className="text-xs border rounded px-2 py-1.5" type="password" placeholder="密码" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-surface)' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs px-3 py-1 rounded bg-[var(--color-success)] text-[var(--color-primary-text)]"><Check className="w-3 h-3 inline mr-1" />保存</button>
                <button onClick={() => { setAdding(false); setForm({ username: '', email: '', display_name: '', password: '' }) }}
                  className="text-xs px-3 py-1 rounded border" style={{ borderColor: 'var(--color-border)' }}>取消</button>
              </div>
            </div>
          )}
          <table className="professional-table w-full text-sm">
            <thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>用户名</th>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>显示名称</th>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>邮箱</th>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>状态</th>
              <th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
            </tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.username} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {editing === u.username ? (
                    <>
                      <td className="py-2 pr-3"><input className="text-xs border rounded px-2 py-1 w-full" value={form.username || u.username} disabled style={{ borderColor: 'var(--color-border)' }} /></td>
                      <td className="py-2 pr-3"><input className="text-xs border rounded px-2 py-1 w-full" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} /></td>
                      <td className="py-2 pr-3"><input className="text-xs border rounded px-2 py-1 w-full" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} /></td>
                      <td className="py-2 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded ${u.is_active ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>{u.is_active ? '激活' : '停用'}</span></td>
                      <td className="py-2 flex gap-1">
                        <button onClick={handleSave} className="text-[var(--color-success)]"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditing(null)} className="text-[var(--color-muted)]"><X className="w-3.5 h-3.5" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-3 font-medium" style={{ color: 'var(--color-fg)' }}>{u.username}</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--color-fg)' }}>{u.display_name || '-'}</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--color-muted)' }}>{u.email}</td>
                      <td className="py-2 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded ${u.is_active ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>{u.is_active ? '激活' : '停用'}</span></td>
                      <td className="py-2 flex items-center gap-1.5">
                        <button onClick={() => { setEditing(u.username); setForm({ username: u.username, email: u.email, display_name: u.display_name || '', password: '' }) }} className="text-[var(--color-primary)]" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setPwTarget(u.username); setPwForm({ new1: '', new2: '' }) }} className="text-[var(--color-warning)]" title="修改密码"><LockKeyhole className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(u.username)} className="text-[var(--color-danger)]" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {pwTarget && (
        <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50" onClick={() => setPwTarget(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>修改密码 — {pwTarget}</h3>
            <Input label="新密码" id="pw1" type="password" value={pwForm.new1} onChange={e => setPwForm({...pwForm, new1: e.target.value})} />
            <Input label="确认新密码" id="pw2" type="password" value={pwForm.new2} onChange={e => setPwForm({...pwForm, new2: e.target.value})} />
            <div className="flex gap-2"><button onClick={handlePassword} className="flex-1 py-2 rounded-lg text-[var(--color-primary-text)] text-sm" style={{ background: 'var(--gradient-accent)' }}>确认修改</button><button onClick={() => setPwTarget(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-border)' }}>取消</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AIProviderSettings({ toast }: { toast: any }) {
  const [providers, setProviders] = useState<any[]>([])
  const [userConfig, setUserConfig] = useState<Record<string, any>>({})
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      try {
        const [pr, uc] = await Promise.all([listProviders(), getMyProviders()])
        const raw = pr.data
        const list = Array.isArray(raw) ? raw : (raw?.providers || raw?.data || [])
        setProviders(list)
        setEvidence(pr)
        if (uc.data) {
          const ucData = uc.data
          setUserConfig(ucData.providers || ucData || {})
        }
      } catch (e: any) {
        logger.error('Load providers failed', e)
      }
      setLoading(false)
    })()
  }, [])
  const toggle = async (pid: string, en: boolean) => {
    const c = { ...userConfig, [pid]: { ...(userConfig[pid] || {}), enabled: en } }
    setUserConfig(c)
    try {
      await saveMyProviders(c)
      toast.addToast('success', `${en ? '启用' : '禁用'}成功`)
    } catch (e: any) {
      logger.error('Save provider toggle failed', e)
      toast.addToast('error', '保存失败')
    }
  }
  const setPri = async (pid: string, pri: number) => {
    const c = { ...userConfig, [pid]: { ...(userConfig[pid] || {}), priority: pri, enabled: true } }
    setUserConfig(c)
    try { await saveMyProviders(c) } catch (e: any) { logger.error('Save provider priority failed', e) }
  }
  const providerIcon = (type: string) => type === 'cli' ? Terminal : type === 'free_api' ? Cloud : type === 'paid_api' ? CreditCard : Settings2
  if (loading) return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载引擎列表...</div>
  if (providers.length === 0) return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>暂无AI引擎 — 请确保后端已初始化 provider 数据。在终端运行: python -m app.services.provider_service</div>
  return <div className="space-y-4">
    <div className="flex items-center gap-2"><Cpu className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /><span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>按优先级排序，启用/禁用控制调用链</span></div>
    <EvidenceBanner evidence={evidence} compact />
    <AIProviderTaskMatrix />
    <Card><CardContent><div className="space-y-1">
      {[...providers].sort((a, b) => { const pa = userConfig[a.id]?.priority ?? a.user_priority ?? a.priority; const pb = userConfig[b.id]?.priority ?? b.user_priority ?? b.priority; return pa == null ? 1 : pb == null ? -1 : pa - pb }).map(p => {
        const uc = userConfig[p.id] || {}
        const en = (uc.enabled ?? p.user_enabled) !== false
        const pri = uc.priority ?? p.user_priority ?? p.priority
        const ProviderIcon = providerIcon(p.type)
        const status = providerStatus(en, Boolean(p.available), p.needs_key)
        return <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ opacity: en ? 1 : 0.4, backgroundColor: 'var(--color-bg)' }}>
          <div className="flex items-center gap-0.5 shrink-0" title={pri == null ? '未设置优先级' : `第 ${pri} 优先级`}><button disabled={pri == null} onClick={() => pri != null && setPri(p.id, Math.max(1, pri - 1))} className="text-[var(--color-muted)] disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button><span className="w-10 text-center text-[11px]" style={{ color: 'var(--color-fg)' }}>{pri == null ? '--' : `优先${pri}`}</span><button disabled={pri == null} onClick={() => pri != null && setPri(p.id, pri + 1)} className="text-[var(--color-muted)] disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button></div>
          <ProviderIcon className="w-4 h-4 text-[var(--color-primary)]" /><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{p.name}</p><p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{p.description || p.type}</p></div>
          <button onClick={() => toggle(p.id, !en)} className={`text-xs px-3 py-1 rounded-full font-medium ${status.className}`} title={status.title}>{status.label}</button>
        </div>
      })}
    </div></CardContent></Card>
  </div>
}

function providerStatus(enabled: boolean, available: boolean, needsKey?: string | null) {
  if (!enabled) {
    return { label: '已禁用', className: 'bg-[var(--color-bg)] text-[var(--color-muted)]', title: '当前用户调用链未启用此引擎' }
  }
  if (available) {
    return { label: '已启用且可用', className: 'bg-[var(--color-success-light)] text-[var(--color-success)]', title: '系统检测到该引擎可调用' }
  }
  return {
    label: '已启用但待配置',
    className: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
    title: needsKey ? '缺少该引擎所需的接口密钥配置' : '系统检测到该引擎暂不可调用',
  }
}
