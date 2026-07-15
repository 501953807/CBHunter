import { Store } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PlatformIntegrationStatus } from '../../api/platforms'

interface Props {
  platformAccountId: string
  platform?: string
  statuses?: PlatformIntegrationStatus[]
  currentModule: 'products' | 'orders' | 'finance' | 'shipments'
  clearHref: string
}

const moduleLabel = {
  products: '平台店铺商品',
  orders: '店铺订单',
  shipments: '店铺物流',
  finance: '店铺财务',
}

export function StoreContextBanner({ platformAccountId, platform, statuses = [], currentModule, clearHref }: Props) {
  const navigate = useNavigate()
  if (!platformAccountId) return null

  const status = statuses.find(item => item.account_id === platformAccountId)
  const statusWithMarket = status as (PlatformIntegrationStatus & { market?: string | null }) | undefined
  const storeName = status?.account_name || platformAccountId
  const platformLabel = status?.platform || platform || '平台待识别'
  const market = statusWithMarket?.market || '市场待补'
  const baseQuery = `platform_account_id=${encodeURIComponent(platformAccountId)}${platform ? `&platform=${encodeURIComponent(platform)}` : ''}`

  const targets = [
    { key: 'products', label: '店铺商品', route: `/products?tab=platform_store_products&${baseQuery}` },
    { key: 'orders', label: '店铺订单', route: `/orders?${baseQuery}` },
    { key: 'shipments', label: '店铺物流', route: `/shipments?${baseQuery}` },
    { key: 'finance', label: '店铺财务', route: `/finance?platform_account_id=${encodeURIComponent(platformAccountId)}` },
  ] as const

  return (
    <section
      aria-label="平台店铺上下文横幅"
      data-ui="store-context-banner"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">store drilldown context</p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">
              当前按店铺筛选：{storeName}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              {platformLabel} · {market} · 当前模块：{moduleLabel[currentModule]}。从三大中枢下钻后，商品、订单、财务保持同一店铺上下文。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {targets.map(target => (
            <button
              key={target.key}
              type="button"
              className={target.key === currentModule
                ? 'rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'}
              onClick={() => navigate(target.route)}
            >
              {target.label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            onClick={() => navigate(clearHref)}
          >
            清除店铺筛选
          </button>
        </div>
      </div>
    </section>
  )
}
