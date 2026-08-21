import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Boxes, Check, Image, Package, ShieldCheck, Sparkles, Tags, TrendingUp, Truck } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatCard } from '../../components/shared/StatCard'
import { PlatformFieldGroupEditor } from '../../components/shared/PlatformFieldGroups'
import {
  generateListingDraftAssist,
  type BatchListingDraft,
  type BatchPreviewSummary,
} from '../../api/listing'
import { labelBusinessCode } from '../../utils/businessLabels'
import { logger } from '../../utils/logger'
import { getProviderTaskMatrix } from '../../api/settings'
import { ListingDraftQueue } from './ListingDraftQueue'
import { ComplianceEditor, LogisticsEditor, MediaEditor, numberOrNull, VariantEditor } from './BatchPublishDraftEditors'
import { BatchPublishTargetValidationPanel, buildTargetPublishValidation } from './BatchPublishTargetValidationPanel'
import { ReadinessPanel, Section, buildPublishDisabledReason } from './BatchPublishPreviewParts'

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

  const confirmedTargetBlockingCount = useMemo(() => (
    drafts.reduce((count, draft, index) => (
      confirmedDrafts.has(index) && buildTargetPublishValidation(draft, publishMode, scheduledAt).blocked ? count + 1 : count
    ), 0)
  ), [confirmedDrafts, drafts, publishMode, scheduledAt])

  const publishDisabled = publishing || confirmedDrafts.size === 0 || missingSchedule || confirmedTargetBlockingCount > 0
  const publishDisabledReason = buildPublishDisabledReason({
    confirmedCount: confirmedDrafts.size,
    missingSchedule,
    confirmedTargetBlockingCount,
  })
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
    <div className="batch-publish-preview-panel space-y-4 rounded-[var(--radius-xl)] p-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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

      <Card className="batch-publish-panel">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">发布计划</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">保存草稿只落本地待发布；立即/定时发布会先创建本地计划，平台 Open API 未接通时不会显示发布成功。</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
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

      <Card className="batch-publish-preview-panel">
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-2">
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
                const targetValidation = buildTargetPublishValidation(draft, publishMode, scheduledAt)
                const targetConfirmDisabled = !confirmedDrafts.has(index) && targetValidation.blocked
                return (
                  <div
                    key={`${draft.sourcing_item_id || draft.source_product_id}-${draft.platform}-${draft.platform_account_id || draft.market}-${index}`}
                    className="batch-publish-panel rounded-[var(--radius-xl)] p-4 transition-all"
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
                        disabled={!draft.publishable || targetConfirmDisabled}
                        className="mt-3 h-4 w-4 shrink-0"
                      />
                      {draftImage(draft) && (
                        <img
                          src={draftImage(draft)}
                          alt={draft.product_name || '刊登商品图'}
                          className="h-16 w-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-fg)]">{draft.product_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] text-[var(--color-primary)]">{draft.platform}</span>
                          {draft.store?.account_name && <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{draft.store.account_name}</span>}
                          <span className="rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]">{draft.market_label}</span>
                          <span className="text-[11px] text-[var(--color-muted)]">
                            {draft.status === 'configuration_required'
                              ? `配置待补：${(draft.data_gaps || []).map(labelBusinessCode).join(', ') || '费率/模板'}`
                              : draft.fee_missing ? '费率待配置' : `佣金${draft.commission_pct}% + 交易${draft.transaction_fee_pct}%`}
                          </span>
                        </div>
                        {draft.blocking_reasons.length > 0 && (
                          <p className="mt-1 text-[11px] text-[var(--color-danger)]">{draft.blocking_reasons.join(' / ')}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
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

                    <BatchPublishTargetValidationPanel draft={draft} publishMode={publishMode} scheduledAt={scheduledAt} />

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
                      <Section title="发布图 / 视频" icon={<Image className="h-4 w-4" />}>
                        <MediaEditor draft={draft} onChange={patch => onDraftChange(index, patch)} />
                      </Section>
                      <Section title="物流 / 履约" icon={<Truck className="h-4 w-4" />}>
                        <LogisticsEditor draft={draft} onChange={patch => onDraftChange(index, patch)} />
                      </Section>
                      <Section title="合规 / 平台限制" icon={<ShieldCheck className="h-4 w-4" />}>
                        <ComplianceEditor draft={draft} onChange={patch => onDraftChange(index, patch)} />
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
                )
              }) : (
                <div className="batch-publish-panel rounded-[var(--radius-xl)] border border-dashed p-6 text-sm text-[var(--color-muted)]">
                  暂无可编辑 Listing 草稿，请返回选择商品、平台和市场后生成预览。
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)]">
          <ArrowLeft className="w-3 h-3" /> 返回修改
        </button>
        <button
          onClick={onPublish}
          disabled={publishDisabled}
          className="inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-[var(--color-primary-text)] transition-all disabled:opacity-40"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {publishing
            ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-spin" /> 创建中...</span>
            : <span>创建 {confirmedDrafts.size} 个 Listing 草稿</span>}
        </button>
      </div>
      {publishDisabledReason && (
        <p className="text-right text-xs text-[var(--color-warning)]" data-ui="batch-publish-preview-confirm-blocking-reason">
          {publishDisabledReason}
        </p>
      )}
    </div>
  )
}
