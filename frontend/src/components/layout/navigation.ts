import {
  BarChart3,
  Boxes,
  Gauge,
  GitCompare,
  Megaphone,
  Package,
  Radar,
  Settings,
  ShieldCheck,
  ShoppingCart,
  WalletCards,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface NavItem {
  to?: string
  match?: string[]
  icon?: ElementType
  label: string
}

/**
 * A route has one menu owner only. Detail pages are reached from lists, and
 * overview workspaces link into domain modules from their page content.
 */
export const navItems: NavItem[] = [
  { to: '/command-center', icon: Gauge, label: '经营指挥台' },
  { to: '/risk-control', icon: ShieldCheck, label: '风险管控台' },
  { to: '/business-flow', icon: GitCompare, label: '业务监控台' },
  { to: '/scout/sources', match: ['/scout', '/scout/sources', '/smart/radar', '/smart/cross', '/profit'], icon: Radar, label: '品源与选品' },
  { to: '/products', match: ['/products', '/inventory-alerts'], icon: Boxes, label: '商品与库存' },
  { to: '/content', match: ['/content', '/pricing', '/publish', '/publish/templates'], icon: Package, label: '内容与刊登' },
  { to: '/orders', match: ['/orders', '/shipments'], icon: ShoppingCart, label: '订单履约' },
  { to: '/operations', match: ['/operations', '/promotions', '/growth', '/ai-suggestions'], icon: Megaphone, label: '运营增长' },
  { to: '/finance', match: ['/finance'], icon: WalletCards, label: '财务利润' },
  { to: '/monitor', match: ['/monitor'], icon: Radar, label: '竞争情报' },
  { to: '/reports', match: ['/reports'], icon: BarChart3, label: '报表中心' },
  { to: '/settings', match: ['/settings', '/platforms'], icon: Settings, label: '设置中心' },
]

export const legacyRouteMap: Record<string, string> = {
  '/': '/command-center',
  '/ops': '/command-center',
  '/cockpit': '/command-center',
  '/dashboard': '/command-center',
  '/selection': '/profit',
  '/trends': '/scout',
}
