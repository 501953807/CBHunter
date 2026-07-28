import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Boxes, Check, Image, Package, ShieldCheck, Sparkles, Tags, TrendingUp, Truck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import { StatCard } from '../../components/shared/StatCard'
import { PlatformFieldGroupEditor } from '../../components/shared/PlatformFieldGroups'
import {
  generateListingDraftAssist,
  type BatchListingDraft,
  type BatchPreviewSummary,
  type ListingValidationCheck,
  type PlatformFieldGapDetail,
  type PlatformListingRequirements,
} from '../../api/listing'
import { labelBusinessCode } from '../../utils/businessLabels'
import { logger } from '../../utils/logger'
import { getProviderTaskMatrix } from '../../api/settings'
import { ListingDraftQueue } from './ListingDraftQueue'
import { ListingCompletenessPanel } from './ListingCompletenessPanel'
import { StoreOverridePreviewPanel } from './StoreOverridePreviewPanel'
import { ComplianceEditor, LogisticsEditor, MediaEditor, numberOrNull, VariantEditor } from './BatchPublishDraftEditors'
import { BatchPublishSkuReadinessPanel, skuReadinessDetails } from './BatchPublishSkuReadinessPanel'

interface Props {
  summary: BatchPreviewSummary | null
  drafts: BatchListingDraft[]
  confirmedDrafts: Set<number>
  publishing: boolean
  publishMode: 'draft_only' | 'immediate' | 'scheduled'
  scheduledAt: string
  onToggleDraft: (index: number) => void
  onDraftChange: (index: number, patch: Partial<BatchListingDraft>) => void
  onPublishModeChange: (mode: 'draft_only' | 'immediate' | 'scheduled') => void
  onScheduledAtChange: (value: string) => void
  onBack: () => void
  onPublish: () => void
}

