import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Crosshair, LogOut } from 'lucide-react'
import { cn } from '../../utils/cn'
import { storage } from '../../utils/storage'
import { legacyRouteMap, navItems, type NavItem } from './navigation'

function firstPath(item: NavItem): string {
  return item.to || '#'
}

function normalizePath(pathname: string): string {
  return legacyRouteMap[pathname] || pathname
}

function routeMatches(route: string | undefined, path: string): boolean {
  if (!route) return false
  if (route.includes('?')) return path === route
  const pathname = path.split('?')[0]
  if (route === '/') return pathname === '/'
  return pathname === route || pathname.startsWith(`${route}/`)
}

function routeScore(route: string | undefined, path: string): number {
  if (!routeMatches(route, path)) return 0
  return (path === route ? 10000 : 5000) + (route?.length || 0)
}

function itemScore(item: NavItem, path: string): number {
  return Math.max(
    routeScore(item.to, path),
    ...(item.match || []).map(route => routeScore(route, path)),
    0,
  )
}

function activePrimaryLabel(path: string): string | null {
  let bestLabel: string | null = null
  let bestScore = 0
  for (const item of navItems) {
    const score = itemScore(item, path)
    if (score > bestScore) {
      bestScore = score
      bestLabel = item.label
    }
  }
  return bestLabel
}

export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const activePath = `${normalizePath(location.pathname)}${location.search}`
  const primaryActive = activePrimaryLabel(activePath)

  const logout = () => {
    storage.remove('token')
    navigate('/login', { replace: true })
  }

  return (
    <aside className={cn(
      'flex flex-col shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] relative z-20 transition-[width] duration-200',
      expanded ? 'w-[104px]' : 'w-[72px]'
    )}>
      <div className="h-16 flex flex-col items-center justify-center gap-1 border-b border-[var(--color-border)]">
        <Crosshair className="h-7 w-7 text-[var(--color-primary)]" aria-hidden="true" />
        {expanded && <span className="text-[12px] font-semibold text-[var(--color-primary)] leading-none">CBHunter</span>}
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-1" aria-label="系统一级导航">
        {navItems.map((item) => (
          <PrimaryNavItem
            key={item.label}
            item={item}
            expanded={expanded}
            active={item.label === primaryActive}
            onNavigate={() => navigate(firstPath(item))}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--color-border)] space-y-1">
        <button onClick={onToggle} title={expanded ? '收起侧栏' : '展开侧栏'}
          className="w-full min-h-10 flex flex-col items-center justify-center gap-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all duration-150">
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {expanded && <span className="text-[11px]">收起</span>}
        </button>
        <button onClick={logout} title="退出登录"
          className="w-full min-h-10 flex flex-col items-center justify-center gap-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-all duration-150">
          <LogOut className="w-4 h-4" />
          {expanded && <span className="text-[11px]">退出</span>}
        </button>
      </div>
    </aside>
  )
}

function PrimaryNavItem({ item, expanded, active, onNavigate }: {
  item: NavItem
  expanded: boolean
  active: boolean
  onNavigate: () => void
}) {
  const Icon = item.icon
  return (
    <button onClick={onNavigate}
      title={!expanded ? item.label : undefined}
      className={cn(
        'group relative w-full min-h-[58px] rounded-md flex flex-col items-center justify-center gap-1 px-1 text-[var(--color-muted)] transition-all duration-150',
        'hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:shadow-[var(--shadow-sm)]',
        active && 'text-[var(--color-primary)] bg-[var(--color-primary-light)] font-semibold'
      )}>
      {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--color-primary)]" />}
      {Icon && <Icon className="w-5 h-5 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5" />}
      {expanded && <span className="text-[11px] leading-tight text-center whitespace-nowrap">{item.label}</span>}
    </button>
  )
}
