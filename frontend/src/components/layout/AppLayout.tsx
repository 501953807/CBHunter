import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { storage } from '../../utils/storage'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ModuleSubnav } from './ModuleSubnav'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { documentTitle, resolveRouteTitle } from './routeMeta'

export function AppLayout() {
  useRealtimeNotifications()
  const location = useLocation()
  const [sidebarExpanded, setSidebarExpanded] = useState(() => storage.get('sidebarExpanded') !== 'false')
  useEffect(() => {
    document.title = documentTitle(location.pathname)
  }, [location.pathname])

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const next = !prev
      storage.set('sidebarExpanded', String(next))
      return next
    })
  }

  const title = resolveRouteTitle(location.pathname)

  return (
    <div className={`layout-wrapper layout-nav-type-vertical luxury-app-shell min-h-[100dvh] text-[var(--color-fg)] transition-colors ${sidebarExpanded ? '' : 'layout-vertical-nav-collapsed'}`}>
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={toggleSidebar}
      />

      <div className="layout-content-wrapper luxury-main-shell flex min-w-0 flex-1 flex-col overflow-visible">
        <Header title={title} />

        <main className="materio-main-content flex-1 overflow-auto">
          <ModuleSubnav />
          <div className="luxury-page-pad">
            <div className="luxury-page-frame page-enter mx-auto w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
