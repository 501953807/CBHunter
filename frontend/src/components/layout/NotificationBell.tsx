import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead } from '../../hooks/useNotifications'
import type { Notification } from '../../types/notification'

const LEVEL_ICON: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-danger)',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data } = useNotifications({ limit: 50 })
  const unreadCount = data?.data?.unread_count ?? 0
  const notifications = data?.data?.notifications ?? []
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (bellRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleItemClick = useCallback((n: Notification) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }, [markRead, navigate])

  const handleMarkAll = () => {
    if (unreadCount > 0) markAllRead.mutate()
  }

  const timeAgo = (ts: string) => {
    const diff = now - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="materio-navbar-action relative"
        title="通知中心"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="materio-action-badge tone-danger">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="materio-notification-panel materio-popover flex max-h-[520px] w-[380px] flex-col overflow-hidden"
          style={{
            position: 'fixed',
            top: '82px',
            right: '24px',
          }}
        >
          {/* Header */}
          <div className="materio-popover-header">
            <span className="text-[15px] font-semibold text-[var(--color-fg)]">
              通知中心
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                  {unreadCount} New
                </span>
              )}
            </span>
            <button
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="materio-text-action disabled:opacity-40"
            >
              <CheckCheck className="w-3 h-3" />
              全部已读
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <span className="materio-empty-icon">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm text-[var(--color-muted)]">暂无通知</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = LEVEL_ICON[n.level] || Info
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="materio-notification-item"
                    data-unread={!n.read ? 'true' : 'false'}
                  >
                    <div className="materio-notification-avatar" style={{ color: LEVEL_COLOR[n.level] || 'var(--color-info)' }}>
                      <Icon className="w-4 h-4" style={{ color: LEVEL_COLOR[n.level] || 'var(--color-info)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-danger)' }} />
                        )}
                        <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                          {n.title}
                        </span>
                      </div>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full"
                          style={{
                            color: LEVEL_COLOR[n.level] || 'var(--color-info)',
                            backgroundColor: `${LEVEL_COLOR[n.level] || 'var(--color-info)'}18`,
                          }}>
                          {n.level === 'critical' ? '严重' : n.level === 'warning' ? '警告' : '信息'}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
