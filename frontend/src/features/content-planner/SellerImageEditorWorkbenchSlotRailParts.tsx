import { Plus } from 'lucide-react'
import type { ContentAsset, ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'
import { assetImageUrl } from './SellerImageEditorUtils'
import type { MediaSlotPlan } from './SellerImageEditorTypes'

export function SellerImageSlotRail({
  product,
  productImageAssets,
  imageSlots,
  activeSlot,
  activeSlotIndex,
  draggingSlotIndex,
  selectedAssetIds,
  publishImageLimit,
  loading,
  slotUploading,
  onSetActiveSlotIndex,
  onSetDraggingSlotIndex,
  onReorderSlot,
  onReplaceSlotWithAsset,
  onReplaceActiveSlotWithAsset,
  onSetAsMainImage,
  onFillEmptySlotsFromAssets,
  onAddImageSlot,
  onAppendSelectedAssetsAsSlots,
  onToggleAssetSelection,
  isSlotPublishable,
}: {
  product: ContentWorkbenchItem | null
  productImageAssets: ContentAsset[]
  imageSlots: MediaSlotPlan[]
  activeSlot: MediaSlotPlan
  activeSlotIndex: number
  draggingSlotIndex: number | null
  selectedAssetIds: string[]
  publishImageLimit: number
  loading: boolean
  slotUploading: boolean
  onSetActiveSlotIndex: (slotIndex: number) => void
  onSetDraggingSlotIndex: (slotIndex: number | null) => void
  onReorderSlot: (fromSlotIndex: number, toSlotIndex: number) => void
  onReplaceSlotWithAsset: (slotIndex: number, asset: ContentAsset) => void
  onReplaceActiveSlotWithAsset: (asset: ContentAsset) => void
  onSetAsMainImage: (slotIndex: number) => void
  onFillEmptySlotsFromAssets: () => void
  onAddImageSlot: () => void
  onAppendSelectedAssetsAsSlots: () => void
  onToggleAssetSelection: (assetId: string) => void
  isSlotPublishable: (slot: MediaSlotPlan) => boolean
}) {
  const canFillEmptySlots = Boolean(product) && !loading && !slotUploading && productImageAssets.length > 0 && imageSlots.some(slot => !slot.imageUrl)

  return (
    <aside aria-label="右侧图片槽位缩略图" className="image-workbench-slot-rail border-t border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:border-l 2xl:border-t-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">图片槽位</p>
          <p className="text-[10px] text-[var(--color-muted)]">拖拽缩略图调整主图/辅图顺序；前{publishImageLimit}张进入发布范围</p>
        </div>
        <div className="text-right">
          <span className="block text-xs text-[var(--color-primary)]">{activeSlotIndex}/{imageSlots.length}</span>
          <button
            type="button"
            onClick={onFillEmptySlotsFromAssets}
            disabled={!canFillEmptySlots}
            className="mt-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-40"
            data-ui="fill-empty-image-slots-from-assets"
            aria-label="用当前商品真实素材填充空图片槽位"
            title="只使用绑定当前商品的真实素材填充空图片槽位"
          >
            一键填充空槽位
          </button>
        </div>
      </div>
      <div className="grid max-h-[500px] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6 2xl:block 2xl:space-y-3">
        {imageSlots.map(slot => (
          <ImageSlotCard
            key={slot.index}
            slot={slot}
            activeSlot={activeSlot}
            imageSlots={imageSlots}
            draggingSlotIndex={draggingSlotIndex}
            productImageAssets={productImageAssets}
            publishImageLimit={publishImageLimit}
            onSetActiveSlotIndex={onSetActiveSlotIndex}
            onSetDraggingSlotIndex={onSetDraggingSlotIndex}
            onReorderSlot={onReorderSlot}
            onReplaceSlotWithAsset={onReplaceSlotWithAsset}
            onSetAsMainImage={onSetAsMainImage}
            isSlotPublishable={isSlotPublishable}
          />
        ))}
        <button
          type="button"
          onClick={onAddImageSlot}
          className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-2 text-center text-xs font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-surface)]"
          aria-label="新增图片空位"
          data-ui="listing-image-empty-slot"
        >
          <span>
            <Plus className="mx-auto mb-1 h-4 w-4" />
            新增图片空位
          </span>
        </button>
      </div>
      <ProductImageAssetPicker
        productImageAssets={productImageAssets}
        selectedAssetIds={selectedAssetIds}
        loading={loading}
        slotUploading={slotUploading}
        onReplaceActiveSlotWithAsset={onReplaceActiveSlotWithAsset}
        onAppendSelectedAssetsAsSlots={onAppendSelectedAssetsAsSlots}
        onToggleAssetSelection={onToggleAssetSelection}
      />
    </aside>
  )
}

