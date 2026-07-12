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
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data } = useNotifications({ limit: 50 })
  const unreadCount = data?.data?.unread_count ?? 0
  const notifications: Notification[] = (data?.data as any)?.notifications ?? []
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
    const diff = Date.now() - new Date(ts).getTime()
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
        className="relative p-1.5 rounded-md hover:bg-[var(--color-border)] text-[var(--color-muted)] transition-colors"
        title="通知中心"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[11px] font-bold text-[var(--color-primary-text)] px-1"
            style={{ backgroundColor: 'var(--color-danger)' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="w-80 max-h-[480px] flex flex-col rounded-xl shadow-lg border z-[9999]"
          style={{
            position: 'fixed',
            top: '48px',
            right: '16px',
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
              通知中心
              {unreadCount > 0 && (
                <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--color-muted)' }}>
                  ({unreadCount}条未读)
                </span>
              )}
            </span>
            <button
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-[var(--color-border)] disabled:opacity-40"
              style={{ color: 'var(--color-muted)' }}
            >
              <CheckCheck className="w-3 h-3" />
              全部已读
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Bell className="w-8 h-8" style={{ color: 'var(--color-border)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无通知</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = LEVEL_ICON[n.level] || Info
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--color-bg)] border-b"
                    style={{ borderColor: 'var(--color-border)', borderLeft: `3px solid ${n.read ? 'transparent' : LEVEL_COLOR[n.level] || 'var(--color-info)'}` }}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Icon className="w-4 h-4" style={{ color: LEVEL_COLOR[n.level] || 'var(--color-info)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-danger)' }} />
                        )}
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>
                          {n.title}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
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
