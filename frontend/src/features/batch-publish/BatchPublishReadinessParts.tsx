import { Badge } from '../../components/ui/Badge'
import {
  type BatchListingDraft,
  type ListingValidationCheck,
  type PlatformFieldGapDetail,
  type PlatformListingRequirements,
} from '../../api/listing'
import { ListingCompletenessPanel } from './ListingCompletenessPanel'
import { StoreOverridePreviewPanel } from './StoreOverridePreviewPanel'
import { BatchPublishSkuReadinessPanel, skuReadinessDetails } from './BatchPublishSkuReadinessPanel'

export function ReadinessPanel({
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
