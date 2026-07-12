import { Activity, Moon, RefreshCw, ShieldCheck, Sun, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSyncStatus, useTriggerSync } from '../../hooks/useSync'
import { useTheme } from '../../contexts/ThemeContext'
import { getNetworkStatus } from '../../api/system'
import type { NetworkStatus } from '../../types/sourcing'
import { NotificationBell } from './NotificationBell'
import { logger } from '../../utils/logger'

export function Header({ title }: { title?: string }) {
  const { data: syncData } = useSyncStatus()
  const syncMutation = useTriggerSync()
  const { theme, toggle } = useTheme()
  const [netStatus, setNetStatus] = useState<NetworkStatus | null>(null)

  const loadNetworkStatus = () => {
    getNetworkStatus()
      .then(r => setNetStatus(r.data))
      .catch((e: any) => logger.error('网络状态加载失败', e))
  }

  useEffect(() => {
    loadNetworkStatus()
    const iv = setInterval(loadNetworkStatus, 60000)
    return () => clearInterval(iv)
  }, [])

  const statuses = syncData?.data ?? []
  const anyError = statuses.some((s) => s.last_sync_status === 'failed')
  const connectedCount = statuses.filter((s) => s.last_sync_status === 'success').length
  const networkLabel = netStatus?.overseas ? '外网可达' : netStatus?.domestic ? '仅内网' : '离线'

  return (
    <header className="h-16 frosted border-b border-[var(--color-border)] flex items-center justify-between gap-4 px-5 shrink-0 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold text-[var(--color-fg)]">{title || 'CBHunter'}</h2>
          <span className="hidden rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted)] sm:inline-flex">V2</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <span>跨境运营工作台</span>
          <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
          <span>已配置平台 {statuses.length}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <StatusChip title={networkLabel} tone={netStatus?.overseas ? 'success' : 'warning'}
          icon={netStatus?.overseas ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          label={networkLabel} />
        <StatusChip title={anyError ? '存在同步失败' : '同步状态正常'} tone={anyError ? 'danger' : 'success'}
          icon={anyError ? <Activity className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          label={anyError ? '同步异常' : `同步 ${connectedCount}/${statuses.length}`} />
        <div className="hidden max-w-[260px] items-center gap-2 overflow-hidden lg:flex">
          {statuses.slice(0, 4).map((s) => (
            <div key={s.account_id} className="flex min-w-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)]">
              <span className="truncate text-[11px] font-medium">{s.platform.toUpperCase()}</span>
              <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                s.last_sync_status === 'success' ? 'bg-[var(--color-success)]'
                  : s.last_sync_status === 'failed' ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-border)]'
              }`} />
            </div>
          ))}
        </div>
        <div className="h-5 w-px bg-[var(--color-border)]" />
        <NotificationBell />
        <button
          onClick={toggle}
          className="rounded-md border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          title={theme === 'light' ? '切换深色模式' : '切换亮色模式'}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <button
          onClick={() => syncMutation.mutate(undefined)}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-2 text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
          title="同步所有平台订单、商品、物流和刊登状态"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          <span className="hidden text-xs font-medium xl:inline">平台同步</span>
        </button>
      </div>
    </header>
  )
}

function StatusChip({ title, label, icon, tone }: { title: string; label: string; icon: ReactNode; tone: 'success' | 'warning' | 'danger' }) {
  const color = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <div title={title} className="hidden items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs sm:flex" style={{ color }}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}
