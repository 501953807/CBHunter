import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldCheck, Store, Users } from 'lucide-react'
import {
  getAccessControl,
  updateUserRoles,
  updateUserStores,
  type AccessControlMatrix,
  type AccessUser,
} from '../../api/settings'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'

export function AccessControlSettings({ toast }: { toast: any }) {
  const [matrix, setMatrix] = useState<AccessControlMatrix | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<AccessControlMatrix> | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accessControlError, setAccessControlError] = useState('')

  const load = async () => {
    setLoading(true)
    setAccessControlError('')
    try {
      const res = await getAccessControl()
      const data = res.data || null
      setMatrix(data)
      setEvidence(res)
      const first = data?.users?.[0]
      if (first) selectUser(first, data)
    } catch (e: any) {
      logger.error('Load access control failed', e)
      setAccessControlError(e?.response?.data?.detail || e?.message || '权限授权加载失败，请检查接口服务后重试。')
      toast.addToast('error', '权限授权加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectedUser = useMemo(
    () => matrix?.users.find(item => item.id === selectedUserId) || null,
    [matrix, selectedUserId]
  )
  const roleMap = useMemo(() => new Map((matrix?.roles || []).map(item => [item.id, item])), [matrix])
  const permissionMap = useMemo(() => new Map((matrix?.permissions || []).map(item => [item.code, item])), [matrix])
  const selectedPermissionCodes = useMemo(
    () => Array.from(new Set(roleIds.flatMap(id => roleMap.get(id)?.permissions || []))).sort(),
    [roleIds, roleMap]
  )
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, number> = {}
    for (const code of selectedPermissionCodes) {
      const module = code.split('.')[0] || 'system'
      groups[module] = (groups[module] || 0) + 1
    }
    return Object.entries(groups)
  }, [selectedPermissionCodes])

  const selectUser = (user: AccessUser, data = matrix) => {
    setSelectedUserId(user.id)
    setRoleIds([...(user.role_ids || data?.user_roles?.[user.id] || [])])
    setStoreIds([...(user.store_ids || data?.user_stores?.[user.id] || [])])
  }

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value])
  }

  const save = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      await updateUserRoles(selectedUser.username, roleIds)
      await updateUserStores(selectedUser.username, storeIds)
      toast.addToast('success', '授权已保存')
      await load()
    } catch (e: any) {
      logger.error('Save access control failed', e)
      toast.addToast('error', e?.response?.data?.detail || '授权保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载...</div>
  }

  return (
    <div className="space-y-5">
      {accessControlError && (
        <div
          data-ui="access-control-error"
          className="rounded-2xl border px-4 py-3 text-sm flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
        >
          <span>{accessControlError}</span>
          <Button size="sm" variant="secondary" onClick={load}>重新加载权限授权</Button>
        </div>
      )}
      <EvidenceBanner evidence={evidence} />
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>用户</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(matrix?.users || []).map(user => (
            <button key={user.id} onClick={() => selectUser(user)}
              className="w-full text-left rounded-lg border px-3 py-2 transition-all hover:shadow-sm"
              style={{
                borderColor: selectedUserId === user.id ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: selectedUserId === user.id ? 'var(--color-primary-light)' : 'var(--color-bg)',
              }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{user.display_name || user.username}</span>
                {user.is_admin && <Badge variant="success">管理员</Badge>}
              </div>
              <div className="text-xs mt-1 truncate" style={{ color: 'var(--color-muted)' }}>{user.email}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>角色权限</h2>
              </div>
              <Button size="sm" onClick={save} disabled={!selectedUser || saving}>{saving ? '保存中' : '保存授权'}</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {(matrix?.roles || []).map(role => (
                <label key={role.id} className="rounded-lg border p-3 cursor-pointer" style={{ borderColor: roleIds.includes(role.id) ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggle(role.id, roleIds, setRoleIds)} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{role.name}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{dataScopeLabel(role.data_scope)} · {role.permissions.length} 项权限</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {groupedPermissions.map(([module, count]) => <Badge key={module} variant="outline">{module}: {count}</Badge>)}
              {groupedPermissions.length === 0 && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>未分配角色权限</span>}
            </div>
            {selectedPermissionCodes.length > 0 && (
              <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">已选角色包含的权限明细</p>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {selectedPermissionCodes.map(code => {
                    const permission = permissionMap.get(code)
                    return (
                      <div key={code} className="rounded-md bg-[var(--color-surface)] px-2 py-1.5">
                        <p className="text-xs text-[var(--color-fg)]">{String(permission?.label || code)}</p>
                        <p className="text-[11px] text-[var(--color-muted)]">{code}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>店铺授权</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {(matrix?.stores || []).map(store => (
                <label key={store.id} className="rounded-lg border p-3 cursor-pointer" style={{ borderColor: storeIds.includes(store.id) ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={storeIds.includes(store.id)} onChange={() => toggle(store.id, storeIds, setStoreIds)} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{store.account_name}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{store.platform}{store.shop_id ? ` · ${store.shop_id}` : ''}</div>
                    </div>
                  </div>
                </label>
              ))}
              {(matrix?.stores || []).length === 0 && (
                <div className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无平台店铺，请先在平台账号中配置。</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}

function dataScopeLabel(scope: string) {
  if (scope === 'all') return '全部数据'
  if (scope === 'assigned') return '授权店铺'
  if (scope === 'own') return '本人数据'
  return scope || '未设置范围'
}
