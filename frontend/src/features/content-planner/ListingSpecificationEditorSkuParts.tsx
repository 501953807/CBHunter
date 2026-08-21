import type { ContentAsset } from '../../api/content'
import { Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { productImageSrc } from '../../utils/productImages'
import {
  contentAssetImageUrl,
  inputClass,
  TextField,
  type SkuDraft,
  type SkuGenerationDraft,
  type SkuPlatformMappingRow,
  type SkuReadinessRow,
} from './ListingSpecificationEditorParts'

export function SkuWorkbenchSection({
  productAvailable,
  skuDrafts,
  skuGenerator,
  productSkuImageAssets,
  skuReadiness,
  skuPlatformMapping,
  skuReady,
  skuBlockingGapCount,
  skuWarningGapCount,
  skuPlatformMappingGapCount,
  onSkuChange,
  onSkuGeneratorChange,
  onBindSkuImageAsset,
  onAddSku,
  onRemoveSku,
  onSetAllSkuEnabled,
  onClearSkuDrafts,
  onAppendGeneratedSkuRows,
  onRebuildGeneratedSkuRows,
}: {
  productAvailable: boolean
  skuDrafts: SkuDraft[]
  skuGenerator: SkuGenerationDraft
  productSkuImageAssets: ContentAsset[]
  skuReadiness: SkuReadinessRow[]
  skuPlatformMapping: SkuPlatformMappingRow[]
  skuReady: boolean
  skuBlockingGapCount: number
  skuWarningGapCount: number
  skuPlatformMappingGapCount: number
  onSkuChange: (index: number, key: keyof SkuDraft, value: string | boolean) => void
  onSkuGeneratorChange: (key: keyof SkuGenerationDraft, value: string) => void
  onBindSkuImageAsset: (index: number, asset: ContentAsset) => void
  onAddSku: () => void
  onRemoveSku: (index: number) => void
  onSetAllSkuEnabled: (enabled: boolean) => void
  onClearSkuDrafts: () => void
  onAppendGeneratedSkuRows: () => void
  onRebuildGeneratedSkuRows: () => void
}) {
  return (
    <section id="listing-spec-sku" aria-label="SKU 变体草稿表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">卖家后台规格编辑主表</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按平台后台习惯维护启用状态、商家SKU、平台SKU、SPU/SKC、SKU图、变体属性、售价、库存、重量、包裹尺寸和条码/货号。</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="SKU 批量操作工具条" data-ui="sku-bulk-edit-toolbar">
          <Button size="sm" variant="outline" onClick={() => onSetAllSkuEnabled(true)}>批量启用SKU</Button>
          <Button size="sm" variant="outline" onClick={() => onSetAllSkuEnabled(false)}>批量停用SKU</Button>
          <Button size="sm" variant="outline" onClick={onClearSkuDrafts}>清空SKU草稿</Button>
          <Button size="sm" variant="outline" onClick={onAddSku}>新增规格行</Button>
        </div>
      </div>
      <div
        aria-label="SKU 规格组合生成器"
        data-ui="sku-variation-combination-generator"
        className="mb-3 grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-4"
      >
        <TextField label="规格一名称" value={skuGenerator.specOneName} onChange={value => onSkuGeneratorChange('specOneName', value)} />
        <TextField label="规格一选项" value={skuGenerator.specOneValues} onChange={value => onSkuGeneratorChange('specOneValues', value)} />
        <TextField label="规格二名称" value={skuGenerator.specTwoName} onChange={value => onSkuGeneratorChange('specTwoName', value)} />
        <TextField label="规格二选项" value={skuGenerator.specTwoValues} onChange={value => onSkuGeneratorChange('specTwoValues', value)} />
        <TextField label="商家SKU前缀" value={skuGenerator.skuPrefix} onChange={value => onSkuGeneratorChange('skuPrefix', value)} />
        <TextField label="默认售价" value={skuGenerator.price} onChange={value => onSkuGeneratorChange('price', value)} />
        <TextField label="默认库存" value={skuGenerator.stock} onChange={value => onSkuGeneratorChange('stock', value)} />
        <TextField label="默认重量(g)" value={skuGenerator.weight} onChange={value => onSkuGeneratorChange('weight', value)} />
        <div className="md:col-span-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onAppendGeneratedSkuRows} disabled={!productAvailable}>
              按规格组合追加SKU
            </Button>
            <Button size="sm" variant="outline" onClick={onRebuildGeneratedSkuRows} disabled={!productAvailable}>
              按规格组合重建SKU
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[var(--color-muted)]">
            选项可用逗号、顿号或换行分隔；生成结果带有“规格名: 规格值”的规格键，只作用于当前店铺 Listing 覆盖草稿，保存前可继续逐行调整 SKU 图、价格、库存和包裹字段。
          </p>
        </div>
      </div>
      <SkuEditableVariantTable
        skuDrafts={skuDrafts}
        productSkuImageAssets={productSkuImageAssets}
        onSkuChange={onSkuChange}
        onBindSkuImageAsset={onBindSkuImageAsset}
        onRemoveSku={onRemoveSku}
      />
      <SkuReadinessPanel
        skuReady={skuReady}
        skuReadiness={skuReadiness}
        skuPlatformMapping={skuPlatformMapping}
        skuBlockingGapCount={skuBlockingGapCount}
        skuWarningGapCount={skuWarningGapCount}
        skuPlatformMappingGapCount={skuPlatformMappingGapCount}
      />
    </section>
  )
}

function SkuEditableVariantTable({
  skuDrafts,
  productSkuImageAssets,
  onSkuChange,
  onBindSkuImageAsset,
  onRemoveSku,
}: {
  skuDrafts: SkuDraft[]
  productSkuImageAssets: ContentAsset[]
  onSkuChange: (index: number, key: keyof SkuDraft, value: string | boolean) => void
  onBindSkuImageAsset: (index: number, asset: ContentAsset) => void
  onRemoveSku: (index: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label="卖家后台规格编辑主表" className="w-full min-w-[1680px] text-left text-xs" data-ui="listing-sku-editable-variant-table">
        <thead className="text-[var(--color-muted)]">
          <tr>
            <th className="px-2 py-2 font-medium">启用</th>
            <th className="px-2 py-2 font-medium">商家SKU</th>
            <th className="px-2 py-2 font-medium">平台SKU</th>
            <th className="px-2 py-2 font-medium">SPU/SKC</th>
            <th className="px-2 py-2 font-medium">变体属性</th>
            <th className="px-2 py-2 font-medium">SKU图角色</th>
            <th className="px-2 py-2 font-medium">SKU图片URL</th>
            <th className="px-2 py-2 font-medium">售价</th>
            <th className="px-2 py-2 font-medium">库存</th>
            <th className="px-2 py-2 font-medium">重量(g)</th>
            <th className="px-2 py-2 font-medium">长(cm)</th>
            <th className="px-2 py-2 font-medium">宽(cm)</th>
            <th className="px-2 py-2 font-medium">高(cm)</th>
            <th className="px-2 py-2 font-medium">条码/货号</th>
            <th className="px-2 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {skuDrafts.map((row, index) => (
            <tr key={index} className="border-t border-[var(--color-border)]">
              <td className="px-2 py-2">
                <label className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                  <input type="checkbox" checked={row.enabled} onChange={event => onSkuChange(index, 'enabled', event.target.checked)} />
                  {row.enabled ? '启用' : '停用'}
                </label>
              </td>
              <td className="px-2 py-2"><input className={inputClass} value={row.sku} onChange={event => onSkuChange(index, 'sku', event.target.value)} placeholder="商家SKU" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.platformSku} onChange={event => onSkuChange(index, 'platformSku', event.target.value)} placeholder="平台SKU/Model ID" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.spuSkc} onChange={event => onSkuChange(index, 'spuSkc', event.target.value)} placeholder="SPU/SKC/商品ID" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.variation} onChange={event => onSkuChange(index, 'variation', event.target.value)} placeholder="颜色/尺码/型号" /></td>
              <td className="px-2 py-2">
                <select className={inputClass} value={row.imageRole} onChange={event => onSkuChange(index, 'imageRole', event.target.value)} aria-label="SKU 图片角色">
                  <option value="sku_main">SKU主图</option>
                  <option value="color_variant">颜色变体图</option>
                  <option value="size_variant">尺码规格图</option>
                  <option value="detail">细节图</option>
                </select>
              </td>
              <td className="px-2 py-2">
                <SkuImageAssetPicker
                  row={row}
                  rowIndex={index}
                  productSkuImageAssets={productSkuImageAssets}
                  onSkuChange={onSkuChange}
                  onBindSkuImageAsset={onBindSkuImageAsset}
                />
              </td>
              <td className="px-2 py-2"><input className={inputClass} value={row.price} onChange={event => onSkuChange(index, 'price', event.target.value)} placeholder="发布售价" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.stock} onChange={event => onSkuChange(index, 'stock', event.target.value)} placeholder="店铺库存" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.weight} onChange={event => onSkuChange(index, 'weight', event.target.value)} placeholder="SKU重量" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.length} onChange={event => onSkuChange(index, 'length', event.target.value)} placeholder="长" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.width} onChange={event => onSkuChange(index, 'width', event.target.value)} placeholder="宽" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.height} onChange={event => onSkuChange(index, 'height', event.target.value)} placeholder="高" /></td>
              <td className="px-2 py-2"><input className={inputClass} value={row.barcode} onChange={event => onSkuChange(index, 'barcode', event.target.value)} placeholder="GTIN/EAN/货号" /></td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onRemoveSku(index)}
                  className="inline-flex items-center rounded-lg border border-[var(--color-border)] px-2 py-2 text-[var(--color-danger)] transition hover:border-[var(--color-danger)]"
                  aria-label={`删除第 ${index + 1} 条 SKU`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkuImageAssetPicker({
  row,
  rowIndex,
  productSkuImageAssets,
  onSkuChange,
  onBindSkuImageAsset,
}: {
  row: SkuDraft
  rowIndex: number
  productSkuImageAssets: ContentAsset[]
  onSkuChange: (index: number, key: keyof SkuDraft, value: string | boolean) => void
  onBindSkuImageAsset: (index: number, asset: ContentAsset) => void
}) {
  return (
    <div className="min-w-[220px]" data-ui="sku-image-asset-picker">
      <input className={inputClass} value={row.imageUrl} onChange={event => onSkuChange(rowIndex, 'imageUrl', event.target.value)} placeholder="选择素材或粘贴已处理SKU图片URL" />
      {productSkuImageAssets.length > 0 ? (
        <div className="mt-2 flex max-w-[240px] gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1" aria-label={`第 ${rowIndex + 1} 条SKU图片素材选择`}>
          {productSkuImageAssets.slice(0, 8).map(asset => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onBindSkuImageAsset(rowIndex, asset)}
              className={row.imageUrl === contentAssetImageUrl(asset)
                ? 'h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                : 'h-9 w-9 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] transition hover:border-[var(--color-primary)]'}
              title={asset.original_name || asset.id}
            >
              <img src={productImageSrc(contentAssetImageUrl(asset))} alt={asset.original_name || 'SKU图片素材'} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">暂无当前商品图片素材，请先在媒体素材中上传或处理真实图片。</p>
      )}
    </div>
  )
}

function SkuReadinessPanel({
  skuReady,
  skuReadiness,
  skuPlatformMapping,
  skuBlockingGapCount,
  skuWarningGapCount,
  skuPlatformMappingGapCount,
}: {
  skuReady: boolean
  skuReadiness: SkuReadinessRow[]
  skuPlatformMapping: SkuPlatformMappingRow[]
  skuBlockingGapCount: number
  skuWarningGapCount: number
  skuPlatformMappingGapCount: number
}) {
  return (
    <div
      aria-label="SKU 发布准备度校验"
      data-ui="sku-platform-readiness-checklist"
      className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">SKU 发布准备度校验</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            按当前目标平台检查启用 SKU 行的发布关键字段；阻断项未补齐前不能视为可发布 SKU。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={skuReady ? 'success' : 'warning'}>{skuReady ? 'SKU可进入发布校验' : `阻断缺口 ${skuBlockingGapCount}`}</Badge>
          <Badge variant={skuWarningGapCount ? 'warning' : 'outline'}>建议补充 {skuWarningGapCount}</Badge>
          <Badge variant={skuPlatformMappingGapCount ? 'warning' : 'success'}>平台映射缺口 {skuPlatformMappingGapCount}</Badge>
        </div>
      </div>
      <SkuReadinessTable skuReadiness={skuReadiness} />
      <SkuPlatformMappingTable skuPlatformMapping={skuPlatformMapping} />
    </div>
  )
}

function SkuReadinessTable({ skuReadiness }: { skuReadiness: SkuReadinessRow[] }) {
  if (skuReadiness.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
        暂无启用 SKU 行。请新增规格行或用规格组合生成器追加 SKU。
      </p>
    )
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-xs" aria-label="SKU发布缺口列表">
        <thead className="text-[var(--color-muted)]">
          <tr>
            <th className="px-2 py-2 font-medium">SKU行</th>
            <th className="px-2 py-2 font-medium">变体</th>
            <th className="px-2 py-2 font-medium">阻断缺口</th>
            <th className="px-2 py-2 font-medium">建议补充</th>
          </tr>
        </thead>
        <tbody>
          {skuReadiness.map(row => (
            <tr key={row.rowNumber} className="border-t border-[var(--color-border)]">
              <td className="px-2 py-2 text-[var(--color-muted)]">第 {row.rowNumber} 行</td>
              <td className="px-2 py-2 text-[var(--color-fg)]">{row.variation || '未填写变体'}</td>
              <td className="px-2 py-2 text-[var(--color-warning)]">{row.blockingGaps.length ? row.blockingGaps.join('、') : '无'}</td>
              <td className="px-2 py-2 text-[var(--color-muted)]">{row.warningGaps.length ? row.warningGaps.join('、') : '无'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkuPlatformMappingTable({ skuPlatformMapping }: { skuPlatformMapping: SkuPlatformMappingRow[] }) {
  return (
    <div
      className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]"
      data-ui="sku-platform-field-mapping-table"
      aria-label="SKU 平台字段映射表"
    >
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="text-[var(--color-muted)]">
          <tr>
            <th className="px-2 py-2 font-medium">SKU行</th>
            <th className="px-2 py-2 font-medium">目标平台</th>
            <th className="px-2 py-2 font-medium">商家SKU</th>
            <th className="px-2 py-2 font-medium">平台SKU/SPU/SKC映射</th>
            <th className="px-2 py-2 font-medium">规格映射</th>
            <th className="px-2 py-2 font-medium">价格/库存</th>
            <th className="px-2 py-2 font-medium">SKU图</th>
            <th className="px-2 py-2 font-medium">平台映射缺口</th>
          </tr>
        </thead>
        <tbody>
          {skuPlatformMapping.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-3 text-[var(--color-muted)]">暂无可映射的启用 SKU，请先补齐规格行。</td>
            </tr>
          ) : skuPlatformMapping.map(row => (
            <tr key={row.rowNumber} className="border-t border-[var(--color-border)]">
              <td className="px-2 py-2 text-[var(--color-muted)]">第 {row.rowNumber} 行</td>
              <td className="px-2 py-2 font-semibold text-[var(--color-fg)]">{row.platform}</td>
              <td className="px-2 py-2 text-[var(--color-fg)]">{row.seller_sku || '待补'}</td>
              <td className="px-2 py-2 text-[var(--color-muted)]">{row.platform_sku_field}</td>
              <td className="px-2 py-2 text-[var(--color-muted)]">{row.variation_field}</td>
              <td className="px-2 py-2 text-[var(--color-muted)]">{row.price_field} / {row.stock_field}</td>
              <td className="px-2 py-2 text-[var(--color-muted)]">{row.image_field}</td>
              <td className={row.required_gaps.length ? 'px-2 py-2 text-[var(--color-warning)]' : 'px-2 py-2 text-[var(--color-success)]'}>
                {row.required_gaps.length ? row.required_gaps.join('、') : '无'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
