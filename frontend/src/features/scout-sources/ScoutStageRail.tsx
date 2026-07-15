import { CheckCircle2, GitBranch, Radar } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'

export type ScoutStageId = 'signal' | 'candidate' | 'decision'

const stages: Array<{
  id: ScoutStageId
  to: string
  title: string
  subtitle: string
  icon: typeof Radar
}> = [
  { id: 'signal', to: '/scout/sources', title: '信号捕获', subtitle: '四层来源', icon: Radar },
  { id: 'candidate', to: '/scout', title: '候选验证', subtitle: '商品机会', icon: GitBranch },
  { id: 'decision', to: '/profit', title: '选品决策', subtitle: '九维评分', icon: CheckCircle2 },
]

interface ScoutStageRailProps {
  activeStage: ScoutStageId
}

export function ScoutStageRail({ activeStage }: ScoutStageRailProps) {
  return (
    <aside
      aria-label="品源三阶段侧边导航"
      data-navigation-style="floating-stage-rail"
      className="pointer-events-none fixed right-4 top-[148px] z-40 hidden xl:block"
    >
      <div className="pointer-events-auto w-[86px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-lg)] backdrop-blur">
        <div className="mb-2 rounded-xl bg-[var(--color-primary-light)] px-2 py-2 text-center">
          <p className="text-[11px] font-semibold text-[var(--color-primary)]">品源三阶段</p>
          <p className="sr-only">先发散，再收敛，最后决策</p>
        </div>
        <nav className="grid gap-2" aria-label="信号捕获、候选验证、选品决策">
          {stages.map((stage, index) => {
            const Icon = stage.icon
            const active = stage.id === activeStage
            return (
              <NavLink
                key={stage.id}
                to={stage.to}
                title={`${index + 1}. ${stage.title} · ${stage.subtitle} · 先发散，再收敛，最后决策`}
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
                <span className="mt-1 block text-[11px] font-semibold leading-4">{stage.title}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
