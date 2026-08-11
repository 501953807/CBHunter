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
      'luxury-sidebar relative z-20 flex shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-fg)] shadow-[var(--shadow-lg)] transition-[width] duration-200',
      expanded ? 'w-[104px]' : 'w-[72px]'
    )}>
      <div className="flex h-16 flex-col items-center justify-center gap-1 border-b border-[var(--color-hairline)]">
        <div className="brand-mark flex items-center justify-center">
          <Crosshair className="h-4 w-4 text-[var(--color-primary-text)]" aria-hidden="true" />
        </div>
        {expanded && <span className="text-[12px] font-semibold leading-none tracking-tight text-[var(--color-sidebar-active)]">CBHunter</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-3" aria-label="系统一级导航">
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

      <div className="space-y-1 border-t border-[var(--color-hairline)] p-2">
        <button onClick={onToggle} title={expanded ? '收起侧栏' : '展开侧栏'}
          className="flex min-h-10 w-full flex-col items-center justify-center gap-1 rounded-xl text-[var(--color-sidebar-fg)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-active)]">
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {expanded && <span className="text-[11px]">收起</span>}
        </button>
        <button onClick={logout} title="退出登录"
          className="flex min-h-10 w-full flex-col items-center justify-center gap-1 rounded-xl text-[var(--color-sidebar-fg)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-danger)]">
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
      data-active={active ? 'true' : 'false'}
      title={!expanded ? item.label : undefined}
      className={cn(
        'luxury-nav-item group relative flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[var(--color-sidebar-fg)] transition-all duration-150',
        'hover:-translate-y-0.5 hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-active)] hover:shadow-[var(--shadow-md)]',
        active && 'bg-[var(--color-sidebar-hover)] text-[var(--color-sidebar-active)] shadow-[var(--shadow-md)] font-semibold'
      )}>
      {active && <span className="absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[var(--color-primary)]" />}
      {Icon && <Icon className="w-5 h-5 shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5" />}
      {expanded && <span className="text-[11px] leading-tight text-center whitespace-nowrap">{item.label}</span>}
    </button>
  )
}