export function BatchPublishPreviewStep({
  summary, drafts, confirmedDrafts, publishing, publishMode, scheduledAt,
  onToggleDraft, onDraftChange, onPublishModeChange, onScheduledAtChange, onBack, onPublish,
}: Props) {
  const missingSchedule = publishMode === 'scheduled' && !scheduledAt
  const [assistLoading, setAssistLoading] = useState<string | null>(null)
  const [assistProvider, setAssistProvider] = useState('rule_engine')
  const [providerOptions, setProviderOptions] = useState<Array<{ id: string; label: string; usable: boolean }>>([
    { id: 'rule_engine', label: '规则后备（默认）', usable: true },
  ])
  const [activeDraftIndex, setActiveDraftIndex] = useState(0)
  useEffect(() => {
    getProviderTaskMatrix()
      .then(response => {
        const tasks = response.data?.tasks || []
        const options = new Map<string, { id: string; label: string; usable: boolean }>()
        options.set('rule_engine', { id: 'rule_engine', label: '规则后备（默认）', usable: true })
        tasks
          .filter((task: any) => ['listing_copy', 'image_edit_plan', 'video_script'].includes(task.task_type))
          .flatMap((task: any) => task.provider_options || [])
          .forEach((option: any) => {
            if (!option.provider_id) return
            options.set(option.provider_id, {
              id: option.provider_id,
              label: option.provider_name || option.provider_id,
              usable: Boolean(option.usable),
            })
          })
        setProviderOptions(Array.from(options.values()))
      })
      .catch(error => logger.error('Load listing assist provider options failed', error))
  }, [])
  useEffect(() => {
    if (activeDraftIndex >= drafts.length) setActiveDraftIndex(Math.max(drafts.length - 1, 0))
  }, [activeDraftIndex, drafts.length])
  const selectedAssistProviders = useMemo(() => (
    assistProvider === 'rule_engine' ? ['rule_engine'] : [assistProvider, 'rule_engine']
  ), [assistProvider])
  const activeDraft = drafts[activeDraftIndex]
  const draftImage = (draft: BatchListingDraft) => {
    if (Array.isArray(draft.images)) return draft.images[0]
    return draft.images
  }
  const runAssist = async (index: number, assistType: string) => {
    const key = `${index}:${assistType}`
    setAssistLoading(key)
    try {
      const response = await generateListingDraftAssist({
        ...drafts[index],
        assist_type: assistType,
        preferred_providers: selectedAssistProviders,
      })
      if (response.data?.patch) {
        onDraftChange(index, response.data.patch)
      }
    } catch (error) {
      logger.error('Generate listing draft assist failed', error)
    } finally {
      setAssistLoading(null)
    }
  }
  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="产品数" value={summary.total_products} icon={<Package className="w-4 h-4" />} />
          <StatCard label="生成 Listing" value={summary.total_listings} icon={<Sparkles className="w-4 h-4" />} />
          <StatCard label="平台" value={summary.platforms.join(', ')} />
          <StatCard
            label="平均利润率"
            value={summary.avg_estimated_margin_pct == null ? '待计算' : `${summary.avg_estimated_margin_pct}%`}
            icon={<TrendingUp className="w-4 h-4" />}
            change={summary.avg_estimated_margin_pct == null ? 0 : summary.avg_estimated_margin_pct > 15 ? 1 : -1}
          />
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">发布计划</h3>
              <p className="text-xs mt-1 text-[var(--color-muted)]">保存草稿只落本地待发布；立即/定时发布会先创建本地计划，平台 Open API 未接通时不会显示发布成功。</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
                <input type="radio" checked={publishMode === 'draft_only'} onChange={() => onPublishModeChange('draft_only')} />
                保存草稿
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
                <input type="radio" checked={publishMode === 'immediate'} onChange={() => onPublishModeChange('immediate')} />
                立即发布计划
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
                <input type="radio" checked={publishMode === 'scheduled'} onChange={() => onPublishModeChange('scheduled')} />
                定时发布计划
              </label>
              {publishMode === 'scheduled' && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={event => onScheduledAtChange(event.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)]"
                />
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] md:grid-cols-3" aria-label="发布计划模式说明" data-ui="publish-plan-mode-guide">
            <p className={publishMode === 'draft_only' ? 'rounded-lg bg-[var(--color-primary-light)] p-2 text-[var(--color-primary)]' : 'rounded-lg bg-[var(--color-bg)] p-2'}>保存草稿：只写入本地 Listing 草稿，不进入发布计划队列。</p>
            <p className={publishMode === 'immediate' ? 'rounded-lg bg-[var(--color-primary-light)] p-2 text-[var(--color-primary)]' : 'rounded-lg bg-[var(--color-bg)] p-2'}>立即发布计划：生成待平台提交的本地计划，待 API 接通后执行。</p>
            <p className={publishMode === 'scheduled' ? 'rounded-lg bg-[var(--color-primary-light)] p-2 text-[var(--color-primary)]' : 'rounded-lg bg-[var(--color-bg)] p-2'}>定时发布计划：必须填写计划时间，按店铺 Listing 独立排队。</p>
          </div>
          {missingSchedule && <p className="mt-2 text-xs text-[var(--color-warning)]">定时发布计划必须选择计划时间。</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-4 h-4 text-[var(--color-success)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Listing 工作台</h3>
            <span className="text-xs text-[var(--color-muted)]">同一个商品在同一界面完成内容、SKU、媒体、物流、合规与平台字段</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" aria-label="Listing 一体化工作台">
            <ListingDraftQueue
              drafts={drafts}
              activeIndex={activeDraftIndex}
              confirmedDrafts={confirmedDrafts}
              onSelect={setActiveDraftIndex}
            />
            <div className="max-h-[68vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }} aria-label="当前编辑商品">
            {activeDraft ? [activeDraft].map((draft) => {
              const index = activeDraftIndex
              return (
              <div
                key={`${draft.sourcing_item_id || draft.source_product_id}-${draft.platform}-${draft.platform_account_id || draft.market}-${index}`}
                className="p-4 rounded-2xl border transition-all"
                style={{
                  background: confirmedDrafts.has(index) ? 'var(--color-success-light)' : 'var(--color-bg)',
                  borderColor: confirmedDrafts.has(index) ? 'var(--color-success)' : 'var(--color-border)',
                }}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={confirmedDrafts.has(index)}
                    onChange={() => onToggleDraft(index)}
                    disabled={!draft.publishable}
                    className="w-4 h-4 mt-3 shrink-0"
                  />
                  {draftImage(draft) && (
                    <img
                      src={draftImage(draft)}
                      alt={draft.product_name || '刊登商品图'}
                      className="w-16 h-16 rounded-xl object-cover border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[var(--color-fg)]">{draft.product_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="default">{draft.platform}</Badge>
                      {draft.store?.account_name && <Badge variant="default">{draft.store.account_name}</Badge>}
                      <Badge variant="warning">{draft.market_label}</Badge>
                      <span className="text-[11px] text-[var(--color-muted)]">
                        {draft.status === 'configuration_required'
                          ? `配置待补：${(draft.data_gaps || []).map(labelBusinessCode).join(', ') || '费率/模板'}`
                          : draft.fee_missing ? '费率待配置' : `佣金${draft.commission_pct}% + 交易${draft.transaction_fee_pct}%`}
                      </span>
                    </div>
                    {draft.blocking_reasons.length > 0 && (
                      <p className="text-[11px] mt-1 text-[var(--color-danger)]">{draft.blocking_reasons.join(' / ')}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <label className="block text-[11px] text-[var(--color-muted)]">
                      售价
                      <input
                        type="number"
                        value={draft.selling_price ?? ''}
                        onChange={event => onDraftChange(index, { selling_price: numberOrNull(event.target.value) })}
                        className="mt-1 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right text-sm font-bold text-[var(--color-primary)]"
                      />
                    </label>
                    <p
                      className="text-[11px]"
                      style={{ color: draft.estimated_profit_margin == null ? 'var(--color-muted)' : draft.estimated_profit_margin > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                    >
                      {draft.estimated_profit_margin == null ? '利润率待计算' : `利润率 ${draft.estimated_profit_margin > 0 ? '+' : ''}${draft.estimated_profit_margin}%`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-[1.1fr_0.8fr_0.8fr]">
                  <Section title="Listing 内容" icon={<Tags className="h-4 w-4" />}>
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <label className="text-[11px] font-medium text-[var(--color-muted)]">
                        Listing标题
                        <input
                          value={draft.template_title || ''}
                          onChange={event => onDraftChange(index, { template_title: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)]"
                        />
                      </label>
                      <label className="text-[11px] font-medium text-[var(--color-muted)]">
                        商品描述 / 卖点
                        <textarea
                          value={draft.template_description || ''}
                          onChange={event => onDraftChange(index, { template_description: event.target.value })}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)]"
                        />
                      </label>
                    </div>
                  </Section>

                  <Section title="SKU / SPU / 规格" icon={<Boxes className="h-4 w-4" />}>
                    <label className="text-[11px] font-medium text-[var(--color-muted)]">
                      主 SKU
                      <input
                        value={draft.sku_plan?.master_sku || ''}
                        onChange={event => onDraftChange(index, { sku_plan: { ...(draft.sku_plan || {}), master_sku: event.target.value } })}
                        className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)]"
                      />
                    </label>
                    <VariantEditor
                      variants={draft.sku_plan?.variants || []}
                      onChange={variants => onDraftChange(index, { sku_plan: { ...(draft.sku_plan || {}), variants } })}
                    />
                  </Section>

                  <Section title="平台预览 / 费用 / 阻断" icon={<Sparkles className="h-4 w-4" />}>
                    <ReadinessPanel
                      draft={draft}
                      loadingKeyPrefix={`${index}:`}
                      assistLoading={assistLoading}
                      assistProvider={assistProvider}
                      providerOptions={providerOptions}
                      onProviderChange={setAssistProvider}
                      onAssist={assistType => runAssist(index, assistType)}
                    />
                  </Section>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 2xl:grid-cols-3">
                  <Section title="图片 / 视频" icon={<Image className="h-4 w-4" />}>
                    <MediaEditor
                      draft={draft}
                      onChange={patch => onDraftChange(index, patch)}
                    />
                  </Section>
                  <Section title="物流 / 履约" icon={<Truck className="h-4 w-4" />}>
                    <LogisticsEditor
                      draft={draft}
                      onChange={patch => onDraftChange(index, patch)}
                    />
                  </Section>
                  <Section title="合规 / 平台限制" icon={<ShieldCheck className="h-4 w-4" />}>
                    <ComplianceEditor
                      draft={draft}
                      onChange={patch => onDraftChange(index, patch)}
                    />
                  </Section>
                </div>

                {draft.platform_requirements && (
                  <div className="mt-3">
                    <PlatformFieldGroupEditor
                      requirements={draft.platform_requirements}
                      onChange={next => onDraftChange(index, { platform_requirements: next })}
                    />
                    <p className="mt-2 text-[11px] text-[var(--color-muted)]">字段组随草稿保存，用于 Shopee / TEMU / TikTok Shop 后续接口映射。</p>
                  </div>
                )}
              </div>
            )}) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-[var(--color-muted)]">
                暂无可编辑 Listing 草稿，请返回选择商品、平台和市场后生成预览。
              </div>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm inline-flex items-center gap-1 text-[var(--color-muted)]">
          <ArrowLeft className="w-3 h-3" /> 返回修改
        </button>
        <button
          onClick={onPublish}
          disabled={publishing || confirmedDrafts.size === 0 || missingSchedule}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-[var(--color-primary-text)] font-semibold disabled:opacity-40 transition-all"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {publishing
            ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-spin" /> 创建中...</span>
            : <span>创建 {confirmedDrafts.size} 个 Listing 草稿</span>}
        </button>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
        <span className="text-[var(--color-primary)]">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ReadinessPanel({
  draft,
  loadingKeyPrefix,
  assistLoading,
  assistProvider,
  providerOptions,
  onProviderChange,
  onAssist,
}: {
  draft: BatchListingDraft
  loadingKeyPrefix: string
  assistLoading: string | null
  assistProvider: string
  providerOptions: Array<{ id: string; label: string; usable: boolean }>
  onProviderChange: (provider: string) => void
  onAssist: (assistType: string) => void
}) {
  const checks = draft.validation_checks?.length ? draft.validation_checks : buildReadinessChecks(draft)
  const title = draft.template_title || draft.product_name || '标题待补'
  const description = draft.template_description || '描述待补'
  const feeParts = [
    draft.commission_pct == null ? null : `佣金 ${draft.commission_pct}%`,
    draft.transaction_fee_pct == null ? null : `交易 ${draft.transaction_fee_pct}%`,
    draft.tech_service_pct == null ? null : `技术服务 ${draft.tech_service_pct}%`,
  ].filter(Boolean)
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
        <p className="line-clamp-2 text-xs font-semibold text-[var(--color-fg)]">{title}</p>
        <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[var(--color-muted)]">{description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline">{draft.platform}</Badge>
          {draft.store?.account_name && <Badge variant="outline">{draft.store.account_name}</Badge>}
          <Badge variant="warning">{draft.market_label}</Badge>
        </div>
      </div>
      <PlatformRealtimePreview draft={draft} />
      <StoreOverridePreviewPanel draft={draft} />
      <ListingCompletenessPanel draft={draft} />
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">费用试算</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          {feeParts.length ? feeParts.join(' + ') : '平台费率待配置'}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: draft.estimated_profit_margin == null ? 'var(--color-warning)' : draft.estimated_profit_margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {draft.estimated_profit_margin == null ? '利润率待计算' : `预估利润率 ${draft.estimated_profit_margin}%`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map(check => (
          <span
            key={check.code || check.label}
            className="rounded-md border px-2 py-1 text-[11px]"
            style={{
              borderColor: check.state === 'pass' ? 'var(--color-success)' : check.state === 'block' ? 'var(--color-danger)' : 'var(--color-warning)',
              color: check.state === 'pass' ? 'var(--color-success)' : check.state === 'block' ? 'var(--color-danger)' : 'var(--color-warning)',
              background: 'var(--color-surface)',
            }}
            title={check.message}
          >
            {check.label}
          </span>
        ))}
      </div>
      <PlatformFieldGapDetails draft={draft} check={platformFieldCheck(checks)} />
      <BatchPublishSkuReadinessPanel draft={draft} check={skuValidationCheck(checks)} />
      <div className="grid grid-cols-2 gap-1.5">
        <label className="col-span-2 text-[11px] font-medium text-[var(--color-muted)]">
          辅助 Provider
          <select
            value={assistProvider}
            onChange={event => onProviderChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-fg)]"
          >
            {providerOptions.map(option => (
              <option key={option.id} value={option.id} disabled={!option.usable}>
                {option.label}{option.usable ? '' : '（不可用）'}
              </option>
            ))}
          </select>
        </label>
        {[
          ['listing_copy', '文案候选'],
          ['image_edit_plan', '图片建议'],
          ['video_script', '视频脚本'],
          ['compliance_check', '合规检查'],
        ].map(([assistType, label]) => {
          const loading = assistLoading === `${loadingKeyPrefix}${assistType}`
          return (
            <button
              key={assistType}
              onClick={() => onAssist(assistType)}
              disabled={Boolean(assistLoading)}
              className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)] disabled:opacity-50"
              title="只生成候选，不自动保存草稿"
            >
              {loading ? '生成中...' : label}
            </button>
          )
        })}
      </div>
      {(draft.blocking_reasons || []).length > 0 && (
        <div className="rounded-lg bg-[var(--color-danger-light)] p-2 text-[11px] leading-5 text-[var(--color-danger)]">
          {(draft.blocking_reasons || []).join(' / ')}
        </div>
      )}
    </div>
  )
}

function platformFieldCheck(checks: ListingValidationCheck[]) {
  return checks.find(check => check.code === 'platform_fields')
}

function skuValidationCheck(checks: ListingValidationCheck[]) {
  return checks.find(check => check.code === 'sku')
}

function PlatformFieldGapDetails({ draft, check }: { draft: BatchListingDraft; check?: ListingValidationCheck }) {
  const blockingFields = check?.details?.blocking_fields || []
  const recheckFields = check?.details?.recheck_fields || []
  if (!blockingFields.length && !recheckFields.length) return null
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
      aria-label="平台字段结构化缺口"
      data-ui="platform-field-gap-details"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">平台字段结构化缺口</p>
        <Badge variant={blockingFields.length ? 'danger' : 'warning'}>
          {blockingFields.length ? `${blockingFields.length} 阻断` : `${recheckFields.length} 待复核`}
        </Badge>
      </div>
      <div className="mt-2 space-y-2">
        <FieldGapSection draft={draft} title="阻断字段" tone="danger" fields={blockingFields} />
        <FieldGapSection draft={draft} title="待复核字段" tone="warning" fields={recheckFields} />
      </div>
    </div>
  )
}

