export interface SelectedPublishBlockingCounts {
  total: number
  master: number
  media: number
  fields: number
  price: number
  target: number
}

interface Props {
  selectedCount: number
  blockingCounts: SelectedPublishBlockingCounts
  blockingReason: string
}

export function BatchPublishPreflightSummary({ selectedCount, blockingCounts, blockingReason }: Props) {
  return (
    <section
      aria-label="已选商品发布前门禁汇总"
      data-ui="selected-publish-preflight-gate-summary"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">已选商品发布前校验</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">只校验当前勾选商品；存在阻断时不能进入 Listing 预览，需先回内容工厂或智能定价补齐。</p>
        </div>
        <span className={blockingCounts.total > 0
          ? 'rounded-full bg-[var(--color-warning-light)] px-3 py-1 text-xs font-semibold text-[var(--color-warning)]'
          : 'rounded-full bg-[var(--color-success-light)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]'
        }>
          {selectedCount === 0 ? '待选择商品' : blockingCounts.total > 0 ? `阻断 ${blockingCounts.total} 个` : '已选商品可预览'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <SelectedGateMetric label="已选商品" value={`${selectedCount}`} ok={selectedCount > 0} />
        <SelectedGateMetric label="母版" value={blockingCounts.master ? `缺 ${blockingCounts.master}` : '通过'} ok={blockingCounts.master === 0} />
        <SelectedGateMetric label="图片" value={blockingCounts.media ? `缺 ${blockingCounts.media}` : '通过'} ok={blockingCounts.media === 0} />
        <SelectedGateMetric label="字段" value={blockingCounts.fields ? `缺 ${blockingCounts.fields}` : '通过'} ok={blockingCounts.fields === 0} />
        <SelectedGateMetric label="价格" value={blockingCounts.price ? `缺 ${blockingCounts.price}` : '通过'} ok={blockingCounts.price === 0} />
        <SelectedGateMetric label="目标" value={blockingCounts.target ? `缺 ${blockingCounts.target}` : '通过'} ok={blockingCounts.target === 0} />
      </div>
      {blockingReason && (
        <p className="mt-3 rounded-xl bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]" data-ui="selected-publish-blocking-reason">
          {blockingReason}
        </p>
      )}
    </section>
  )
}

function SelectedGateMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" data-ui="selected-publish-preflight-gate-metric">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={ok ? 'mt-1 text-sm font-semibold text-[var(--color-success)]' : 'mt-1 text-sm font-semibold text-[var(--color-warning)]'}>
        {value}
      </p>
    </div>
  )
}
