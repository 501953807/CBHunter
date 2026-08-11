import { useEffect, useState } from 'react'
import { History, Plus, RefreshCw, ShieldCheck, Trash2, Store } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { useConfirm } from '../components/ui/ConfirmDialog'
import {
  useCreatePlatform,
  useDeletePlatform,
  usePlatforms,
  usePlatformStatuses,
  useUpdatePlatformAuthorization,
} from '../hooks/usePlatforms'
import { useTriggerSync } from '../hooks/useSync'
import { useToast } from '../components/ui/Toast'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import type { PlatformIntegrationStatus } from '../api/platforms'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { getSyncLogs, type SyncLogItem } from '../api/sync'
import type { ApiResponse } from '../types/common'

function statusBadge(status?: PlatformIntegrationStatus) {
  if (!status) return { variant: 'default' as const, label: '状态加载中' }
  if (!status.account_active) return { variant: 'default' as const, label: '已停用' }
  if (!status.credentials_stored) return { variant: 'warning' as const, label: '配置不完整' }
  if (status.connection_status === 'authorization_required') return { variant: 'warning' as const, label: '待店铺授权' }
  if (status.connection_status === 'authorization_expired') return { variant: 'danger' as const, label: '授权过期' }
  if (status.connection_status === 'scope_insufficient') return { variant: 'warning' as const, label: '授权权限不足' }
  if (status.sync_ready) return { variant: 'success' as const, label: 'API 可同步' }
  if (status.connection_status === 'unverified') return { variant: 'info' as const, label: '凭证待验证' }
  return { variant: 'info' as const, label: 'API 待接通' }
}