function FieldGapSection({ draft, title, tone, fields }: { draft: BatchListingDraft; title: string; tone: 'danger' | 'warning'; fields: PlatformFieldGapDetail[] }) {
  if (!fields.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium" style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{title}</p>
      {fields.slice(0, 6).map(field => (
        <div key={`${field.key}-${field.group_id || 'group'}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-semibold text-[var(--color-fg)]">{field.label || field.standard_label || field.key}</p>
            <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{field.key}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {field.unified_field_key && <FieldMetaChip label={`统一字段 ${field.unified_field_key}`} />}
            {field.platform_field_name && <FieldMetaChip label={`平台字段 ${field.platform_field_name}`} />}
            {field.data_type && <FieldMetaChip label={`类型 ${field.data_type}`} />}
            {field.group_label && <FieldMetaChip label={field.group_label} />}
            {field.evidence_state && <FieldMetaChip label={`资料状态 ${field.evidence_state}`} />}
          </div>
          <a
            href={fieldRepairHref(draft, field)}
            className="mt-1.5 inline-flex text-[10px] font-medium text-[var(--color-primary)] hover:underline"
            data-ui="field-gaps-content-link"
          >
            回内容工厂补字段
          </a>
        </div>
      ))}
      {fields.length > 6 && <p className="text-[10px] text-[var(--color-muted)]">还有 {fields.length - 6} 个字段缺口，后续在字段组编辑区继续补齐。</p>}
    </div>
  )
}

function fieldRepairHref(draft: BatchListingDraft, field: PlatformFieldGapDetail) {
  const params = new URLSearchParams()
  if (draft.source_product_id) params.set('product_id', String(draft.source_product_id))
  if (draft.sourcing_item_id) params.set('source_id', String(draft.sourcing_item_id))
  if (draft.platform) params.set('platform', draft.platform)
  if (draft.store?.id) params.set('store_id', String(draft.store.id))
  if (draft.market) params.set('market', draft.market)
  params.set('platform_field_key', encodeURIComponent(field.key))
  params.set('section', 'platform_fields')
  return `/content?${params.toString()}`
}

function FieldMetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
      {label}
    </span>
  )
}

function PlatformRealtimePreview({ draft }: { draft: BatchListingDraft }) {
  const preview = buildPlatformRealtimePreview(draft)
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5" aria-label="平台适配实时预览">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">平台适配实时预览</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{preview.cardTitle} · {preview.layoutHint}</p>
        </div>
        <Badge variant={preview.blockingCount ? 'danger' : preview.warningCount ? 'warning' : 'success'}>
          {preview.blockingCount ? `${preview.blockingCount} 阻断` : preview.warningCount ? `${preview.warningCount} 提醒` : '可进入草稿'}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {preview.metrics.map(metric => (
          <div key={metric.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1">
            <p className="text-[10px] text-[var(--color-muted)]">{metric.label}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--color-fg)]">{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {preview.checks.map(check => (
          <div key={check.label} className="flex items-start gap-1.5 text-[11px]">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: check.state === 'pass' ? 'var(--color-success)' : check.state === 'block' ? 'var(--color-danger)' : 'var(--color-warning)' }}
            />
            <span className="font-medium text-[var(--color-fg)]">{check.label}</span>
            <span className="min-w-0 flex-1 text-[var(--color-muted)]">{check.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildPlatformRealtimePreview(draft: BatchListingDraft) {
  const platform = normalizePlatformName(draft.platform)
  const images = draft.media_assets?.images || (Array.isArray(draft.images) ? draft.images : draft.images ? [draft.images] : [])
  const videos = draft.media_assets?.videos || []
  const variants = draft.sku_plan?.variants || []
  const logistics = draft.logistics || {}
  const dimensions = logistics.dimensions || {}
  const attributeValues = draft.platform_requirements?.attribute_values || {}
  const fieldGaps = getPlatformRequiredFieldGaps(draft.platform_requirements, platformFieldCheck(draft.validation_checks || []))
  const skuCheck = skuValidationCheck(draft.validation_checks || [])
  const skuDetails = skuReadinessDetails(skuCheck)
  const skuBlocked = skuCheck?.state === 'block'
  const hasDimensions = Boolean(dimensions.length_cm && dimensions.width_cm && dimensions.height_cm)
  const titleOk = Boolean(draft.template_title?.trim())
  const descriptionOk = Boolean(draft.template_description?.trim())
  const skuOk = Boolean(draft.sku_plan?.master_sku || variants.length)
  const logisticsOk = Boolean(logistics.weight_g)
  const complianceOk = draft.compliance?.restricted_check_status === 'passed'
  const commonMetrics = [
    { label: '标题长度', value: titleOk ? `${draft.template_title.length} 字符` : '待补' },
    { label: '素材', value: `${images.length} 图 / ${videos.length} 视频` },
    { label: 'SKU', value: skuBlocked ? `${skuDetails.blocking_gaps.length} 阻断` : variants.length ? `${variants.length} 规格` : draft.sku_plan?.master_sku ? '主 SKU' : '待补' },
    { label: '字段', value: `${Object.keys(attributeValues).length} 已填 / ${fieldGaps.blocking.length} 缺失` },
  ]
  const byPlatform = {
    shopee: {
      cardTitle: 'Shopee 商品卡',
      layoutHint: '类目属性、规格库存、重量物流优先',
      checks: [
        platformCheck('标题/描述', titleOk && descriptionOk ? 'pass' : 'block', titleOk && descriptionOk ? '标题与描述已维护' : 'Shopee 上架前必须补齐标题与描述'),
        platformCheck('类目属性', fieldGaps.blocking.length ? 'block' : fieldGaps.recheck.length ? 'warning' : 'pass', fieldGaps.blocking.length ? `缺 ${fieldGaps.blocking.join('、')}` : fieldGaps.recheck.length ? `待补证 ${fieldGaps.recheck.join('、')}` : '已填平台属性值'),
        platformCheck('图片素材', images.length ? 'pass' : 'warning', images.length ? `已维护 ${images.length} 张图` : '建议至少维护主图'),
        platformCheck('规格库存', skuBlocked ? 'block' : skuOk ? 'pass' : 'warning', skuBlocked ? skuCheck?.message || 'SKU发布准备度未通过' : skuOk ? '可映射 SKU/规格' : '建议维护主 SKU 与规格库存'),
        platformCheck('重量物流', logisticsOk ? 'pass' : 'warning', logisticsOk ? '已维护重量，可继续匹配物流模板' : 'Shopee 运费校验需要重量信息'),
      ],
    },
    temu: {
      cardTitle: 'TEMU 商品卡',
      layoutHint: '货号、供货/售价、包装尺寸和合规优先',
      checks: [
        platformCheck('货号/SPU/SKC', skuBlocked ? 'block' : skuOk ? 'pass' : 'warning', skuBlocked ? skuCheck?.message || 'TEMU SKU/SPU/SKC发布准备度未通过' : skuOk ? '已有商品货号或规格' : '建议补主 SKU、SPU/SKC 映射'),
        platformCheck('价格成本', draft.selling_price && draft.source_price_rmb ? 'pass' : 'block', draft.selling_price && draft.source_price_rmb ? '售价和成本可试算' : 'TEMU 刊登前需补成本与目标售价'),
        platformCheck('包装尺寸', logisticsOk && hasDimensions ? 'pass' : 'warning', logisticsOk && hasDimensions ? '重量与长宽高已维护' : '建议补重量和包装长宽高'),
        platformCheck('属性合规', fieldGaps.blocking.length ? 'block' : complianceOk ? 'pass' : 'warning', fieldGaps.blocking.length ? `缺 ${fieldGaps.blocking.join('、')}` : complianceOk ? '合规复核已通过' : '需复核禁限售和资质'),
        platformCheck('主图/细节图', images.length >= 3 ? 'pass' : 'warning', images.length >= 3 ? `已维护 ${images.length} 张图` : '建议补足主图和细节图'),
      ],
    },
    tiktok: {
      cardTitle: 'TikTok Shop 商品卡',
      layoutHint: '内容种草、视频素材、变体库存和合规优先',
      checks: [
        platformCheck('标题卖点', titleOk && descriptionOk ? 'pass' : 'block', titleOk && descriptionOk ? '标题和卖点可用于商品详情' : 'TikTok Shop 商品卡需补标题和卖点描述'),
        platformCheck('短视频素材', videos.length ? 'pass' : 'warning', videos.length ? `已维护 ${videos.length} 条视频` : '建议补短视频或脚本，提高内容转化'),
        platformCheck('商品图片', images.length ? 'pass' : 'warning', images.length ? `已维护 ${images.length} 张图` : '建议至少维护商品主图'),
        platformCheck('变体库存', skuBlocked ? 'block' : skuOk ? 'pass' : 'warning', skuBlocked ? skuCheck?.message || 'SKU发布准备度未通过' : skuOk ? 'SKU/规格可进入平台映射' : '建议补规格、价格和库存'),
        platformCheck('禁限售', complianceOk ? 'pass' : 'warning', complianceOk ? '禁限售复核已通过' : 'TikTok Shop 发布前需复核禁限售'),
      ],
    },
  }
  const selected = byPlatform[platform as keyof typeof byPlatform] || byPlatform.shopee
  return {
    ...selected,
    metrics: commonMetrics,
    blockingCount: selected.checks.filter(check => check.state === 'block').length,
    warningCount: selected.checks.filter(check => check.state === 'warning').length,
  }
}

function platformCheck(label: string, state: 'pass' | 'warning' | 'block', message: string) {
  return { label, state, message }
}

function normalizePlatformName(platform: string) {
  const normalized = platform.toLowerCase()
  if (normalized.includes('temu')) return 'temu'
  if (normalized.includes('tiktok')) return 'tiktok'
  return 'shopee'
}

function getPlatformRequiredFieldGaps(requirements?: PlatformListingRequirements, validationCheck?: ListingValidationCheck) {
  const detailBlocking = validationCheck?.details?.blocking_fields || []
  const detailRecheck = validationCheck?.details?.recheck_fields || []
  if (detailBlocking.length || detailRecheck.length) {
    return {
      blocking: detailBlocking.map(fieldGapLabel),
      recheck: detailRecheck.map(fieldGapLabel),
      blockingFields: detailBlocking,
      recheckFields: detailRecheck,
    }
  }
  const values = requirements?.attribute_values || {}
  const fieldMeta = new Map<string, { label: string; evidenceState: string }>()
  for (const group of requirements?.field_groups || []) {
    if (!isRecord(group)) continue
    const fields = Array.isArray(group.fields) ? group.fields : []
    for (const field of fields) {
      if (!isRecord(field) || !field.key) continue
      const key = String(field.key)
      fieldMeta.set(key, {
        label: typeof field.label === 'string' ? field.label : key,
        evidenceState: typeof field.evidence_state === 'string' ? field.evidence_state : '',
      })
    }
  }
  const required = new Set<string>((requirements?.required_attributes || []).map(String))
  for (const group of requirements?.field_groups || []) {
    if (!isRecord(group)) continue
    for (const field of Array.isArray(group.fields) ? group.fields : []) {
      if (isRecord(field) && field.key && field.required) required.add(String(field.key))
    }
  }
  const blocking: string[] = []
  const recheck: string[] = []
  const blockingFields: PlatformFieldGapDetail[] = []
  const recheckFields: PlatformFieldGapDetail[] = []
  Array.from(required).sort().forEach(key => {
    if (values[key]) return
    const meta = fieldMeta.get(key)
    const label = meta?.label || key
    const detail: PlatformFieldGapDetail = {
      key,
      label,
      severity: meta?.evidenceState?.startsWith('needs_') ? 'recheck' : 'blocking',
      required: true,
      evidence_state: meta?.evidenceState || null,
    }
    if (meta?.evidenceState?.startsWith('needs_')) {
      recheck.push(label)
      recheckFields.push(detail)
    } else {
      blocking.push(label)
      blockingFields.push(detail)
    }
  })
  return { blocking, recheck, blockingFields, recheckFields }
}

function fieldGapLabel(field: PlatformFieldGapDetail) {
  return field.standard_label || field.label || field.platform_field_name || field.key
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildReadinessChecks(draft: BatchListingDraft) {
  const images = draft.media_assets?.images || (Array.isArray(draft.images) ? draft.images : draft.images ? [draft.images] : [])
  const variants = draft.sku_plan?.variants || []
  const attributeValues = draft.platform_requirements?.attribute_values || {}
  const fieldGaps = getPlatformRequiredFieldGaps(draft.platform_requirements)
  return [
    { code: 'title', label: '标题', state: draft.template_title ? 'pass' : 'block', message: '平台标题必须在发布前确认。' },
    { code: 'price', label: '售价', state: draft.selling_price && draft.selling_price > 0 ? 'pass' : 'block', message: '售价必须大于 0。' },
    { code: 'sku', label: 'SKU', state: draft.sku_plan?.master_sku || variants.length ? 'pass' : 'warning', message: '建议维护主 SKU 和规格 SKU。' },
    { code: 'media', label: '图片', state: images.length ? 'pass' : 'warning', message: '建议至少维护主图。' },
    { code: 'logistics', label: '物流', state: draft.logistics?.weight_g ? 'pass' : 'warning', message: '建议维护重量和尺寸，便于平台运费校验。' },
    { code: 'compliance', label: '合规', state: draft.compliance?.restricted_check_status === 'passed' ? 'pass' : 'warning', message: '禁限售和资质状态需复核。' },
    {
      code: 'platform_fields',
      label: '平台字段',
      state: fieldGaps.blocking.length ? 'block' : Object.keys(attributeValues).length ? 'pass' : 'warning',
      message: fieldGaps.blocking.length ? `缺少 ${fieldGaps.blocking.join('、')}` : '平台字段值越完整，越接近真实卖家后台提交要求。',
      details: {
        blocking_fields: fieldGaps.blockingFields,
        recheck_fields: fieldGaps.recheckFields,
      },
    },
    { code: 'fees', label: '费率', state: draft.fee_missing ? 'block' : 'pass', message: '平台费率缺失时只能保存前置补数状态。' },
  ] as ListingValidationCheck[]
}
