import {
  PLATFORM_LABELS,
  type CategoryProfileStats,
  type CategoryTreeSummary,
  type PlatformStats,
  type RuntimeImpactStats,
} from './PlatformFieldGroupGovernanceParts'

export function FieldPackageCoverage({
  activePlatform,
  onPlatformSelect,
  stats,
}: {
  activePlatform: string
  onPlatformSelect: (platform: string) => void
  stats: PlatformStats[]
}) {
  return (
    <div className="mb-3 grid gap-2 text-xs md:grid-cols-3" data-ui="settings-platform-field-package-coverage" aria-label="平台字段包覆盖度摘要">
      {stats.map(item => (
        <button
          type="button"
          key={item.platform}
          onClick={() => onPlatformSelect(item.platform)}
          className={`rounded-xl border p-3 text-left ${activePlatform === item.platform ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}
        >
          <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[item.platform]}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-[var(--color-muted)]">
            <span>字段组 {item.groupCount}</span>
            <span>字段 {item.fieldCount}</span>
            <span>必填 {item.requiredCount}</span>
            <span className={item.recheckCount ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>待复核 {item.recheckCount}</span>
            <span className={item.sourceGapCount ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>来源缺口 {item.sourceGapCount}</span>
            <span>枚举 {item.enumLikeCount}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

export function CurrentFieldPackageSummary({
  activePlatform,
  currentStats,
}: {
  activePlatform: string
  currentStats: PlatformStats
}) {
  return (
    <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-field-current-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[activePlatform] || activePlatform} 当前字段包</span>
        <span className="text-[var(--color-muted)]">字段 {currentStats.fieldCount} · 必填 {currentStats.requiredCount} · 待复核 {currentStats.recheckCount} · 来源缺口 {currentStats.sourceGapCount}</span>
      </div>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">发布前应优先处理来源缺口和待复核字段；草稿发布后才会进入内容工厂、商品详情和批量刊登动态字段表单。</p>
    </div>
  )
}

export function RuntimeImpactSummary({
  activePlatform,
  currentRuntimeImpact,
  onPlatformSelect,
  runtimeImpactStats,
}: {
  activePlatform: string
  currentRuntimeImpact: RuntimeImpactStats
  onPlatformSelect: (platform: string) => void
  runtimeImpactStats: RuntimeImpactStats[]
}) {
  return (
    <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-field-runtime-impact" aria-label="平台字段包运行时影响摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-fg)]">草稿相对生效版差异</span>
        <span className={currentRuntimeImpact.hasChanges ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>{currentRuntimeImpact.hasChanges ? '发布会改变运行时字段渲染' : '当前平台无字段差异'}</span>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {runtimeImpactStats.map(stats => (
          <button
            type="button"
            key={stats.platform}
            onClick={() => onPlatformSelect(stats.platform)}
            className={`rounded-lg border px-3 py-2 text-left ${activePlatform === stats.platform ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
          >
            <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[stats.platform]}</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              新增 {stats.addedCount} · 删除 {stats.removedCount} · 变更 {stats.changedCount}
            </p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-muted)]">发布 Schema 后，内容工厂、商品详情和批量刊登读取 `/config/init` 时会使用新的生效字段包；未发布草稿不会影响运行时。</p>
    </div>
  )
}

export function CategoryProfileSummaryPanel({
  activePlatform,
  categoryProfileStats,
  currentCategoryStats,
  onPlatformSelect,
}: {
  activePlatform: string
  categoryProfileStats: CategoryProfileStats[]
  currentCategoryStats: CategoryProfileStats
  onPlatformSelect: (platform: string) => void
}) {
  return (
    <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-category-profile-summary" aria-label="平台类目差异字段摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-fg)]">类目差异字段登记</span>
        <span className={currentCategoryStats.totalGapCount ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
          {PLATFORM_LABELS[activePlatform] || activePlatform} 类目待复核 {currentCategoryStats.totalGapCount}
        </span>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {categoryProfileStats.map(stats => (
          <button
            type="button"
            key={stats.platform}
            onClick={() => onPlatformSelect(stats.platform)}
            className={`rounded-lg border px-3 py-2 text-left ${activePlatform === stats.platform ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
          >
            <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[stats.platform]}</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              profile {stats.profileCount} · 类目字段 {stats.categoryFieldCount} · 类目待复核 {stats.categoryRecheckCount}
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              编辑页待复核 {stats.editPageRecheckCount} · API 待复核 {stats.apiRecheckCount}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
        <p className="font-medium text-[var(--color-fg)]">{PLATFORM_LABELS[activePlatform] || activePlatform} 当前类目 profile</p>
        {currentCategoryStats.profileLabels.length ? (
          <p className="mt-1">已登记：{currentCategoryStats.profileLabels.join('；')}</p>
        ) : (
          <p className="mt-1 text-[var(--color-warning)]">当前字段包未登记类目差异 profile，运行时只能使用通用字段组。</p>
        )}
        <p className="mt-1">
          待复核字段：类目 {currentCategoryStats.categoryRecheckCount} · 编辑页 {currentCategoryStats.editPageRecheckCount} · API {currentCategoryStats.apiRecheckCount}
        </p>
        <p className="mt-1">发布后运行时仍只在商品类目命中 profile 的情况下合并 `category_profile_*` 字段组，不会把全部类目字段无差别塞入所有商品。</p>
      </div>
    </div>
  )
}

export function CategoryTreeVersionSummary({ categoryTreeSummary }: { categoryTreeSummary: CategoryTreeSummary }) {
  return (
    <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-category-tree-version-governance" aria-label="类目树版本治理摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-fg)]">类目树版本治理</span>
        <span className={categoryTreeSummary.draft ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
          {categoryTreeSummary.draft ? '存在待发布草稿' : '当前读取生效版'}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
        后端按生效版、草稿和历史归档返回类目 profile、类目字段和待复核数量；未发布草稿仅用于设置中心复核，不进入运行时字段渲染。
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {([
          ['生效版', categoryTreeSummary.active],
          ['草稿', categoryTreeSummary.draft],
        ] as const).map(([label, summary]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <p className="font-medium text-[var(--color-fg)]">{label}</p>
            {summary ? (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                profile {summary.profile_count || 0} · 类目字段 {summary.category_field_count || 0} · 待复核 {summary.total_recheck_count || 0}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">无待发布草稿</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
