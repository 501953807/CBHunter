import { AlertTriangle, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import type { BatchPublishResponse } from '../../api/listing'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'

interface Props {
  result: BatchPublishResponse
  onReset: () => void
}

export function BatchPublishResultStep({ result, onReset }: Props) {
  const planMode = result.publish_plan?.mode === 'draft_only'
    ? '保存草稿'
    : result.publish_plan?.mode === 'scheduled'
      ? '定时发布计划'
      : '立即发布计划'
  const blockedResults = result.results.filter(item => item.publish_status !== 'draft' || item.blocking_reasons?.length || item.error)
  return (
    <Card className="batch-publish-result-panel">
      <CardContent className="space-y-4 pt-4">
        <div className="batch-publish-result-hero flex flex-wrap items-start gap-4 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-light)]">
            <Check className="h-7 w-7 text-[var(--color-success)]" />
          </div>
          <div className="mr-auto">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">草稿创建完成</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              已创建 {result.drafts_created} 个本地 Listing 草稿，跳过 {result.skipped} 个待补充项；{planMode}已保存，平台发布数仍为 {result.published}
            </p>
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              平台 Open API 未接通前仅保存本地计划，不代表 Shopee / TEMU / TikTok Shop 已发布成功。
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]" data-ui="publish-result-platform-api-status">
              <span className="rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[var(--color-warning)]">
                平台 Open API 状态：{result.platform_api_status || 'not_connected'}
              </span>
              <span className="rounded-full bg-[var(--color-bg)] px-2 py-1 text-[var(--color-muted)]">
                平台发布状态：{result.platform_publish_status || 'not_attempted'}
              </span>
            </div>
          </div>
            <button onClick={onReset} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)] transition hover:-translate-y-0.5">
              继续创建
            </button>
          </div>
        {blockedResults.length > 0 && (
          <section
            className="batch-publish-warning-panel rounded-[var(--radius-xl)] p-4"
            aria-label="发布失败与重试处理队列"
            data-ui="publish-result-retry-action-panel"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[var(--color-warning)]">发布失败 / 跳过处理队列</h3>
                <p className="mt-1 text-xs text-[var(--color-warning)]">逐条回写阻断原因，先补内容、补字段或补定价，再返回本页重新生成发布计划。</p>
              </div>
              <button onClick={onReset} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-warning)] px-3 py-2 text-xs font-medium text-[var(--color-warning)] transition hover:-translate-y-0.5">
                <RotateCcw className="h-3.5 w-3.5" /> 返回重选重试
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {blockedResults.map((item, index) => (
                <FailureActionCard key={`${item.platform}-${item.product_name}-${index}`} item={item} />
              ))}
            </div>
          </section>
        )}
        <section className="batch-publish-result-panel rounded-[var(--radius-xl)] p-4" aria-label="草稿结果明细" data-ui="publish-result-receipt-status-table">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[var(--color-fg)]">草稿结果明细</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">逐条核对标题、平台、价格、发布计划、本地回执和失败重试入口。</p>
            </div>
            <span className="rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-xs text-[var(--color-warning)]">platform_publish_status: {result.platform_publish_status || 'not_attempted'}</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Listing 草稿</th>
                  <th className="px-3 py-2 font-medium">平台/市场</th>
                  <th className="px-3 py-2 font-medium">售价</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">本地发布回执</th>
                  <th className="px-3 py-2 font-medium">平台字段落库诊断</th>
                  <th className="px-3 py-2 font-medium">处理入口</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item, index) => (
                  <tr key={item.listing_id || `${item.platform}-${item.product_name}-${index}`} className="batch-publish-result-row border-t border-[var(--color-border)] align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-[var(--color-fg)]">{item.template_title || item.product_name || '未命名 Listing'}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">商品 {item.product_id || item.source_product_id || '待关联'} · 草稿 {item.listing_id || '未创建'}</p>
                      {(item.product_id || item.source_product_id) && (
                        <a
                          href={`/products/${item.product_id || item.source_product_id}?tab=listings`}
                          className="mt-2 inline-flex text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          查看商品 Listing
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-muted)]">{item.platform} / {item.market_label || item.market}</td>
                    <td className="px-3 py-3 text-[var(--color-fg)]">{item.selling_price == null ? '待补' : item.selling_price}</td>
                    <td className="px-3 py-3"><ResultStatus status={item.publish_status} reason={item.error || item.blocking_reasons?.[0]} /></td>
                    <td className="px-3 py-3">
                      <PublishReceiptSummary item={item} />
                    </td>
                    <td className="px-3 py-3">
                      <PlatformFieldGroupSummary requirements={item.platform_requirements as PlatformRequirementsLike | undefined} compact maxGroups={2} />
                    </td>
                    <td className="px-3 py-3">
                      <ResultActions item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.results.length === 0 && <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">没有创建结果，请返回上一步重新确认。</p>}
        </section>
      </CardContent>
    </Card>
  )
}

