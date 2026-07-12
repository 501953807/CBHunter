import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../utils/cn'

interface ModuleSubnavItem {
  to: string
  label: string
}

interface ModuleSubnavSection {
  label: string
  match: string[]
  items: ModuleSubnavItem[]
}

const sections: ModuleSubnavSection[] = [
  {
    label: '品源与选品',
    match: ['/scout', '/smart', '/profit'],
    items: [
      { to: '/scout/sources', label: '四层信号' },
      { to: '/scout', label: '趋势与候选' },
      { to: '/smart/radar', label: '关键词雷达' },
      { to: '/smart/cross', label: '供应交叉验证' },
      { to: '/profit', label: '选品决策' },
    ],
  },
  {
    label: '商品与库存',
    match: ['/products', '/inventory-alerts'],
    items: [
      { to: '/products', label: '商品库' },
      { to: '/inventory-alerts', label: '库存与预警' },
    ],
  },
  {
    label: '内容与刊登',
    match: ['/content', '/pricing', '/publish'],
    items: [
      { to: '/content', label: '内容工厂' },
      { to: '/pricing', label: '定价校验' },
      { to: '/publish', label: '批量刊登' },
      { to: '/publish/templates', label: 'Listing 模板' },
    ],
  },
  {
    label: '订单履约',
    match: ['/orders', '/shipments'],
    items: [
      { to: '/orders', label: '订单列表' },
      { to: '/orders?exceptions=1', label: '订单异常' },
      { to: '/orders/after-sales', label: '售后处理' },
      { to: '/shipments', label: '物流履约' },
    ],
  },
  {
    label: '运营增长',
    match: ['/operations', '/promotions', '/growth', '/ai-suggestions'],
    items: [
      { to: '/operations', label: '运营台账' },
      { to: '/promotions', label: '促销活动' },
      { to: '/operations?type=ad_campaign', label: '广告投放' },
      { to: '/operations?type=influencer_collaboration', label: '达人合作' },
      { to: '/growth', label: '增长分析' },
      { to: '/ai-suggestions', label: 'AI 运营建议' },
    ],
  },
  {
    label: '财务利润',
    match: ['/finance'],
    items: [
      { to: '/finance', label: '财务总览与台账' },
      { to: '/finance?type=receivable_collection', label: '应收回款' },
    ],
  },
  {
    label: '竞争情报',
    match: ['/monitor'],
    items: [
      { to: '/monitor', label: '竞品监控' },
    ],
  },
]

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isSectionActive(pathname: string, section: ModuleSubnavSection): boolean {
  return section.match.some((prefix) => pathMatchesPrefix(pathname, prefix))
}

function isItemActive(pathname: string, search: string, to: string): boolean {
  return itemMatchScore(pathname, search, to) > 0
}

function itemMatchScore(pathname: string, search: string, to: string): number {
  const [targetPath, targetQuery = ''] = to.split('?')
  if (targetQuery) return pathname === targetPath && search === `?${targetQuery}` ? 10000 + targetPath.length : 0
  if (pathname === targetPath) return 10000 + targetPath.length
  if (pathname.startsWith(`${targetPath}/`)) return 5000 + targetPath.length
  return 0
}

function activeItemTo(pathname: string, search: string, items: ModuleSubnavItem[]): string | null {
  let bestTo: string | null = null
  let bestScore = 0
  for (const item of items) {
    const score = itemMatchScore(pathname, search, item.to)
    if (score > bestScore) {
      bestScore = score
      bestTo = item.to
    }
  }
  return bestTo
}

export function ModuleSubnav() {
  const location = useLocation()
  const section = sections.find((candidate) => isSectionActive(location.pathname, candidate))
  if (!section || section.items.length <= 1) return null
  const activeTo = activeItemTo(location.pathname, location.search, section.items)

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 sm:px-5">
      <nav className="flex min-w-max gap-5 overflow-x-auto" aria-label={`${section.label}页内功能导航`}>
          {section.items.map((item) => {
            const active = isItemActive(location.pathname, location.search, item.to) && item.to === activeTo
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'min-w-max border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'
                )}
              >
                {item.label}
              </NavLink>
            )
          })}
      </nav>
    </div>
  )
}
