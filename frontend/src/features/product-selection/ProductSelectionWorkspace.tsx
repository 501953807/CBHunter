import { CandidateDecisionWorkbench } from './ProductSelectionCoreTabs'
import { ScoutStageRail } from '../scout-sources/ScoutStageRail'

export default function ProductSelectionPage() {
  return (
    <div className="scout-workflow-page space-y-6">
      <ScoutStageRail activeStage="decision" />
      <div className="scout-workflow-main min-w-0 space-y-6">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[var(--color-primary)]">候选商品 → 决策门 → 内容队列</p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--color-fg)]">选品决策</h1>
              <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">
                围绕一个候选商品做趋势、平台、供应、竞品、利润和风险判断；通过后再进入内容与刊登模块制作 Listing。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <p className="font-semibold text-[var(--color-fg)]">候选锁定</p>
                <p className="mt-0.5 text-[var(--color-muted)]">真实资料</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <p className="font-semibold text-[var(--color-fg)]">九维决策</p>
                <p className="mt-0.5 text-[var(--color-muted)]">评分门槛</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <p className="font-semibold text-[var(--color-fg)]">内容衔接</p>
                <p className="mt-0.5 text-[var(--color-muted)]">进入 Listing</p>
              </div>
            </div>
          </div>
        </section>

        <CandidateDecisionWorkbench />
      </div>
    </div>
  )
}
