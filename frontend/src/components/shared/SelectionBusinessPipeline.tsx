import { NavLink, useLocation } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'

const STEPS = [
  { path: '/scout/sources', label: '信号捕获', detail: '四层来源' },
  { path: '/scout', label: '候选验证', detail: '归并与证据' },
  { path: '/profit', label: '选品决策', detail: '评分与决策门' },
  { path: '/content', label: '内容制作', detail: '标题图片视频' },
  { path: '/pricing', label: '定价校验', detail: '成本与利润' },
  { path: '/publish', label: '平台刊登', detail: '草稿与发布' },
] as const

function stepActive(pathname: string, path: string) {
  if (path === '/content') return pathname === path || pathname.startsWith('/content/')
  if (path === '/publish') return pathname === path || pathname.startsWith('/publish/')
  return pathname === path
}

export function SelectionBusinessPipeline() {
  const { pathname } = useLocation()
  const activeIndex = STEPS.findIndex((step) => stepActive(pathname, step.path))

  return (
    <nav aria-label="选品到刊登业务流程" className="sticky top-0 z-20 overflow-x-auto rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1.5 shadow-[var(--shadow-sm)] backdrop-blur">
      <ol className="flex min-w-[900px] items-stretch">
        {STEPS.map((step, index) => {
          const active = index === activeIndex
          const passed = activeIndex > index
          return (
            <li key={step.path} className="flex min-w-0 flex-1 items-center">
              <NavLink
                to={step.path}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2 transition-all duration-150',
                  'hover:bg-[var(--color-primary-light)]',
                  active && 'bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]',
                )}
              >
                {passed
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
                  : <Circle className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]')} />}
                <span className="min-w-0">
                  <span className={cn('block truncate text-xs font-semibold', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-fg)]')}>{index + 1}. {step.label}</span>
                  <span className="block truncate text-[10px] text-[var(--color-muted)]">{step.detail}</span>
                </span>
              </NavLink>
              {index < STEPS.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-border)]" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
