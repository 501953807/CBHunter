import { useState } from 'react'
import { Tabs } from '../../components/ui/Tabs'
import { CompetitorsTab, DecisionMatrixTab } from './ProductSelectionCoreTabs'
import { ProfitabilityTab } from './ProductSelectionFinanceTabs'
import { SavedResearchTab } from './SavedResearchTab'
import { SelectionBusinessPipeline } from '../../components/shared/SelectionBusinessPipeline'

const RESEARCH_TABS = [
  { id: 'decision', label: '选品决策' },
  { id: 'research', label: '关键词研究' },
  { id: 'competitors', label: '竞品监控' },
  { id: 'profitability', label: '盈利计算' },
]

export default function ProductSelectionPage() {
  const [activeTab, setActiveTab] = useState('decision')

  return (
    <div className="space-y-6">
      <SelectionBusinessPipeline />
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">候选商品 → 决策门 → 内容队列</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">选品决策中枢</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">
              围绕具体候选商品汇总趋势、平台、供应链、社交文化证据，完成九维评分、利润验证与去留决策。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <p className="font-semibold text-[var(--color-fg)]">候选锁定</p>
              <p className="mt-0.5 text-[var(--color-muted)]">真实证据</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <p className="font-semibold text-[var(--color-fg)]">九维决策</p>
              <p className="mt-0.5 text-[var(--color-muted)]">评分门槛</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <p className="font-semibold text-[var(--color-fg)]">内容衔接</p>
              <p className="mt-0.5 text-[var(--color-muted)]">Listing 队列</p>
            </div>
          </div>
        </div>
      </section>

      <Tabs tabs={RESEARCH_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'decision' && <DecisionMatrixTab />}
      {activeTab === 'research' && <SavedResearchTab />}
      {activeTab === 'competitors' && <CompetitorsTab />}
      {activeTab === 'profitability' && <ProfitabilityTab />}
    </div>
  )
}
