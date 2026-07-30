import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft } from '../../api/listing'

export interface TargetPublishValidation {
  platformLabel: string
  storeLabel: string
  marketLabel: string
  publishPlanLabel: string
  platformApiStatusLabel: string
  blockingReasons: string[]
  warningReasons: string[]
  blockCount: number
  warningCount: number
  passCount: number
  blocked: boolean
}

export function buildTargetPublishValidation(
  draft: BatchListingDraft,
  publishMode: 'draft_only' | 'immediate' | 'scheduled',
  scheduledAt: string,
): TargetPublishValidation {
  const checks = draft.validation_checks || []
  const checkBlocks = checks.filter(check => check.state === 'block')
  const checkWarnings = checks.filter(check => check.state === 'warning')
  const checkPasses = checks.filter(check => check.state === 'pass')
  const blockingReasons: string[] = []
  const warningReasons: string[] = []
  const storeId = draft.store?.id || draft.platform_account_id
  const storeLabel = draft.store?.account_name || draft.platform_account_id || '目标店铺待补'
  const marketLabel = draft.market_label || draft.market || draft.store?.market || '目标市场待补'
  if (!draft.platform) blockingReasons.push('目标平台缺失')
  if (!storeId) blockingReasons.push('目标店铺缺失')
  if (!draft.market && !draft.store?.market) blockingReasons.push('目标市场缺失')
  if (draft.status === 'configuration_required') blockingReasons.push('平台配置或费率待补')
  if (draft.status === 'data_required') blockingReasons.push('平台发布所需数据待补')
  if (!draft.publishable) blockingReasons.push('后端发布门禁未通过')
  checkBlocks.forEach(check => blockingReasons.push(check.message || `${check.label}未通过`))
  for (const reason of draft.blocking_reasons || []) blockingReasons.push(reason)
  if (publishMode === 'scheduled' && !scheduledAt) warningReasons.push('定时发布计划缺少计划时间，提交前必须补齐')
  if (publishMode !== 'draft_only') warningReasons.push('平台 Open API 未接通实时提交时，仅生成本地发布计划并保留待提交状态')
  checkWarnings.forEach(check => warningReasons.push(check.message || `${check.label}待复核`))
  const uniqueBlocks = Array.from(new Set(blockingReasons.filter(Boolean)))
  const uniqueWarnings = Array.from(new Set(warningReasons.filter(Boolean)))
  return {
    platformLabel: draft.platform || '目标平台待补',
    storeLabel,
    marketLabel,
    publishPlanLabel: publishPlanText(publishMode, scheduledAt),
    platformApiStatusLabel: platformApiStatusText(draft, publishMode),
    blockingReasons: uniqueBlocks,
    warningReasons: uniqueWarnings,
    blockCount: uniqueBlocks.length + checkBlocks.length,
    warningCount: uniqueWarnings.length + checkWarnings.length,
    passCount: checkPasses.length,
    blocked: uniqueBlocks.length > 0,
  }
}

export function BatchPublishTargetValidationPanel({
  draft,
  publishMode,
  scheduledAt,
}: {
  draft: BatchListingDraft
  publishMode: 'draft_only' | 'immediate' | 'scheduled'
  scheduledAt: string
}) {
  const validation = buildTargetPublishValidation(draft, publishMode, scheduledAt)
  return (
    <div
      className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
      aria-label="目标店铺发布校验"
      data-ui="batch-publish-target-validation-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">目标店铺发布校验</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            确认前逐条核对目标平台、目标店铺、市场、发布计划模式和平台 Open API 状态。
          </p>
        </div>
        <Badge variant={validation.blocked ? 'danger' : validation.warningReasons.length ? 'warning' : 'success'}>
          {validation.blocked ? `${validation.blockingReasons.length} 阻断` : validation.warningReasons.length ? `${validation.warningReasons.length} 提醒` : '可确认'}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-5" data-ui="batch-publish-target-validation-grid">
        <TargetValidationFact label="目标平台" value={validation.platformLabel} />
        <TargetValidationFact label="目标店铺" value={validation.storeLabel} />
        <TargetValidationFact label="目标市场" value={validation.marketLabel} />
        <TargetValidationFact label="发布计划模式" value={validation.publishPlanLabel} />
        <TargetValidationFact label="平台 Open API" value={validation.platformApiStatusLabel} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3" data-ui="batch-publish-target-validation-blocks">
        <TargetGateMetric label="阻断" value={validation.blockingReasons.length} tone="danger" />
        <TargetGateMetric label="提醒" value={validation.warningReasons.length} tone="warning" />
        <TargetGateMetric label="通过校验项" value={validation.passCount} tone="success" />
      </div>
      {validation.blockingReasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-[var(--color-danger)]">
          {validation.blockingReasons.slice(0, 5).map(reason => <li key={reason}>· {reason}</li>)}
        </ul>
      )}
      {validation.warningReasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-warning)]">
          {validation.warningReasons.slice(0, 4).map(reason => <li key={reason}>· {reason}</li>)}
        </ul>
      )}
    </div>
  )
}

function TargetValidationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function TargetGateMetric({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'success' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}

function publishPlanText(publishMode: 'draft_only' | 'immediate' | 'scheduled', scheduledAt: string) {
  if (publishMode === 'draft_only') return '保存本地草稿'
  if (publishMode === 'immediate') return '立即发布计划'
  return scheduledAt ? `定时发布：${scheduledAt}` : '定时发布：计划时间待补'
}

function platformApiStatusText(draft: BatchListingDraft, publishMode: 'draft_only' | 'immediate' | 'scheduled') {
  if (draft.status === 'configuration_required') return '配置待补，不能提交平台'
  if (draft.status === 'data_required') return '数据待补，不能提交平台'
  if (publishMode === 'draft_only') return '保存本地草稿，不调用平台'
  return '待平台 Open API 接通或授权后提交'
}
