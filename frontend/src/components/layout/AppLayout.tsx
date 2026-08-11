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
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  useEffect(() => {
    document.title = documentTitle(location.pathname)
  }, [location.pathname])

  // Persist sidebar state
  useEffect(() => {
    const saved = storage.get('sidebarExpanded')
    if (saved !== null) {
      setSidebarExpanded(saved === 'true')
    }
  }, [])

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const next = !prev
      storage.set('sidebarExpanded', String(next))
      return next
    })
  }

  const title = resolveRouteTitle(location.pathname)

  return (
    <div className="luxury-app-shell flex h-screen text-[var(--color-fg)] transition-colors">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={toggleSidebar}
      />

      <div className="luxury-main-shell flex flex-1 flex-col overflow-hidden">
        <Header title={title} />

        <main className="flex-1 overflow-auto">
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
