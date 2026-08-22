import { Upload } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'
import { SellerImageCropControls } from './SellerImageCropControls'
import { SellerImageEnhancementControls } from './SellerImageEnhancementControls'
import { SellerImageExportTaskSummary } from './SellerImageExportTaskSummary'
import { SellerImageOutputControls } from './SellerImageOutputControls'
import { SellerImageWatermarkControls } from './SellerImageWatermarkControls'
import { SELLER_IMAGE_TOOL_HINTS, buildCropPreviewStyle, buildWatermarkPreviewStyle } from './SellerImageEditorUtils'
import { SellerImagePresetAndWatermarkPanel } from './SellerImageEditorWorkbenchParts'
import type { ImageEditOptions, ImageWatermarkTemplateOption, MediaSlotPlan } from './SellerImageEditorTypes'

type SetImageOptions = Dispatch<SetStateAction<ImageEditOptions>>

const inputClass = 'text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]'

export function SellerImageCanvasPanel({
  product,
  activeSlot,
  imageSlots,
  imageOptions,
  setImageOptions,
  activeTool,
  slotPlanDirty,
  slotUploading,
  loading,
  sourceImage,
  publishImageLimit,
  saveBlockedReason,
  watermarkTemplates,
  onUploadSlotImage,
  onUseSourceImage,
  onSaveImageSlotPlan,
  onClearActiveSlot,
  onRemoveActiveSlot,
  onClearWatermark,
  onApplyWatermarkTemplate,
}: {
  product: ContentWorkbenchItem | null
  activeSlot: MediaSlotPlan
  imageSlots: MediaSlotPlan[]
  imageOptions: ImageEditOptions
  setImageOptions: SetImageOptions
  activeTool: string
  slotPlanDirty: boolean
  slotUploading: boolean
  loading: boolean
  sourceImage: string
  publishImageLimit: number
  saveBlockedReason: string
  watermarkTemplates: ImageWatermarkTemplateOption[]
  onUploadSlotImage: (file: File) => void
  onUseSourceImage: () => void
  onSaveImageSlotPlan: () => void
  onClearActiveSlot: () => void
  onRemoveActiveSlot: () => void
  onClearWatermark?: () => void
  onApplyWatermarkTemplate?: (template: ImageWatermarkTemplateOption) => void
}) {
  const imagePreviewStyle = {
    filter: `brightness(${imageOptions.brightness}) contrast(${imageOptions.contrast})`,
    transform: `rotate(${imageOptions.rotate_degrees}deg) scaleX(${imageOptions.flip_horizontal ? -1 : 1}) scaleY(${imageOptions.flip_vertical ? -1 : 1})`,
    transition: 'filter 160ms ease, transform 160ms ease',
  }

  return (
    <div aria-label="图片编辑画布" className="image-workbench-canvas relative grid place-items-center bg-[var(--color-bg)] p-8">
      {activeSlot.imageUrl ? (
        <div className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
          <img src={productImageSrc(activeSlot.imageUrl)} alt={`${product?.product_name || '商品'}${activeSlot.label}`} className={imageOptions.fit === 'cover' ? 'aspect-square w-full object-cover' : 'aspect-square w-full object-contain'} style={imagePreviewStyle} data-ui="image-canvas-transform-preview" />
          {imageOptions.crop_mode === 'manual' && (
            <div
              aria-label="图片裁切预览框"
              data-ui="image-crop-preview-frame"
              className="pointer-events-none absolute rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)]/10"
              style={buildCropPreviewStyle(imageOptions)}
            >
              <span className="absolute left-2 top-2 rounded-full bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] shadow-[var(--shadow-sm)]">
                裁切预览 {imageOptions.crop_width || imageOptions.width}×{imageOptions.crop_height || imageOptions.height}
              </span>
            </div>
          )}
          {imageOptions.watermark_text ? (
            <div className="pointer-events-none absolute rounded-xl px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-sm)]" style={buildWatermarkPreviewStyle(imageOptions)} data-ui="image-watermark-live-preview" aria-label="图片水印实时预览">
              {imageOptions.watermark_text}
            </div>
          ) : null}
          <div className="absolute left-4 top-4 rounded-xl bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold text-[var(--color-fg)] shadow-[var(--shadow-sm)]">
            {product?.product_name || '当前商品'}
          </div>
          <div className="absolute bottom-4 left-4 rounded-xl bg-[var(--color-surface)]/95 px-3 py-2 text-xs text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
            {activeTool} · {imageOptions.width}×{imageOptions.height} · {imageOptions.fit === 'cover' ? '裁切' : '留白'} · {imageOptions.output_format.toUpperCase()}
          </div>
        </div>
      ) : (
        <ImageSlotUploadDropzone
          activeSlot={activeSlot}
          product={product}
          loading={loading}
          slotUploading={slotUploading}
          onUploadSlotImage={onUploadSlotImage}
        />
      )}
      <ImageCanvasControlPanel
        product={product}
        activeSlot={activeSlot}
        imageSlots={imageSlots}
        imageOptions={imageOptions}
        setImageOptions={setImageOptions}
        activeTool={activeTool}
        slotPlanDirty={slotPlanDirty}
        slotUploading={slotUploading}
        loading={loading}
        publishImageLimit={publishImageLimit}
        saveBlockedReason={saveBlockedReason}
        watermarkTemplates={watermarkTemplates}
        onUploadSlotImage={onUploadSlotImage}
        onClearActiveSlot={onClearActiveSlot}
        onRemoveActiveSlot={onRemoveActiveSlot}
        onClearWatermark={onClearWatermark}
        onApplyWatermarkTemplate={onApplyWatermarkTemplate}
      />
      <div className="absolute bottom-4 right-4 flex flex-wrap gap-2">
        <Button variant="outline" disabled={!product}>取消</Button>
        <Button onClick={onUseSourceImage} disabled={!sourceImage || loading || slotUploading} data-ui="process-source-image-into-active-slot">
          {loading || slotUploading ? '处理中...' : '处理源图并替换当前槽位'}
        </Button>
        <Button
          variant="secondary"
          onClick={onSaveImageSlotPlan}
          disabled={!product || loading || slotUploading || Boolean(saveBlockedReason)}
          data-ui="save-dirty-image-slot-plan"
          title={saveBlockedReason || '保存当前图片槽位顺序和发布范围'}
        >
          {slotPlanDirty ? '保存槽位变更' : '保存槽位顺序'}
        </Button>
      </div>
    </div>
  )
}

