import { Link } from 'react-router-dom'
import type { PlatformRequirementsLike } from './PlatformFieldGroupsParts'

type CategoryProfileSummary = {
  matched: boolean
  profileLabel: string
  matchedCategory: string
  matchRules: string[]
  matchedGroupCount: number
  categoryFieldCount: number
  gapCount: number
  sourceMissingCount: number
  evidenceSource: string
  fallbackAttrCount: number
  governanceHref: string
}

export function CategoryProfileRuntimeSummary({ summary }: { summary: CategoryProfileSummary }) {
  const headline = summary.matched
    ? `已命中类目字段 Profile：${summary.profileLabel || summary.matchedCategory || '专属字段包'}`
    : '当前类目未命中专属字段 Profile，使用平台通用字段组'
  const help = summary.matched
    ? '当前字段来自已发布字段包，发布前仍需按待复核字段补齐类目、编辑页或接口资料。'
    : '需在设置中心补齐该平台/类目的字段包并发布后，Listing 编辑器才会切换为专属字段。'
  return (
    <div
      className={summary.matched
        ? 'mt-3 rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] p-2.5 text-[11px]'
        : 'mt-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2.5 text-[11px]'
      }
      data-ui="platform-category-profile-hit-summary"
      aria-label="平台类目字段Profile命中摘要"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={summary.matched ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-warning)]'}>{headline}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">
          字段来源：{summary.evidenceSource || '待登记'}
        </span>
      </div>
      <p className="mt-1 leading-5 text-[var(--color-muted)]">{help}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          to={summary.governanceHref}
          className="inline-flex rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)]"
          data-ui="platform-category-profile-governance-link"
        >
          去设置中心补字段包
        </Link>
        <span className="text-[11px] text-[var(--color-muted)]">从当前字段缺口下钻到平台字段组 Schema 审批，不在本页伪造字段。</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summary.matchedCategory ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">匹配类目：{summary.matchedCategory}</span> : null}
        {summary.matchRules.length ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">命中规则 {summary.matchRules.length}</span> : null}
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">类目字段组 {summary.matchedGroupCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">类目字段 {summary.categoryFieldCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-warning)]">待复核 {summary.gapCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-danger)]">来源缺口 {summary.sourceMissingCount}</span>
        {!summary.matched && summary.fallbackAttrCount ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">通用字段 {summary.fallbackAttrCount}</span> : null}
      </div>
    </div>
  )
}

export function CategoryProfileBadge({ requirements }: { requirements?: PlatformRequirementsLike }) {
  const profile = requirements?.category_profile
  if (!profile) return null
  const gapCount = Object.values(requirements?.category_field_gaps || {}).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0)
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-[11px]" aria-label="类目差异字段组">
      <span className="font-semibold text-[var(--color-fg)]">类目差异字段组：{profile.label || profile.id || '已匹配'}</span>
      {profile.matched_category && <span className="ml-2 text-[var(--color-muted)]">匹配类目：{profile.matched_category}</span>}
      <span className="ml-2 text-[var(--color-warning)]">待复核字段 {gapCount}</span>
    </div>
  )
}
