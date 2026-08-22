import type { ContentWorkbenchItem } from '../../api/content'
import { Button } from '../../components/ui/Button'
import { productImageSrc } from '../../utils/productImages'
import { EditorSection, InlineInput } from './SellerPlatformListingEditorParts'
import type { ListingImageSlot, SellerSkuRow } from './SellerPlatformListingEditorUtils'

export function ListingSkuSection({
  active,
  product,
  skuRows,
  skuBatchDraft,
  lastSkuBatchSummary,
  enabledSkuCount,
  skuReadyCount,
  imageSlots,
  setSkuBatchDraft,
  updateSkuRow,
  addSkuRow,
  removeSkuRow,
  applySkuBatch,
}: {
  active: boolean
  product: ContentWorkbenchItem | null
  skuRows: SellerSkuRow[]
  skuBatchDraft: { price: string; stock: string; weight: string; dimensions: string }
  lastSkuBatchSummary: string
  enabledSkuCount: number
  skuReadyCount: number
  imageSlots: ListingImageSlot[]
  setSkuBatchDraft: (updater: (current: { price: string; stock: string; weight: string; dimensions: string }) => { price: string; stock: string; weight: string; dimensions: string }) => void
  updateSkuRow: (rowId: string, field: keyof SellerSkuRow, value: string | boolean) => void
  addSkuRow: () => void
  removeSkuRow: (rowId: string) => void
  applySkuBatch: () => void
}) {
  return (
    <EditorSection id="listing-master-sku" title="SKU、销售资料与库存" description="按电商后台方式维护变体组合。每一行都是一个可发布 SKU，可单独编辑商家 SKU、平台 SKU、售价、库存、重量、包装尺寸和 SKU 图。" active={active}>
      <div
        className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        data-ui="seller-listing-sku-sales-editor"
        id="listing-field-sku-table"
        tabIndex={-1}
        aria-label="卖家后台 SKU 销售资料编辑区"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-fg)]">SKU 销售资料主表</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">启用 SKU {enabledSkuCount} 条，销售资料完整 {skuReadyCount} 条；规格一/规格二可表达 Shopee/TikTok 常规变体，SPU/SKC 在平台 SKU 或平台扩展字段中保留。</p>
          </div>
          <Button size="sm" variant="outline" onClick={addSkuRow} disabled={!product}>新增 SKU 变体</Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]" aria-label="SKU 批量操作工具条">
          <InlineInput value={skuBatchDraft.price} onChange={value => setSkuBatchDraft(current => ({ ...current, price: value }))} placeholder="批量售价" />
          <InlineInput value={skuBatchDraft.stock} onChange={value => setSkuBatchDraft(current => ({ ...current, stock: value }))} placeholder="批量库存" />
          <InlineInput value={skuBatchDraft.weight} onChange={value => setSkuBatchDraft(current => ({ ...current, weight: value }))} placeholder="批量重量" />
          <InlineInput value={skuBatchDraft.dimensions} onChange={value => setSkuBatchDraft(current => ({ ...current, dimensions: value }))} placeholder="批量长宽高" />
          <Button size="sm" onClick={applySkuBatch} disabled={!product || !skuRows.length}>填充启用 SKU</Button>
        </div>
        {lastSkuBatchSummary ? <p className="mt-2 text-[11px] font-semibold text-[var(--color-primary)]" data-ui="listing-sku-batch-fill-summary">{lastSkuBatchSummary}</p> : null}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-muted)]">
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">支持规格一 / 规格二组合</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">行级启用 / 停用</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">保存到当前店铺覆盖</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">SKU 图角色关联图片槽位</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full min-w-[1320px] text-left text-xs" aria-label="卖家后台 SKU 销售资料编辑表">
          <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
            <tr>
              {['规格一', '规格二', '商家 SKU', '平台 SKU / SPU/SKC', 'SKU 图角色', '售价', '库存', '重量', '包装尺寸', '状态', '操作'].map(header => <th key={header} className="border-b border-[var(--color-border)] px-3 py-2">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {skuRows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td className="border-b border-[var(--color-border)] px-3 py-3 font-medium text-[var(--color-fg)]">
                  <InlineInput value={row.optionOne} onChange={value => updateSkuRow(row.id, 'optionOne', value)} placeholder="如 Black / 默认款" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 font-medium text-[var(--color-fg)]">
                  <InlineInput value={row.optionTwo} onChange={value => updateSkuRow(row.id, 'optionTwo', value)} placeholder="如 M / 标准版" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <InlineInput value={row.merchantSku} onChange={value => updateSkuRow(row.id, 'merchantSku', value)} placeholder="商家 SKU" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <InlineInput value={row.platformSku} onChange={value => updateSkuRow(row.id, 'platformSku', value)} placeholder="平台 SKU / 发布后回写" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <div className="flex min-w-[168px] items-center gap-2" data-ui="listing-sku-image-slot-preview">
                    <select value={row.skuImageRole} onChange={event => updateSkuRow(row.id, 'skuImageRole', event.target.value)} className="min-w-[118px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" data-ui="listing-sku-image-slot-select" aria-label="选择 SKU 绑定图片槽位">
                      <option value="">选择图片槽位</option>
                      {imageSlots.filter(slot => slot.imageUrl).map(slot => <option key={slot.id} value={slot.label}>{slot.label} · {slot.role}</option>)}
                    </select>
                    {imageSlots.find(slot => slot.label === row.skuImageRole)?.imageUrl ? <img src={productImageSrc(imageSlots.find(slot => slot.label === row.skuImageRole)?.imageUrl || '')} alt={`${row.merchantSku || row.optionOne || 'SKU'}绑定图`} className="h-9 w-9 rounded-lg border border-[var(--color-border)] object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-[var(--color-border)] text-[10px] text-[var(--color-muted)]">SKU图</span>}
                  </div>
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-fg)]">
                  <InlineInput fieldId={rowIndex === 0 ? 'listing-field-sku-price' : undefined} value={row.price} onChange={value => updateSkuRow(row.id, 'price', value)} placeholder="售价" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <InlineInput value={row.stock} onChange={value => updateSkuRow(row.id, 'stock', value)} placeholder="库存" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <InlineInput value={row.weight} onChange={value => updateSkuRow(row.id, 'weight', value)} placeholder="重量" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                  <InlineInput value={row.dimensions} onChange={value => updateSkuRow(row.id, 'dimensions', value)} placeholder="长×宽×高" />
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3" data-ui="listing-sku-row-readiness-status">
                  {(() => {
                    const missing = [['merchantSku', '商家SKU'], ['price', '售价'], ['stock', '库存']]
                      .filter(([field]) => !String(row[field as keyof SellerSkuRow] || '').trim())
                      .map(([, label]) => label)
                    return (
                      <div className="space-y-1">
                        <button type="button" onClick={() => updateSkuRow(row.id, 'enabled', !row.enabled)} className={row.enabled ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]' : 'rounded-full bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-muted)]'}>{row.enabled ? '启用' : '停用'}</button>
                        <p className={row.enabled && !missing.length ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-warning)]'}>{row.enabled ? (missing.length ? `待补：${missing.join('、')}` : '发布就绪') : '已停用，不进入发布'}</p>
                      </div>
                    )
                  })()}
                </td>
                <td className="border-b border-[var(--color-border)] px-3 py-3">
                  <button
                    type="button"
                    onClick={() => removeSkuRow(row.id)}
                    disabled={skuRows.length <= 1}
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EditorSection>
  )
}
