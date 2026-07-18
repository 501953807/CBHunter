import { useState, type PointerEvent } from 'react'
import { Calculator, GripVertical, Megaphone, PanelRightClose, PanelRightOpen, PenLine } from 'lucide-react'
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
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: typeof window === 'undefined' ? 1180 : Math.max(window.innerWidth - 76, 12),
    y: 148,
  }))

  const handleDragStart = (event: PointerEvent<HTMLElement>) => {
    const startX = event.clientX
    const startY = event.clientY
    const origin = position
    const move = (moveEvent: globalThis.PointerEvent) => {
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 56, origin.x + moveEvent.clientX - startX)),
        y: Math.max(72, Math.min(window.innerHeight - 92, origin.y + moveEvent.clientY - startY)),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <aside
      aria-label="内容刊登三阶段浮动导航"
      data-navigation-style="floating-stage-rail"
      data-ui="draggable-stage-rail"
      data-draggable="true"
      data-collapsible="true"
      data-stage-icon-only="true"
      className="pointer-events-none fixed z-40 hidden xl:block"
      style={{ left: position.x, top: position.y }}
    >
      <div className={cn('pointer-events-auto rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur', collapsed ? 'w-11' : 'w-12')}>
        <div className="mb-1 grid gap-1">
          <button type="button" aria-label="拖动内容刊登阶段导航" onPointerDown={handleDragStart} className="cursor-grab rounded-lg p-1 text-[var(--color-primary)] active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label={collapsed ? '展开内容刊登阶段导航' : '收起内容刊登阶段导航'} onClick={() => setCollapsed(value => !value)} className="rounded-lg p-1 text-[var(--color-primary)] hover:bg-[var(--color-surface)]">
            {collapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </button>
          <p className="sr-only">围绕同一商品完成内容制作、定价校验、平台刊登，不占用主工作台内容区。</p>
        </div>
        <nav className="grid gap-1.5" aria-label="内容制作、定价校验、平台刊登">
          {downstreamStages.map((stage) => {
            const Icon = stage.icon
            const active = stage.match(pathname)
            return (
              <NavLink
                key={stage.id}
                to={`${stage.to}${currentSearch}`}
                title={`${stage.label} · ${stage.detail}`}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex h-9 w-9 items-center justify-center rounded-full border text-center transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)]',
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-fg)]'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{stage.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
