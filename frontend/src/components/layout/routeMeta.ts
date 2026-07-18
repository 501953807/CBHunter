const ROUTE_TITLES: Record<string, string> = {
  '/command-center': '经营指挥台',
  '/risk-control': '风险管控台',
  '/business-flow': '业务监控台',
  '/ops': '经营指挥台',
  '/cockpit': '经营指挥台',
  '/scout/sources': '品源管理',
  '/scout': '选品猎手',
  '/selection': '选品决策中心',
  '/profit': '选品决策中心',
  '/content/title': '标题生成',
  '/content/image': '图片处理',
  '/content/video': '视频生成',
  '/content/export': '平台刊登',
  '/content': '内容制作',
  '/orders/warehouses': '货代与云仓',
  '/orders/after-sales': '售后处理',
  '/orders': '订单管理',
  '/shipments': '物流管理',
  '/finance': '财务护卫',
  '/operations': '运营台账',
  '/promotions': '促销活动',
  '/growth': '增长引擎',
  '/publish/templates': '图片/水印模板',
  '/publish': '批量刊登',
  '/pricing': '智能定价',
  '/smart/radar': '关键词雷达',
  '/smart/cross': '1688 交叉验证',
  '/products': '商品管理',
  '/platforms': '平台管理',
  '/ai-suggestions': 'AI 运营建议',
  '/inventory-alerts': '库存预警',
  '/monitor': '竞品监控',
  '/reports': '报表中心',
  '/notifications': '通知中心',
  '/settings/profile': '账号信息',
  '/settings/access': '权限授权',
  '/settings/dict': '业务字典',
  '/settings/fees': '费率与汇率',
  '/settings/quality': '配置巡检',
  '/settings/keys': '接口密钥',
  '/settings/aiproviders': 'AI 引擎',
  '/settings/billing': '套餐权益',
  '/settings/warehouse': '仓储配置',
  '/settings/tasks': '系统任务',
  '/settings/audit': '审计日志',
  '/settings': '系统设置',
}

export function resolveRouteTitle(pathname: string): string {
  const exact = ROUTE_TITLES[pathname]
  if (exact) return exact
  const match = Object.entries(ROUTE_TITLES)
    .filter(([path]) => pathname.startsWith(`${path}/`))
    .sort(([left], [right]) => right.length - left.length)[0]
  return match?.[1] || 'CBHunter'
}

export function documentTitle(pathname: string): string {
  const title = resolveRouteTitle(pathname)
  return title === 'CBHunter' ? title : `${title} - CBHunter`
}
