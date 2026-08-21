import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Circle, CircleDot, LogOut, ShoppingBag } from 'lucide-react'
import { cn } from '../../utils/cn'
import { storage } from '../../utils/storage'
import { legacyRouteMap, navGroups, navItems, type NavItem } from './navigation'
import { MdiIcon } from '../ui/MdiIcon'

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

function activeChildTo(item: NavItem, path: string): string | null {
  let bestTo: string | null = null
  let bestScore = 0
  for (const child of item.children || []) {
    const score = itemScore(child, path)
    if (score > bestScore) {
      bestScore = score
      bestTo = child.to || null
    }
  }
  return bestTo
}

export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const activePath = `${normalizePath(location.pathname)}${location.search}`
  const primaryActive = activePrimaryLabel(activePath)
  const [manualOpenLabel, setManualOpenLabel] = useState<string | null | undefined>(undefined)
  const openLabel = manualOpenLabel === undefined ? primaryActive : manualOpenLabel

  const logout = () => {
    storage.remove('token')
    navigate('/login', { replace: true })
  }

  return (
    <aside
      data-expanded={expanded ? 'true' : 'false'}
      className={cn(
      'layout-vertical-nav luxury-sidebar relative z-20 flex shrink-0 flex-col bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-fg)]',
      expanded ? '' : 'is-collapsed'
    )}>
      <div className="nav-header">
        <button type="button" onClick={() => navigate('/command-center')} className="app-logo app-title-wrapper" aria-label="CBHunter 首页">
          <span className="brand-mark flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-[var(--color-primary-text)]" aria-hidden="true" />
          </span>
          <span className="app-logo-title">CBHunter</span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          className={cn('header-action', expanded ? 'nav-pin' : 'nav-unpin')}
          title={expanded ? '折叠菜单' : '固定展开菜单'}
          aria-label={expanded ? '折叠菜单' : '固定展开菜单'}
        >
          {expanded ? <CircleDot className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
      </div>

      <div className="vertical-nav-items-shadow" aria-hidden="true" />

      <nav className="nav-items flex-1" aria-label="系统一级导航">
        {navGroups.map((group) => (
          <div key={group.label} className="materio-nav-section nav-section">
            {group.label !== '应用全局' && (
              <div className="nav-section-title">
                <span className="section-title-text">{group.label}</span>
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <PrimaryNavItem
                  key={item.label}
                  item={item}
                  active={item.label === primaryActive}
                  activePath={activePath}
                  open={openLabel === item.label}
                  hasActiveChild={Boolean(activeChildTo(item, activePath))}
	                  onNavigate={() => {
	                    if (item.children?.length) {
	                      setManualOpenLabel(current => (current === undefined ? primaryActive : current) === item.label ? null : item.label)
	                      return
	                    }
	                    setManualOpenLabel(undefined)
	                    navigate(firstPath(item))
	                  }}
                  onChildNavigate={(to) => {
                    navigate(to)
                  }}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="nav-footer">
        <button onClick={logout} title="退出登录"
          className="nav-footer-action">
          <LogOut className="nav-item-icon" />
          <span className="nav-item-title">退出登录</span>
        </button>
      </div>
    </aside>
  )
}

function PrimaryNavItem({ item, active, activePath, open, hasActiveChild, onNavigate, onChildNavigate }: {
  item: NavItem
  active: boolean
  activePath: string
  open: boolean
  hasActiveChild: boolean
  onNavigate: () => void
  onChildNavigate: (to: string) => void
}) {
  const childActiveTo = activeChildTo(item, activePath)
  const hasChildren = Boolean(item.children?.length)
  return (
    <li className={cn(
      'nav-group group/nav relative',
      active && 'active',
      open && hasChildren && 'open show-content',
    )}>
      <button onClick={onNavigate}
        data-active={active ? 'true' : 'false'}
        data-child-active={hasActiveChild ? 'true' : 'false'}
        title={item.label}
        className={cn(
          'nav-group-label luxury-nav-item',
          !hasChildren && 'nav-link-label',
          active && 'router-link-active router-link-exact-active'
        )}>
        {item.icon && <MdiIcon path={item.icon} className="nav-item-icon" size={0.9} />}
        <span className="nav-item-title">{item.label}</span>
        {item.badge && (
          <span className={cn('nav-item-badge', `tone-${item.badgeTone || 'primary'}`)}>{item.badge}</span>
        )}
        {hasChildren && (
          <ChevronRight className="nav-group-arrow" />
        )}
      </button>

      {hasChildren && (
        <ul className={cn('nav-group-children materio-subnav-stack', open ? 'is-open' : '')} aria-hidden={!open}>
          {item.children?.map((child) => (
            <li
              key={child.to || child.label}
            >
              <button
                type="button"
                data-active={child.to === childActiveTo ? 'true' : 'false'}
                onClick={() => child.to && onChildNavigate(child.to)}
                className="materio-subnav-item nav-link"
              >
                <Circle className="subnav-dot" />
                <span className="nav-item-title">{child.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
