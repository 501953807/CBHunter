import { Activity, Check, ChevronDown, Palette, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
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
  const { theme, setTheme, presets } = useTheme()
  const [netStatus, setNetStatus] = useState<NetworkStatus | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!themeOpen) return undefined
    const handler = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [themeOpen])

  const statuses = syncData?.data ?? []
  const anyError = statuses.some((s) => s.last_sync_status === 'failed')
  const connectedCount = statuses.filter((s) => s.last_sync_status === 'success').length
  const networkLabel = netStatus?.overseas ? '网络状态：外网可达' : netStatus?.domestic ? '网络状态：仅内网' : '网络状态：离线'

  return (
    <header className="luxury-header frosted flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-hairline)] px-5 shadow-[var(--shadow-sm)] transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold tracking-tight text-[var(--color-fg)]">{title || 'CBHunter'}</h2>
          <span className="hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)] sm:inline-flex">V5 UI</span>
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
        <div ref={themeMenuRef} className="relative" data-ui="theme-preset-select">
          <button
            type="button"
            onClick={() => setThemeOpen(open => !open)}
            className="luxury-control luxury-theme-select inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-[var(--color-muted)]"
            title="Theme preset"
            aria-haspopup="menu"
            aria-expanded={themeOpen}
          >
            <Palette className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span className="hidden font-medium xl:inline">Theme preset</span>
            <span className="max-w-[86px] truncate text-xs font-semibold text-[var(--color-fg)]">
              {presets.find(preset => preset.id === theme)?.label || '主题'}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${themeOpen ? 'rotate-180' : ''}`} />
          </button>
          {themeOpen && (
            <div className="theme-preset-menu absolute right-0 top-full z-50 mt-2 w-[280px] rounded-[var(--radius-xl)] p-2 shadow-[var(--shadow-lg)]" role="menu" aria-label="Theme preset">
              <div className="px-2 pb-2 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Theme preset</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">切换全局背景、卡片、文字、状态和侧栏配色。</p>
              </div>
              <div className="space-y-1">
                {presets.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === preset.id}
                    onClick={() => {
                      setTheme(preset.id)
                      setThemeOpen(false)
                    }}
                    className="theme-preset-option flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-left transition-all"
                    data-active={theme === preset.id ? 'true' : 'false'}
                    data-theme-option={preset.id}
                  >
                    <span className="theme-preset-swatch h-8 w-8 shrink-0 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--color-fg)]">{preset.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--color-muted)]">{preset.description}</span>
                    </span>
                    {theme === preset.id && <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => syncMutation.mutate(undefined)}
          disabled={syncMutation.isPending}
          className="luxury-control inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[var(--color-muted)] transition hover:-translate-y-0.5 hover:text-[var(--color-primary)] disabled:opacity-50"
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
    <div title={title} className="luxury-control hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:flex" style={{ color }}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}