function PublishReceiptSummary({ item }: { item: BatchPublishResponse['results'][number] }) {
  const receipt = item.publish_receipt
  const apiStatus = receipt?.platform_api_status || item.platform_api_status || item.publish_plan?.platform_api_status || 'not_connected'
  const platformStatus = receipt?.platform_publish_status || item.platform_publish_status || 'not_attempted'
  const nextAction = receipt?.next_action || (item.retryable ? '修正后返回批量刊登重试' : '查看失败原因后人工处理')
  const officialWriteback = receipt?.official_publish_writeback
  return (
    <div className="space-y-1 text-[11px]" data-ui="publish-result-local-receipt">
      <p className="font-medium text-[var(--color-fg)]">{receipt?.status === 'local_draft_created' ? '本地草稿已创建' : '未创建平台草稿'}</p>
      <p className="text-[var(--color-muted)]">API：{apiStatus} · 平台：{platformStatus}</p>
      {officialWriteback && <p className="text-[var(--color-muted)]" data-ui="publish-result-official-writeback">官方回写：字段 {officialWriteback.written_field_count ?? 0} · 返回 {officialWriteback.official_response_field_count ?? 0}</p>}
      <p className="text-[var(--color-muted)]">计划：{receipt?.plan_status || item.plan_status || item.publish_plan?.status || '待补'}</p>
      <p className="text-[var(--color-warning)]" data-ui="publish-result-retry-entry">失败重试：{nextAction}</p>
    </div>
  )
}

function FailureActionCard({ item }: { item: BatchPublishResponse['results'][number] }) {
  const reasons = item.blocking_reasons?.length ? item.blocking_reasons : [item.error || '平台返回或本地校验未通过']
  return (
    <div className="batch-publish-gate-card rounded-[var(--radius-lg)] border p-3" aria-label="发布失败原因卡片" data-ok="false">
      <p className="line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{item.template_title || item.product_name || '未命名 Listing'}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{item.platform} / {item.store?.account_name || item.market_label || item.market}</p>
      <ul className="mt-2 space-y-1 text-xs text-[var(--color-warning)]">
        {reasons.slice(0, 4).map(reason => <li key={reason}>· {reason}</li>)}
      </ul>
      <ResultActions item={item} compact />
    </div>
  )
}

function ResultActions({ item, compact = false }: { item: BatchPublishResponse['results'][number]; compact?: boolean }) {
  const actions = [
    ['补 Listing 内容', resultRepairHref(item, 'fields')],
    ['补发布图/SKU', resultRepairHref(item, 'media')],
    ['补定价', resultPricingHref(item)],
  ] as const
  return (
    <div className={compact ? 'mt-3 flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
      {actions.map(([label, href]) => (
        <a
          key={label}
          href={href}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)] px-2 py-1 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
        >
          {label}<ArrowRight className="h-3 w-3" />
        </a>
      ))}
    </div>
  )
}

function resultRepairHref(item: BatchPublishResponse['results'][number], section: 'media' | 'fields') {
  const productId = item.product_id || item.source_product_id
  const targetSection = section === 'media' ? 'media' : 'attributes'
  if (productId) return `/products/${encodeURIComponent(productId)}?tab=listings&listing_section=${targetSection}`
  if (item.sourcing_item_id) return `/content?sourcing_item_id=${encodeURIComponent(item.sourcing_item_id)}&listing_section=${targetSection}`
  return `/content?listing_section=${targetSection}`
}

function resultPricingHref(item: BatchPublishResponse['results'][number]) {
  const productId = item.product_id || item.source_product_id
  if (productId) return `/pricing?product_id=${encodeURIComponent(productId)}`
  if (item.sourcing_item_id) return `/pricing?sourcing_item_id=${encodeURIComponent(item.sourcing_item_id)}`
  return '/pricing'
}

function ResultStatus({ status, reason }: { status: string; reason?: string }) {
  if (status === 'draft') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]"><Check className="h-3 w-3" />本地草稿</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]" title={reason || '跳过'}>
      <AlertTriangle className="h-3 w-3" />跳过
    </span>
  )
}
