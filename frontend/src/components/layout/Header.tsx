import { Activity, BarChart3, CalendarDays, Check, ChevronRight, FileText, Languages, LogOut, Maximize2, Monitor, Moon, Palette, Plus, RefreshCw, RotateCcw, Settings2, ShieldCheck, Star, Sun, UserRound, Wifi, WifiOff, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSyncStatus, useTriggerSync } from '../../hooks/useSync'
import { useTheme } from '../../contexts/ThemeContext'
import { getNetworkStatus } from '../../api/system'
import { getMe, type UserInfo } from '../../api/auth'
import type { NetworkStatus } from '../../types/sourcing'
import { NotificationBell } from './NotificationBell'
import { logger } from '../../utils/logger'
import { storage } from '../../utils/storage'

export function Header({ title }: { title?: string }) {
  const navigate = useNavigate()
  const { data: syncData } = useSyncStatus()
  const syncMutation = useTriggerSync()
  const { theme, setTheme, presets } = useTheme()
  const [netStatus, setNetStatus] = useState<NetworkStatus | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const shortcutMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  const loadNetworkStatus = () => {
    getNetworkStatus()
      .then(r => setNetStatus(r.data))
      .catch((error: unknown) => logger.error('网络状态加载失败', error))
  }

  useEffect(() => {
    loadNetworkStatus()
    const iv = setInterval(loadNetworkStatus, 60000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    getMe()
      .then(r => setUser(r.data ?? null))
      .catch((error: unknown) => logger.error('当前用户信息加载失败', error))
  }, [])

  useEffect(() => {
    if (!languageOpen && !themeOpen && !shortcutOpen && !profileOpen) return undefined
    const handler = (event: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) setLanguageOpen(false)
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) setThemeOpen(false)
      if (shortcutMenuRef.current && !shortcutMenuRef.current.contains(event.target as Node)) setShortcutOpen(false)
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [languageOpen, themeOpen, shortcutOpen, profileOpen])

  const statuses = syncData?.data ?? []
  const anyError = statuses.some((s) => s.last_sync_status === 'failed')
  const connectedCount = statuses.filter((s) => s.last_sync_status === 'success').length
  const networkLabel = netStatus?.overseas ? '网络状态：外网可达' : netStatus?.domestic ? '网络状态：仅内网' : '网络状态：离线'
  const displayName = user?.display_name || user?.username || 'admin'
  const userInitial = displayName.slice(0, 1).toUpperCase()

  const logout = () => {
    storage.remove('token')
    navigate('/login', { replace: true })
  }

  const themeMode = theme === 'dark-luxury' ? 'dark' : theme === 'warm-luxury' ? 'system' : 'light'

  return (
    <header className="layout-navbar luxury-header materio-topbar frosted">
      <div className="navbar-content-container">
      <div className="header-title-block min-w-[180px]">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-[var(--color-fg)]">{title || 'CBHunter'}</h2>
          <span className="hidden rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary)] sm:inline-flex">V5</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <span>跨境运营工作台</span>
          <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
          <span>已配置平台 {statuses.length}</span>
        </div>
      </div>

      <div className="navbar-action-cluster">
        <button type="button" className="materio-navbar-action" title={networkLabel}>
          {netStatus?.overseas ? <Wifi className="h-4 w-4 text-[var(--color-success)]" /> : <WifiOff className="h-4 w-4 text-[var(--color-warning)]" />}
        </button>
        <button type="button" className="materio-navbar-action" title={anyError ? '存在同步失败' : `同步状态正常：${connectedCount}/${statuses.length}`}>
          {anyError ? <Activity className="h-4 w-4 text-[var(--color-danger)]" /> : <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />}
          {statuses.length > 0 && <span className="materio-action-badge tone-info">{connectedCount}</span>}
        </button>
        <div ref={languageMenuRef} className="relative" data-ui="language-menu-select">
          <button
            type="button"
            className="materio-navbar-action"
            title="语言切换"
            aria-haspopup="menu"
            aria-expanded={languageOpen}
            onClick={() => {
              setLanguageOpen(open => !open)
              setThemeOpen(false)
              setShortcutOpen(false)
              setProfileOpen(false)
            }}
          >
            <Languages className="h-4 w-4" />
          </button>
          {languageOpen && (
            <div className="materio-language-menu materio-popover absolute right-0 top-full mt-2 w-[210px] py-2" role="menu" aria-label="语言切换">
              {[
                { label: '简体中文', value: 'zh-CN', active: true },
                { label: 'English', value: 'en-US', active: false },
                { label: 'Tiếng Việt', value: 'vi-VN', active: false },
                { label: 'ไทย', value: 'th-TH', active: false },
              ].map(item => (
                <button key={item.value} type="button" className="materio-language-item" role="menuitemradio" aria-checked={item.active}>
                  <span>{item.label}</span>
                  {item.active && <Check className="h-4 w-4 text-[var(--color-primary)]" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={shortcutMenuRef} className="relative" data-ui="shortcut-menu-select">
          <button
            type="button"
            className="materio-navbar-action"
            title="快捷入口"
            aria-haspopup="menu"
            aria-expanded={shortcutOpen}
            onClick={() => {
              setShortcutOpen(open => !open)
              setLanguageOpen(false)
              setThemeOpen(false)
              setProfileOpen(false)
            }}
          >
            <Star className="h-4 w-4" />
            <span className="materio-action-badge tone-info">4</span>
          </button>
          {shortcutOpen && (
            <div className="materio-shortcut-menu materio-popover absolute right-0 top-full mt-2 w-[380px]" role="menu" aria-label="快捷入口">
              <div className="materio-shortcut-header">
                <span>Shortcut</span>
                <button type="button" aria-label="新增快捷入口"><Plus className="h-4 w-4" /></button>
              </div>
              <div className="materio-shortcut-grid">
                {[
                  { icon: CalendarDays, title: 'Calendar', desc: 'Appointments' },
                  { icon: FileText, title: 'Invoice App', desc: 'Manage Accounts' },
                  { icon: UserRound, title: 'Users', desc: 'Manage Users' },
                  { icon: Monitor, title: 'Role Management', desc: 'Permission' },
                  { icon: BarChart3, title: 'Dashboard', desc: 'Dashboard Analytics' },
                  { icon: Settings2, title: 'Settings', desc: 'Account Settings' },
                ].map((entry) => {
                  const Icon = entry.icon
                  return (
                    <button key={entry.title} type="button" className="materio-shortcut-item" role="menuitem">
                      <span className="materio-shortcut-icon"><Icon className="h-5 w-5" /></span>
                      <span className="materio-shortcut-title">{entry.title}</span>
                      <span className="materio-shortcut-desc">{entry.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="materio-navbar-action" title="全屏">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button type="button" className="materio-navbar-action" title="深浅模式">
          {theme === 'dark-luxury' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <NotificationBell />
        <div ref={themeMenuRef} className="relative" data-ui="theme-preset-select">
          <button
            type="button"
            onClick={() => {
              setThemeOpen(open => !open)
              setLanguageOpen(false)
              setShortcutOpen(false)
              setProfileOpen(false)
            }}
            className="materio-navbar-action luxury-theme-select"
            title="Theme preset"
            aria-haspopup="menu"
            aria-expanded={themeOpen}
          >
            <Palette className="h-4 w-4" />
          </button>
          {themeOpen && (
            <div className="theme-preset-menu materio-popover absolute right-0 top-full mt-2 w-[320px] p-2" role="menu" aria-label="Theme preset">
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
          className="materio-navbar-action disabled:opacity-50"
          title="同步所有平台订单、商品、物流和刊登状态"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
        <div ref={profileMenuRef} className="relative" data-ui="profile-menu-select">
          <button
            type="button"
            className="materio-user-trigger"
            title="个人信息"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen(open => !open)
              setLanguageOpen(false)
              setThemeOpen(false)
              setShortcutOpen(false)
            }}
          >
            <span className="materio-user-avatar">{userInitial}</span>
            <span className="materio-user-status" aria-hidden="true" />
          </button>
          {profileOpen && (
            <div className="materio-user-menu materio-popover absolute right-0 top-full mt-2 w-[250px]" role="menu" aria-label="个人信息">
              <div className="materio-user-menu-header">
                <span className="materio-user-avatar is-large">{userInitial}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--color-fg)]">{displayName}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--color-muted)]">{user?.is_admin ? 'Administrator' : 'Operator'}</span>
                </span>
              </div>
              <div className="materio-user-menu-list">
                <button type="button" className="materio-user-menu-item" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/settings') }}>
                  <UserRound className="h-4 w-4" />
                  <span>个人资料</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                </button>
                <button type="button" className="materio-user-menu-item" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/settings') }}>
                  <Settings2 className="h-4 w-4" />
                  <span>账号设置</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                </button>
              </div>
              <div className="materio-user-menu-footer">
                <button type="button" className="materio-user-logout" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {createPortal(
        <button
          type="button"
          onClick={() => {
            setCustomizerOpen(true)
            setLanguageOpen(false)
            setThemeOpen(false)
            setShortcutOpen(false)
            setProfileOpen(false)
          }}
          className="materio-floating-customizer"
          aria-label="打开主题自定义"
          title="Theme Customizer"
        >
          <Settings2 className="h-5 w-5" />
        </button>,
        document.body
      )}
      {customizerOpen && createPortal(
        <>
          <button type="button" className="materio-customizer-scrim" aria-label="关闭主题自定义" onClick={() => setCustomizerOpen(false)} />
          <aside className="materio-customizer-drawer" aria-label="Theme Customizer">
            <div className="materio-customizer-header">
              <div>
                <h3>Theme Customizer</h3>
                <p>Customize & Preview in Real Time</p>
              </div>
              <div className="materio-customizer-header-actions">
                <button type="button" aria-label="重置主题">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button type="button" aria-label="关闭主题自定义" onClick={() => setCustomizerOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="materio-customizer-body">
              <CustomizerSection label="Theming">
                <CustomizerGroup title="Primary Color">
                  <div className="materio-color-grid">
                    {[
                      { color: 'var(--color-primary)', label: 'Primary', active: true },
                      { color: 'var(--color-accent)', label: 'Accent' },
                      { color: 'var(--color-warning)', label: 'Warning' },
                      { color: 'var(--color-danger)', label: 'Danger' },
                      { color: 'var(--color-info)', label: 'Info' },
                    ].map(item => (
                      <button key={item.label} type="button" className="materio-color-swatch" data-active={item.active ? 'true' : 'false'} style={{ ['--swatch-color' as string]: item.color }} aria-label={`主题色 ${item.label}`} />
                    ))}
                    <button type="button" className="materio-color-swatch is-custom" aria-label="自定义主题色">
                      <Palette className="h-4 w-4" />
                    </button>
                  </div>
                </CustomizerGroup>
                <CustomizerGroup title="Theme">
                  <div className="materio-option-grid three">
                    <button type="button" className="materio-preview-option" data-active={themeMode === 'light' ? 'true' : 'false'} onClick={() => setTheme('light-luxury')}>
                      <Sun className="h-6 w-6" />
                      <span>Light</span>
                    </button>
                    <button type="button" className="materio-preview-option" data-active={themeMode === 'dark' ? 'true' : 'false'} onClick={() => setTheme('dark-luxury')}>
                      <Moon className="h-6 w-6" />
                      <span>Dark</span>
                    </button>
                    <button type="button" className="materio-preview-option" data-active={themeMode === 'system' ? 'true' : 'false'} onClick={() => setTheme('warm-luxury')}>
                      <Monitor className="h-6 w-6" />
                      <span>System</span>
                    </button>
                  </div>
                </CustomizerGroup>
                <CustomizerGroup title="Skins">
                  <div className="materio-option-grid two">
                    <button type="button" className="materio-layout-preview is-card" data-active="true"><span>Default</span></button>
                    <button type="button" className="materio-layout-preview is-bordered"><span>Bordered</span></button>
                  </div>
                </CustomizerGroup>
                <div className="materio-switch-row">
                  <span>Semi Dark Menu</span>
                  <button type="button" className="materio-switch" aria-pressed="false"><span /></button>
                </div>
              </CustomizerSection>
              <CustomizerSection label="Layout">
                <CustomizerGroup title="Layout">
                  <div className="materio-option-grid three">
                    <button type="button" className="materio-layout-preview is-vertical" data-active="true"><span>Vertical</span></button>
                    <button type="button" className="materio-layout-preview is-collapsed"><span>Collapsed</span></button>
                    <button type="button" className="materio-layout-preview is-horizontal"><span>Horizontal</span></button>
                  </div>
                </CustomizerGroup>
                <CustomizerGroup title="Content">
                  <div className="materio-option-grid two">
                    <button type="button" className="materio-layout-preview is-compact" data-active="true"><span>Compact</span></button>
                    <button type="button" className="materio-layout-preview is-wide"><span>Wide</span></button>
                  </div>
                </CustomizerGroup>
                <CustomizerGroup title="Direction">
                  <div className="materio-option-grid two">
                    <button type="button" className="materio-layout-preview is-ltr" data-active="true"><span>Left to right</span></button>
                    <button type="button" className="materio-layout-preview is-rtl"><span>Right to left</span></button>
                  </div>
                </CustomizerGroup>
              </CustomizerSection>
            </div>
          </aside>
        </>,
        document.body
      )}
      </div>
    </header>
  )
}

function CustomizerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="materio-customizer-section">
      <span className="materio-customizer-pill">{label}</span>
      {children}
    </section>
  )
}

function CustomizerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="materio-customizer-group">
      <h4>{title}</h4>
      {children}
    </div>
  )
}