function ImageSlotCard({
  slot,
  activeSlot,
  imageSlots,
  draggingSlotIndex,
  productImageAssets,
  publishImageLimit,
  onSetActiveSlotIndex,
  onSetDraggingSlotIndex,
  onReorderSlot,
  onReplaceSlotWithAsset,
  onSetAsMainImage,
  isSlotPublishable,
}: {
  slot: MediaSlotPlan
  activeSlot: MediaSlotPlan
  imageSlots: MediaSlotPlan[]
  draggingSlotIndex: number | null
  productImageAssets: ContentAsset[]
  publishImageLimit: number
  onSetActiveSlotIndex: (slotIndex: number) => void
  onSetDraggingSlotIndex: (slotIndex: number | null) => void
  onReorderSlot: (fromSlotIndex: number, toSlotIndex: number) => void
  onReplaceSlotWithAsset: (slotIndex: number, asset: ContentAsset) => void
  onSetAsMainImage: (slotIndex: number) => void
  isSlotPublishable: (slot: MediaSlotPlan) => boolean
}) {
  const cardClassName = slot.index === activeSlot.index
    ? 'image-workbench-slot-card rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-1 text-left shadow-[var(--shadow-sm)]'
    : draggingSlotIndex === slot.index
      ? 'image-workbench-slot-card rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-1 text-left opacity-70'
      : 'image-workbench-slot-card rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-left transition hover:border-[var(--color-primary)]'

  return (
    <div
      draggable
      onDragStart={() => onSetDraggingSlotIndex(slot.index)}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault()
        const droppedAssetId = event.dataTransfer.getData('application/cbhunter-image-asset-id')
        if (droppedAssetId) {
          const droppedAsset = productImageAssets.find(asset => asset.id === droppedAssetId)
          if (droppedAsset) onReplaceSlotWithAsset(slot.index, droppedAsset)
          onSetDraggingSlotIndex(null)
          return
        }
        if (draggingSlotIndex !== null) onReorderSlot(draggingSlotIndex, slot.index)
        onSetDraggingSlotIndex(null)
      }}
      onDragEnd={() => onSetDraggingSlotIndex(null)}
      className={cardClassName}
    >
      <button type="button" onClick={() => onSetActiveSlotIndex(slot.index)} className="block w-full text-left">
        {slot.imageUrl ? (
          <img src={productImageSrc(slot.imageUrl)} alt={slot.label} className="aspect-square w-full rounded-lg object-cover" />
        ) : (
          <div className="grid aspect-square place-items-center rounded-lg bg-[var(--color-bg)] text-[10px] text-[var(--color-muted)]">待补图</div>
        )}
      </button>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
        <span>{slot.sizeText}</span>
        <span>{slot.index}/{imageSlots.length}</span>
      </div>
      <p
        className={slot.index === 1 ? 'mt-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-primary)]' : isSlotPublishable(slot) ? 'mt-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-success)]' : 'mt-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-center text-[10px] text-[var(--color-muted)]'}
        data-ui="image-workbench-slot-publish-state"
      >
        {slot.index === 1 ? '平台主图' : isSlotPublishable(slot) ? `发布前${publishImageLimit}张` : '素材池保留'}
      </p>
      <p
        className={slot.exportStatus === 'exported_to_content_asset'
          ? 'mt-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-success)]'
          : slot.exportStatus === 'export_failed'
            ? 'mt-1 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-warning)]'
            : 'mt-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-center text-[10px] text-[var(--color-muted)]'}
        data-ui="image-slot-export-status"
        title={slot.exportError || slot.generatedAssetUrl || '保存图片计划后执行导出任务'}
      >
        {slot.exportStatus === 'exported_to_content_asset' ? '已导出素材' : slot.exportStatus === 'export_failed' ? '导出失败' : '待执行导出'}
      </p>
      <div className="mt-1 grid grid-cols-1 gap-1 text-[10px]">
        <button type="button" onClick={() => onSetAsMainImage(slot.index)} disabled={slot.index === 1 || !slot.imageUrl} className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40">设为主图</button>
      </div>
    </div>
  )
}

function ProductImageAssetPicker({
  productImageAssets,
  selectedAssetIds,
  loading,
  slotUploading,
  onReplaceActiveSlotWithAsset,
  onAppendSelectedAssetsAsSlots,
  onToggleAssetSelection,
}: {
  productImageAssets: ContentAsset[]
  selectedAssetIds: string[]
  loading: boolean
  slotUploading: boolean
  onReplaceActiveSlotWithAsset: (asset: ContentAsset) => void
  onAppendSelectedAssetsAsSlots: () => void
  onToggleAssetSelection: (assetId: string) => void
}) {
  if (!productImageAssets.length) return null

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">当前商品真实素材库</p>
          <p className="text-[10px] text-[var(--color-muted)]">点选多张后可批量追加为图片槽位</p>
        </div>
        <button
          type="button"
          onClick={onAppendSelectedAssetsAsSlots}
          disabled={!selectedAssetIds.length || loading || slotUploading}
          className="rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-40"
          data-ui="append-selected-assets-as-image-slots"
          aria-label="将选中真实素材批量追加为图片槽位"
        >
          批量追加槽位 {selectedAssetIds.length || ''}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 2xl:grid-cols-2">
        {productImageAssets.slice(0, 8).map(asset => (
          <div
            key={asset.id}
            draggable
            onDragStart={event => event.dataTransfer.setData('application/cbhunter-image-asset-id', asset.id)}
            className={selectedAssetIds.includes(asset.id)
              ? 'image-workbench-asset-card overflow-hidden rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]'
              : 'image-workbench-asset-card overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-primary)]'}
            data-ui="selectable-product-image-asset"
          >
            <span className="sr-only" data-ui="draggable-product-image-asset">可拖拽素材</span>
            <button
              type="button"
              data-ui="replace-active-slot-with-asset"
              onClick={() => onReplaceActiveSlotWithAsset(asset)}
              className="block w-full"
              title="放入当前槽位"
            >
              <img src={productImageSrc(assetImageUrl(asset))} alt={asset.original_name || asset.id} className="aspect-square w-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => onToggleAssetSelection(asset.id)}
              className="block w-full border-t border-[var(--color-border)] px-1 py-1 text-[10px] font-semibold text-[var(--color-primary)]"
              aria-label="选择真实素材用于批量追加槽位"
            >
              {selectedAssetIds.includes(asset.id) ? '已选' : '选择'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
