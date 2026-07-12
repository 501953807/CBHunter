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
    <div className="flex h-screen bg-[var(--color-bg)] transition-colors">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={toggleSidebar}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />

        <main className="flex-1 overflow-auto">
          <ModuleSubnav />
          <div className="p-3 sm:p-5">
            <div className="page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
