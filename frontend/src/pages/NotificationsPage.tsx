import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead, useCheckAlerts } from '../hooks/useNotifications'
import type { Notification } from '../types/notification'
import { PageHeader } from '../components/shared/PageHeader'
import { Badge } from '../components/ui/Badge'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'

const LEVEL_ICON: Record<string, React.ElementType> = { info: Info, warning: AlertTriangle, critical: AlertCircle }
const LEVEL_COLOR: Record<string, string> = { info: 'var(--color-info)', warning: 'var(--color-warning)', critical: 'var(--color-danger)' }

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { data, isLoading } = useNotifications({ limit: 200 })
  const notifications: Notification[] = data?.data?.notifications ?? []
  const total = data?.data?.total ?? 0
  const unreadCount = data?.data?.unread_count ?? 0
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const checkAlertsMutation = useCheckAlerts()
  const navigate = useNavigate()

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    return `${Math.floor(hours / 24)}天前`
  }

  const handleItemClick = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="通知中心"
        description={`共 ${total} 条通知${unreadCount > 0 ? `，${unreadCount} 条未读` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => checkAlertsMutation.mutate()}
              disabled={checkAlertsMutation.isPending}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              <RefreshCw className={`w-3 h-3 ${checkAlertsMutation.isPending ? 'animate-spin' : ''}`} />检查预警
            </button>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setFilter('all')}
                className="text-xs px-3 py-1.5"
                style={{
                  color: filter === 'all' ? 'var(--color-fg)' : 'var(--color-muted)',
                  background: filter === 'all' ? 'var(--color-border)' : 'transparent',
                }}
              >全部</button>
              <button
                onClick={() => setFilter('unread')}
                className="text-xs px-3 py-1.5"
                style={{
                  color: filter === 'unread' ? 'var(--color-fg)' : 'var(--color-muted)',
                  background: filter === 'unread' ? 'var(--color-border)' : 'transparent',
                }}
              >未读</button>
            </div>
            <button
              onClick={() => { if (unreadCount > 0) markAllRead.mutate() }}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              <CheckCheck className="w-3 h-3" />全部已读
            </button>
          </div>
        }
      />
      <EvidenceBanner evidence={data} />

      {isLoading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Bell className="w-10 h-10" style={{ color: 'var(--color-border)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {filter === 'unread' ? '所有通知已读' : '暂无通知'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const Icon = LEVEL_ICON[n.level] || Info
            return (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className="w-full text-left px-4 py-3.5 flex items-start gap-3 rounded-xl border transition-all hover:shadow-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  background: n.read ? 'var(--color-surface)' : 'var(--color-bg)',
                  borderLeft: `3px solid ${n.read ? 'transparent' : (LEVEL_COLOR[n.level] || 'var(--color-info)')}`,
                  opacity: n.read ? 0.7 : 1,
                }}
              >
                <div className="mt-0.5 shrink-0">
                  <Icon className="w-4 h-4" style={{ color: LEVEL_COLOR[n.level] || 'var(--color-info)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-danger)' }} />}
                    <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{n.title}</span>
                    <Badge>{n.type === 'alert' ? '预警' : n.type === 'report' ? '报表' : '系统'}</Badge>
                    <span className="text-[11px] ml-auto" style={{ color: 'var(--color-muted)' }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted)' }}>{n.message}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
