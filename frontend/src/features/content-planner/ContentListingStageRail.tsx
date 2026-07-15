import { Calculator, Megaphone, PenLine } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../utils/cn'

const downstreamStages = [
  { id: 'content', to: '/content', label: '内容制作', detail: '标题图片视频', icon: PenLine, match: (path: string) => path === '/content' || path.startsWith('/content/') },
  { id: 'pricing', to: '/pricing', label: '定价校验', detail: '成本利润价格', icon: Calculator, match: (path: string) => path === '/pricing' },
  { id: 'publish', to: '/publish', label: '平台刊登', detail: '店铺草稿发布', icon: Megaphone, match: (path: string) => path === '/publish' || path.startsWith('/publish/') },
] as const

export function ContentListingStageRail() {
  const { pathname, search } = useLocation()
  const currentSearch = search || ''

  return (
    <aside
      aria-label="内容刊登三阶段浮动导航"
      data-navigation-style="floating-stage-rail"
      className="pointer-events-none fixed right-4 top-[148px] z-40 hidden xl:block"
    >
      <div className="pointer-events-auto w-[86px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-lg)] backdrop-blur">
        <div className="mb-2 rounded-xl bg-[var(--color-primary-light)] px-2 py-2 text-center">
          <p className="text-[11px] font-semibold text-[var(--color-primary)]">刊登三阶段</p>
          <p className="sr-only">围绕同一商品完成内容制作、定价校验、平台刊登，不占用主工作台内容区。</p>
        </div>
        <nav className="grid gap-2" aria-label="内容制作、定价校验、平台刊登">
          {downstreamStages.map((stage, index) => {
            const Icon = stage.icon
            const active = stage.match(pathname)
            return (
              <NavLink
                key={stage.id}
                to={`${stage.to}${currentSearch}`}
                title={`${index + 1}. ${stage.label} · ${stage.detail}`}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex min-h-[64px] flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)]',
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-fg)]'
                )}
              >
                <span
                  className={cn(
                    'mb-1 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold',
                    active ? 'border-[var(--color-primary)] bg-[var(--color-surface)]' : 'border-[var(--color-border)]'
                  )}
                >
                  {index + 1}
                </span>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="mt-1 block text-[11px] font-semibold leading-4">{stage.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
