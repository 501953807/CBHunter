import { AlertTriangle, Check } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import type { BatchPublishResponse } from '../../api/listing'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'

interface Props {
  result: BatchPublishResponse
  onReset: () => void
}

export function BatchPublishResultStep({ result, onReset }: Props) {
  const planMode = result.publish_plan?.mode === 'scheduled' ? '定时发布计划' : '立即发布计划'
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
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
          </div>
          <button onClick={onReset} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)]">
            继续创建
          </button>
        </div>
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="草稿结果明细">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-[var(--color-fg)]">草稿结果明细</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">逐条核对标题、平台、价格、发布计划和平台字段落库结果。</p>
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
                  <th className="px-3 py-2 font-medium">平台字段落库诊断</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item, index) => (
                  <tr key={item.listing_id || `${item.platform}-${item.product_name}-${index}`} className="border-t border-[var(--color-border)] align-top">
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
                      <PlatformFieldGroupSummary requirements={item.platform_requirements as PlatformRequirementsLike | undefined} compact maxGroups={2} />
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
