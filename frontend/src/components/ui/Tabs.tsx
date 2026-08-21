import { cn } from '../../utils/cn'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div data-ui-scheme="professional-tabs" className="materio-tabs professional-tabbar overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-1.5 py-1.5 shadow-none">
      <nav className="flex min-w-max gap-1" aria-label="页面视图">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={cn(
              'rounded-[var(--radius-sm)] px-4 py-2 text-[15px] font-medium tracking-normal transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-0.5 text-xs font-semibold',
                  activeTab === tab.id
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-border)] text-[var(--color-muted)]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