function ImageSlotUploadDropzone({
  activeSlot,
  product,
  loading,
  slotUploading,
  onUploadSlotImage,
}: {
  activeSlot: MediaSlotPlan
  product: ContentWorkbenchItem | null
  loading: boolean
  slotUploading: boolean
  onUploadSlotImage: (file: File) => void
}) {
  return (
    <label className="grid h-[420px] w-full max-w-[720px] cursor-pointer place-items-center rounded-2xl border border-dashed border-[var(--color-primary)] bg-[var(--color-surface)] text-center text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-primary-light)]">
      <input
        className="sr-only"
        data-ui="image-slot-file-input"
        type="file"
        accept="image/*"
        disabled={!product || loading || slotUploading}
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onUploadSlotImage(file)
          event.currentTarget.value = ''
        }}
      />
      <span>
        <Upload className="mx-auto mb-3 h-10 w-10 text-[var(--color-primary)]" />
        <span className="block font-semibold text-[var(--color-fg)]">上传图片到当前槽位</span>
        <span className="mt-1 block text-xs">当前为 {activeSlot.label}，仅接受真实商品图，不使用假图占位。</span>
      </span>
    </label>
  )
}

function ImageCanvasControlPanel({
  product,
  activeSlot,
  imageSlots,
  imageOptions,
  setImageOptions,
  activeTool,
  slotPlanDirty,
  slotUploading,
  loading,
  publishImageLimit,
  saveBlockedReason,
  watermarkTemplates,
  onUploadSlotImage,
  onClearActiveSlot,
  onRemoveActiveSlot,
  onClearWatermark,
  onApplyWatermarkTemplate,
}: {
  product: ContentWorkbenchItem | null
  activeSlot: MediaSlotPlan
  imageSlots: MediaSlotPlan[]
  imageOptions: ImageEditOptions
  setImageOptions: SetImageOptions
  activeTool: string
  slotPlanDirty: boolean
  slotUploading: boolean
  loading: boolean
  publishImageLimit: number
  saveBlockedReason: string
  watermarkTemplates: ImageWatermarkTemplateOption[]
  onUploadSlotImage: (file: File) => void
  onClearActiveSlot: () => void
  onRemoveActiveSlot: () => void
  onClearWatermark?: () => void
  onApplyWatermarkTemplate?: (template: ImageWatermarkTemplateOption) => void
}) {
  return (
    <div className="image-workbench-control-panel absolute left-4 top-4 max-w-[360px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 text-xs shadow-[var(--shadow-sm)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{activeSlot.label}</Badge>
        <span className="text-[var(--color-muted)]">当前工具：{activeTool}</span>
      </div>
      <p className="mt-2 leading-5 text-[var(--color-muted)]">{SELLER_IMAGE_TOOL_HINTS[activeTool]}</p>
      <p
        className={slotPlanDirty
          ? 'mt-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-1.5 text-[11px] font-semibold text-[var(--color-warning)]'
          : 'mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'}
        data-ui="image-slot-plan-dirty-state"
      >
        {slotPlanDirty ? '当前图片槽位有未保存变更，保存后才写入 Listing 图片计划。' : '当前槽位计划已同步到最近保存状态。'}
      </p>
      <SellerImageExportTaskSummary imageSlots={imageSlots} imageOptions={imageOptions} publishImageLimit={publishImageLimit} saveBlockedReason={saveBlockedReason} />
      <SellerImageCropControls imageOptions={imageOptions} setImageOptions={setImageOptions} inputClass={inputClass} />
      <SellerImageEnhancementControls imageOptions={imageOptions} setImageOptions={setImageOptions} inputClass={inputClass} />
      <SellerImageOutputControls imageOptions={imageOptions} setImageOptions={setImageOptions} inputClass={inputClass} />
      <SellerImageWatermarkControls imageOptions={imageOptions} setImageOptions={setImageOptions} inputClass={inputClass} onClearWatermark={onClearWatermark} />
      <SellerImagePresetAndWatermarkPanel setImageOptions={setImageOptions} watermarkTemplates={watermarkTemplates} onApplyWatermarkTemplate={onApplyWatermarkTemplate} />
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2 font-semibold text-[var(--color-primary)]">
        <Upload className="h-4 w-4" />
        {slotUploading ? '上传处理中...' : '上传/替换当前槽位'}
        <input
          className="sr-only"
          data-ui="image-slot-file-input"
          type="file"
          accept="image/*"
          disabled={!product || loading || slotUploading}
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onUploadSlotImage(file)
            event.currentTarget.value = ''
          }}
        />
      </label>
      <div aria-label="当前图片槽位删除动作" className="mt-2 grid grid-cols-2 gap-2" data-ui="image-slot-clear-remove-actions">
        <button
          type="button"
          onClick={onClearActiveSlot}
          disabled={!activeSlot.imageUrl || loading || slotUploading}
          className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-warning)] transition hover:border-[var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-40"
          data-ui="clear-active-image-slot"
        >
          清空当前槽位
        </button>
        <button
          type="button"
          onClick={onRemoveActiveSlot}
          disabled={imageSlots.length <= 1 || loading || slotUploading}
          className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-danger)] transition hover:border-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
          data-ui="remove-active-image-slot"
        >
          删除当前槽位
        </button>
      </div>
    </div>
  )
}
