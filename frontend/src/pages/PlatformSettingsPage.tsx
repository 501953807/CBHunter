import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
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
import {
  PlatformAccessHero,
  PlatformAccountGrid,
  PlatformAuthorizationGovernancePanel,
  PlatformSyncLogPanel,
  buildPlatformAuthorizationSummary,
  platformGuide,
} from '../features/settings/PlatformSettingsPageParts'

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
      <PlatformAccessHero authorizationSummary={authorizationSummary} />

      <EvidenceBanner evidence={statusData || platformsData} />

      <PlatformAuthorizationGovernancePanel
        authorizationSummary={authorizationSummary}
        onOpenPlatform={setShowConnect}
      />

      <PlatformAccountGrid
        accounts={accounts}
        displayPlatforms={displayPlatforms}
        onDeletePlatform={(account) => void handleDeletePlatform(account)}
        onOpenAuthorization={openAuthorizationModal}
        onOpenConnect={setShowConnect}
        onSyncAccount={(accountId) => syncMutation.mutate(accountId)}
        statuses={statuses}
        syncPending={syncMutation.isPending}
      />

      <PlatformSyncLogPanel accounts={accounts} syncLogs={syncLogs} />

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
