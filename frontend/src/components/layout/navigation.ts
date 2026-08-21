import {
  mdiArchiveOutline,
  mdiBullhornOutline,
  mdiCartOutline,
  mdiChartBar,
  mdiCogOutline,
  mdiPackageVariantClosed,
  mdiRadar,
  mdiShieldCheckOutline,
  mdiTargetVariant,
  mdiTransitConnectionVariant,
  mdiViewDashboardOutline,
  mdiWalletOutline,
} from '@mdi/js'

export interface NavItem {
  to?: string
  match?: string[]
  icon?: string
  label: string
  badge?: string
  badgeTone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  children?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * A route has one menu owner only. Detail pages are reached from lists, and
 * overview workspaces link into domain modules from their page content.
 */
export const navGroups: NavGroup[] = [
  {
    label: '应用全局',
    items: [
      { to: '/command-center', icon: mdiViewDashboardOutline, label: '经营指挥台' },
      { to: '/risk-control', icon: mdiShieldCheckOutline, label: '风险管控台' },
      { to: '/business-flow', icon: mdiTransitConnectionVariant, label: '业务监控台' },
    ],
  },
  {
    label: '选品',
    items: [
      {
        to: '/scout/sources',
        match: ['/scout', '/scout/sources', '/smart/radar', '/smart/cross', '/profit'],
        icon: mdiTargetVariant,
        label: '品源与选品',
        children: [
          { to: '/scout/sources', label: '信号捕获' },
          { to: '/scout', label: '趋势与候选' },
          { to: '/profit', label: '选品决策' },
        ],
      },
      {
        to: '/content',
        match: ['/content', '/pricing', '/publish', '/publish/templates'],
        icon: mdiPackageVariantClosed,
        label: '内容与刊登',
        children: [
          { to: '/content', label: '内容工厂' },
          { to: '/pricing', label: '定价校验' },
          { to: '/publish', label: '批量刊登' },
          { to: '/publish/templates', label: '图片/水印模板' },
        ],
      },
    ],
  },
  {
    label: '订单',
    items: [
      {
        to: '/products',
        match: ['/products', '/inventory-alerts'],
        icon: mdiArchiveOutline,
        label: '商品与库存',
        children: [
          { to: '/products', label: '商品库' },
          { to: '/inventory-alerts', label: '库存与预警' },
        ],
      },
      {
        to: '/orders',
        match: ['/orders', '/shipments'],
        icon: mdiCartOutline,
        label: '订单履约',
        children: [
          { to: '/orders', label: '订单列表' },
          { to: '/orders?exceptions=1', label: '订单异常' },
          { to: '/orders/after-sales', label: '售后处理' },
          { to: '/shipments', label: '物流履约' },
        ],
      },
    ],
  },
  {
    label: '运营',
    items: [
      {
        to: '/operations',
        match: ['/operations', '/promotions', '/growth', '/ai-suggestions'],
        icon: mdiBullhornOutline,
        label: '运营增长',
        children: [
          { to: '/operations', label: '运营台账' },
          { to: '/promotions', label: '促销活动' },
          { to: '/operations?type=ad_campaign', label: '广告投放' },
          { to: '/operations?type=influencer_collaboration', label: '达人合作' },
          { to: '/growth', label: '增长分析' },
          { to: '/ai-suggestions', label: 'AI 运营建议' },
        ],
      },
      {
        to: '/finance',
        match: ['/finance'],
        icon: mdiWalletOutline,
        label: '财务利润',
        children: [
          { to: '/finance', label: '财务总览与台账' },
          { to: '/finance?type=receivable_collection', label: '应收回款' },
        ],
      },
      {
        to: '/monitor',
        match: ['/monitor'],
        icon: mdiRadar,
        label: '竞争情报',
        children: [
          { to: '/monitor', label: '竞品监控' },
        ],
      },
      { to: '/reports', match: ['/reports'], icon: mdiChartBar, label: '报表中心' },
    ],
  },
  {
    label: '系统',
    items: [
      {
        to: '/settings',
        match: ['/settings', '/platforms'],
        icon: mdiCogOutline,
        label: '设置中心',
        children: [
          { to: '/settings', label: '系统设置' },
          { to: '/platforms', label: '平台账号' },
        ],
      },
    ],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

export const legacyRouteMap: Record<string, string> = {
  '/': '/command-center',
  '/ops': '/command-center',
  '/cockpit': '/command-center',
  '/dashboard': '/command-center',
  '/selection': '/profit',
  '/trends': '/scout',
}