export default function PlatformSettingsPage() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const { platforms } = useConfig()
  const { data: platformsData } = usePlatforms()
  const { data: statusData } = usePlatformStatuses()
  const createPlatform = useCreatePlatform()
  const deletePlatform = useDeletePlatform()
  const updateAuthorization = useUpdatePlatformAuthorization()
  const syncMutation = useTriggerSync()

  const accounts = platformsData?.data ?? []
  const statuses = statusData?.data ?? []

  const [showConnect, setShowConnect] = useState<string | null>(null)
  const [authorizationAccountId, setAuthorizationAccountId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [authForm, setAuthForm] = useState<Record<string, string>>({})
  const [syncLogs, setSyncLogs] = useState<ApiResponse<SyncLogItem[]> | null>(null)

  useEffect(() => {
    getSyncLogs(undefined, 1)
      .then(setSyncLogs)
      .catch(error => logger.error('Failed to load platform sync logs', error))
  }, [accounts.length])

  const displayPlatforms = platforms.filter((p) => p.credential_fields?.length)
  const currentPlatform = displayPlatforms.find((p) => p.id === showConnect)
  const authorizationAccount = accounts.find((item) => item.id === authorizationAccountId)
  const authorizationSummary = buildPlatformAuthorizationSummary(displayPlatforms, accounts, statuses)

  const getPlatformAccounts = (platform: string) =>
    accounts.filter((a) => a.platform === platform)

  const handleConnect = async () => {
    if (!showConnect || !form.account_name) {
      toast.addToast('error', '请填写账号名称')
      return
    }
    try {
      await createPlatform.mutateAsync({
        platform: showConnect,
        account_name: form.account_name,
        shop_id: form.shop_id || undefined,
        api_key: form.api_key || undefined,
        api_secret: form.api_secret || undefined,
      })
      setShowConnect(null)
      setForm({})
    } catch (error) {
      logger.error('Failed to submit platform account form', error)
    }
  }

  const openAuthorizationModal = (accountId: string, status?: PlatformIntegrationStatus) => {
    setAuthorizationAccountId(accountId)
    setAuthForm({
      access_token: '',
      refresh_token: '',
      token_expires_at: toDateTimeLocal(status?.authorization?.token_expires_at),
      token_scopes: status?.authorization?.token_scopes?.join(', ') || '',
    })
  }

  const handleAuthorizationSave = async () => {
    if (!authorizationAccountId || !authForm.access_token || !authForm.refresh_token) {
      toast.addToast('error', '请填写 Access Token 和 Refresh Token')
      return
    }
    const expiresAt = authForm.token_expires_at ? new Date(authForm.token_expires_at) : null
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      toast.addToast('error', '令牌有效期格式不正确')
      return
    }
    try {
      await updateAuthorization.mutateAsync({
        id: authorizationAccountId,
        data: {
          access_token: authForm.access_token,
          refresh_token: authForm.refresh_token,
          token_expires_at: expiresAt ? expiresAt.toISOString() : undefined,
          token_scopes: parseScopes(authForm.token_scopes),
        },
      })
      setAuthorizationAccountId(null)
      setAuthForm({})
    } catch (error) {
      logger.error('Failed to submit platform authorization form', error)
    }
  }

  const handleDeletePlatform = async (account: { id: string; account_name: string; platform: string }) => {
    const ok = await confirmAction({
      title: '删除平台店铺配置',
      message: `确认删除店铺「${account.account_name}」？删除后该店铺的同步、订单、商品 Listing 和授权状态将无法继续使用。`,
      confirmText: '确认删除店铺',
      tone: 'danger',
    })
    if (ok) deletePlatform.mutate(account.id)
  }

  return (
    <div className="platform-settings-shell page-enter">
      <section className="platform-settings-hero" aria-label="平台接入总览">
        <div className="platform-settings-hero-content">
          <span className="platform-settings-eyebrow">MULTI-PLATFORM ACCESS</span>
          <h1 className="platform-settings-title">平台接入与店铺授权</h1>
          <p className="platform-settings-subtitle">
            统一管理 Shopee、TEMU、TikTok Shop 的店铺凭证、OAuth 授权、同步就绪状态和最近执行结果；API Key 不等同于店铺授权。
          </p>
        </div>
        <div className="platform-settings-action-row">
          <Badge variant={authorizationSummary.syncReadyCount ? 'success' : 'warning'}>
            {authorizationSummary.syncReadyCount ? '已有可同步店铺' : '授权待补齐'}
          </Badge>
          <span>{authorizationSummary.accountCount} 个店铺配置</span>
          <span>{authorizationSummary.platformEntryCount} 个平台入口</span>
        </div>
      </section>

      <EvidenceBanner evidence={statusData || platformsData} />

      <section
        className="platform-settings-governance-panel"
        data-ui="platform-authorization-governance-summary"
        aria-label="平台授权治理摘要"
      >
        <div className="platform-settings-section-heading">
          <div>
            <h2>平台、店铺与授权治理摘要</h2>
            <p>
              这里只统计已保存店铺、凭证状态、OAuth 授权状态和同步就绪状态；API Key 不等同于店铺授权，未授权不会显示同步或发布成功。
            </p>
          </div>
          <Badge variant={authorizationSummary.syncReadyCount ? 'success' : 'warning'}>
            {authorizationSummary.syncReadyCount ? '已有可同步店铺' : '授权待补齐'}
          </Badge>
        </div>
        <div className="platform-settings-governance-grid">
          <PlatformAuthorizationMetric label="平台入口" value={authorizationSummary.platformEntryCount} />
          <PlatformAuthorizationMetric label="店铺配置" value={authorizationSummary.accountCount} />
          <PlatformAuthorizationMetric label="凭证完整" value={authorizationSummary.credentialsStoredCount} />
          <PlatformAuthorizationMetric label="已授权" value={authorizationSummary.authorizedCount} tone={authorizationSummary.authorizedCount ? 'success' : 'warning'} />
          <PlatformAuthorizationMetric label="权限缺口" value={authorizationSummary.authorizationGapCount} tone={authorizationSummary.authorizationGapCount ? 'warning' : 'success'} />
          <PlatformAuthorizationMetric label="可同步" value={authorizationSummary.syncReadyCount} tone={authorizationSummary.syncReadyCount ? 'success' : 'warning'} />
        </div>
        <div className="platform-settings-boundary-grid">
          {authorizationSummary.platformSummaries.map(item => (
            <button
              type="button"
              key={item.platform}
              onClick={() => setShowConnect(item.accountCount ? null : item.platform)}
              className="platform-settings-boundary-card"
            >
              <p className="platform-settings-boundary-title">{item.label}</p>
              <p>
                店铺 {item.accountCount} · 已授权 {item.authorizedCount} · 可同步 {item.syncReadyCount}
              </p>
              <p className={item.authorizationGapCount ? 'platform-settings-warning-text' : 'platform-settings-success-text'}>
                {item.authorizationGapCount ? `授权缺口 ${item.authorizationGapCount}` : '当前无授权缺口'}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="platform-settings-platform-grid" aria-label="平台店铺配置">
        {displayPlatforms.map((platform) => {
          const platformAccounts = getPlatformAccounts(platform.id)
          const guide = platformGuide(platform.id)
          return (
            <Card key={platform.id} className="platform-settings-platform-card">
              <CardHeader>
                <div className="platform-settings-platform-header">
                  <div className="platform-settings-platform-title-row">
                    <div className="platform-settings-platform-icon"
                      style={{ backgroundColor: platform.color }}>
                      {platform.icon}
                    </div>
                    <div>
                      <h3>{platform.label}</h3>
                      <p>{platformAccounts.length} 个账号配置</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setShowConnect(platform.id)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    添加店铺
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {platformAccounts.length === 0 ? (
                  <div className="platform-settings-empty-state">
                    <Store className="platform-settings-empty-icon" />
                    <p>暂无 {platform.label} 店铺配置</p>
                    <span>点击「添加店铺」开始配置</span>
                    <small>{guide.credentials}；{guide.steps}</small>
                  </div>
                ) : (
                  <div className="platform-settings-store-list">
                    {platformAccounts.map((acc) => {
                      const status = statuses.find((item) => item.account_id === acc.id)
                      const badge = statusBadge(status)
                      return (
                        <div key={acc.id} className="platform-settings-store-card">
                          <div className="platform-settings-store-main">
                            <Store className="platform-settings-store-icon" />
                            <div>
                              <p className="platform-settings-store-name">{acc.account_name}</p>
                              <p className="platform-settings-store-meta">
                                {acc.shop_id ? `ID: ${acc.shop_id} · ` : ''}
                                {acc.last_sync_at ? `最后同步: ${new Date(acc.last_sync_at).toLocaleString('zh-CN')}` : '尚未同步'}
                              </p>
                              {status?.message && <p className="platform-settings-store-message">{status.message}</p>}
                              {status?.authorization && (
                                <div className="platform-settings-token-panel" aria-label="店铺授权状态">
                                  <span>店铺授权：{authorizationStatusLabel(status.authorization_status)}</span>
                                  <span className="ml-2">令牌有效期：{status.authorization.token_expires_at ? new Date(status.authorization.token_expires_at).toLocaleString('zh-CN') : '未保存'}</span>
                                  <span className="ml-2">权限范围：{(status.authorization.token_scopes || []).length ? status.authorization.token_scopes?.join('、') : '未授权'}</span>
                                  {status.authorization.missing_scopes?.length ? <span className="ml-2 text-[var(--color-warning)]">缺少：{status.authorization.missing_scopes.join('、')}</span> : null}
                                </div>
                              )}
                              {status && (
                                <div className="platform-settings-sync-chip-row" aria-label="店铺同步状态回写">
                                  <span>
                                    最近商品同步：{syncStateText(status.last_product_sync_status, status.last_product_sync_at)}
                                  </span>
                                  <span>
                                    最近订单同步：{syncStateText(status.last_order_sync_status, status.last_order_sync_at)}
                                  </span>
                                </div>
                              )}
                              {status?.operation_details && <p className="platform-settings-store-message">待接通：{status.operation_details.filter(item => item.status !== 'implemented').map(item => item.label).join('、')}</p>}
                              {status?.next_action && <p className="platform-settings-warning-text">{status.next_action}</p>}
                            </div>
                          </div>
                          <div className="platform-settings-store-actions">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <button
                              onClick={() => openAuthorizationModal(acc.id, status)}
                              className="platform-settings-icon-button"
                              title="登记店铺 OAuth 授权"
                              aria-label="登记店铺 OAuth 授权"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => syncMutation.mutate(acc.id)}
                              disabled={!status?.sync_ready || syncMutation.isPending}
                              className="platform-settings-icon-button"
                              title={status?.sync_ready ? '同步此店铺' : status?.message || '接入状态加载中'}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => void handleDeletePlatform(acc)}
                              className="platform-settings-icon-button platform-settings-icon-button-danger"
                              title="删除账号配置"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card className="platform-settings-log-panel">
        <CardHeader><div className="platform-settings-log-title"><History className="w-4 h-4" /><h3>最近同步日志</h3></div></CardHeader>
        <CardContent>
          <EvidenceBanner evidence={syncLogs} compact />
          {!syncLogs?.data?.length ? <p className="platform-settings-log-empty">暂无真实同步执行记录</p> : (
            <div className="platform-settings-log-list">{syncLogs.data.map(log => (
              <div key={log.id} className="platform-settings-log-row">
                <div><p>{accounts.find(item => item.id === log.platform_account_id)?.account_name || log.platform_account_id}</p><span>{log.started_at ? new Date(log.started_at).toLocaleString('zh-CN') : '未记录开始时间'}</span></div>
                <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}>{log.status}</Badge>
                <span>处理 {log.records_processed ?? '--'} / 失败 {log.records_failed ?? '--'}</span>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>

      <Modal open={!!showConnect} onClose={() => setShowConnect(null)}
        title={`添加 ${currentPlatform?.label || ''} 店铺`}
        size="md">
        <div className="platform-settings-modal-form">
          {currentPlatform && (
            <div className="platform-settings-modal-note">
              <p>接入前准备</p>
              <span>{platformGuide(currentPlatform.id).credentials}</span>
              <span>{platformGuide(currentPlatform.id).steps}</span>
            </div>
          )}
          <Input label="店铺名称 *" id="name" value={form.account_name || ''}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            placeholder="例如：主营店 / 测试店" />
          {currentPlatform?.credential_fields?.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              id={f.key}
              type={f.type || 'text'}
              value={form[f.key] || ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
            />
          ))}
        </div>
        <div className="platform-settings-modal-actions">
          <Button variant="secondary" onClick={() => setShowConnect(null)}>取消</Button>
          <Button onClick={handleConnect} disabled={createPlatform.isPending}>
            {createPlatform.isPending ? '保存中...' : '保存账号配置'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!authorizationAccountId} onClose={() => setAuthorizationAccountId(null)}
        title={`登记店铺授权${authorizationAccount ? `：${authorizationAccount.account_name}` : ''}`}
        size="md">
        <div className="platform-settings-modal-form">
          <div className="platform-settings-modal-note">
            <p>用途说明</p>
            <span>这里仅保存已从官方 OAuth 流程取得的店铺访问令牌、刷新令牌和权限范围，用于判断订单/商品等同步是否具备真实授权。</span>
            <span>系统不会把 API Key 等同为店铺授权，也不会因为手工保存令牌而模拟平台同步成功。</span>
          </div>
          <Input label="Access Token *" id="access_token" type="password" value={authForm.access_token || ''}
            onChange={(e) => setAuthForm({ ...authForm, access_token: e.target.value })}
            placeholder="从平台 OAuth 授权结果复制" />
          <Input label="Refresh Token *" id="refresh_token" type="password" value={authForm.refresh_token || ''}
            onChange={(e) => setAuthForm({ ...authForm, refresh_token: e.target.value })}
            placeholder="从平台 OAuth 授权结果复制" />
          <Input label="令牌有效期" id="token_expires_at" type="datetime-local" value={authForm.token_expires_at || ''}
            onChange={(e) => setAuthForm({ ...authForm, token_expires_at: e.target.value })} />
          <Input label="权限范围" id="token_scopes" value={authForm.token_scopes || ''}
            onChange={(e) => setAuthForm({ ...authForm, token_scopes: e.target.value })}
            placeholder="例如：orders, products, publish" />
        </div>
        <div className="platform-settings-modal-actions">
          <Button variant="secondary" onClick={() => setAuthorizationAccountId(null)}>取消</Button>
          <Button onClick={handleAuthorizationSave} disabled={updateAuthorization.isPending}>
            {updateAuthorization.isPending ? '保存中...' : '保存授权令牌'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function parseScopes(value?: string) {
  return (value || '')
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function syncStateText(status?: string | null, at?: string | null) {
  if (!status) return '暂无回写'
  const time = at ? ` · ${new Date(at).toLocaleString('zh-CN')}` : ''
  return `${status}${time}`
}

function authorizationStatusLabel(status?: string | null) {
  if (status === 'authorized') return '已授权'
  if (status === 'expired') return '令牌过期'
  if (status === 'scope_insufficient') return '权限不足'
  return '待店铺授权'
}

function buildPlatformAuthorizationSummary(
  platforms: Array<{ id: string; label: string }>,
  accounts: Array<{ id: string; platform: string }>,
  statuses: PlatformIntegrationStatus[],
) {
  const statusByAccount = new Map(statuses.map(status => [status.account_id, status]))
  const platformSummaries = platforms.map(platform => {
    const platformAccounts = accounts.filter(account => account.platform === platform.id)
    const platformStatuses = platformAccounts.map(account => statusByAccount.get(account.id)).filter((item): item is PlatformIntegrationStatus => Boolean(item))
    return {
      platform: platform.id,
      label: platform.label,
      accountCount: platformAccounts.length,
      authorizedCount: platformStatuses.filter(isAuthorizedStatus).length,
      syncReadyCount: platformStatuses.filter(status => status.sync_ready).length,
      authorizationGapCount: platformAccounts.length - platformStatuses.filter(isAuthorizedStatus).length,
    }
  })
  return {
    platformEntryCount: platforms.length,
    accountCount: accounts.length,
    credentialsStoredCount: statuses.filter(status => status.credentials_stored).length,
    authorizedCount: statuses.filter(isAuthorizedStatus).length,
    authorizationGapCount: statuses.filter(status => !isAuthorizedStatus(status)).length + Math.max(0, accounts.length - statuses.length),
    syncReadyCount: statuses.filter(status => status.sync_ready).length,
    platformSummaries,
  }
}

function isAuthorizedStatus(status?: PlatformIntegrationStatus) {
  return status?.authorization_status === 'authorized'
}

function PlatformAuthorizationMetric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
  const color = tone === 'success'
    ? 'var(--color-success)'
    : tone === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-fg)'
  return (
    <div className="platform-settings-metric-card">
      <div className="platform-settings-metric-label">{label}</div>
      <div className="platform-settings-metric-value" style={{ color }}>{value}</div>
    </div>
  )
}

function platformGuide(platformId: string) {
  const guides: Record<string, { credentials: string; steps: string }> = {
    shopee: {
      credentials: '需要 Shopee Partner 平台的 Partner ID、Partner Key、店铺授权和回调地址。',
      steps: '先完成主体认证与应用创建，再授权测试店铺；当前系统会明确显示凭证完整度和 Open API 接入状态。',
    },
    temu: {
      credentials: '需要 TEMU 开放平台应用凭证、店铺授权信息和接口权限。',
      steps: '先完成商家/开发者认证并申请订单、商品、履约相关接口权限；未接通前不会模拟同步成功。',
    },
    tiktok: {
      credentials: '需要 TikTok Shop Open API 应用凭证、授权店铺和回调地址。',
      steps: '先创建应用、配置回调并完成店铺 OAuth 授权；系统仅在真实凭证和适配器就绪后开放同步。',
    },
  }
  return guides[platformId] || {
    credentials: '需要平台开放接口应用凭证、店铺授权和回调地址。',
    steps: '请先完成平台官方开发者申请，再在系统中保存店铺配置。',
  }
}
