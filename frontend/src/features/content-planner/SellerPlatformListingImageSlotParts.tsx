import { GripVertical, ImagePlus } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { Button } from '../../components/ui/Button'
import { productImageSrc } from '../../utils/productImages'
import { EditorSection } from './SellerPlatformListingEditorParts'
import type { ListingImageSlot } from './SellerPlatformListingEditorUtils'

export function ListingImageSlotSection({
  active,
  product,
  imageSlots,
  draggingImageIndex,
  recommendedImages,
  minImages,
  publishableSlotImageCount,
  confirmedSlotCount,
  confirmedPublishableCount,
  confirmedRetainedCount,
  changeTab,
  onDragStart,
  onDrop,
  onDragEnd,
  onSetMainImage,
  onAddImageSlot,
}: {
  active: boolean
  product: ContentWorkbenchItem | null
  imageSlots: ListingImageSlot[]
  draggingImageIndex: number | null
  recommendedImages: number
  minImages: number
  publishableSlotImageCount: number
  confirmedSlotCount: number
  confirmedPublishableCount: number
  confirmedRetainedCount: number
  changeTab: (nextTab: string, options?: { imageSlotIndex?: number }) => void
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
  onSetMainImage: (index: number) => void
  onAddImageSlot: () => void
}) {
  return (
    <EditorSection id="listing-master-media" title="商品图片与素材" description="顶部先处理商品图片。素材池可以保留多张，发布到平台时只取前 9 个槽位；槽位顺序决定平台主图和辅图顺序。" active={active}>
      <div
        id="listing-field-images"
        tabIndex={-1}
        className="grid grid-cols-2 gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
        data-ui="listing-master-image-slot-grid"
      >
        {imageSlots.map((slot, index) => (
          <div
            key={slot.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => onDrop(index)}
            onDragEnd={onDragEnd}
            className={draggingImageIndex === index ? 'overflow-hidden rounded-xl border border-[var(--color-primary)] bg-[var(--color-surface)] opacity-60 shadow-[var(--shadow-md)]' : 'overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'}
            data-ui="listing-image-slot-order-card"
          >
            <button
              type="button"
              onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
              className="group relative block w-full bg-[var(--color-bg)]"
              data-ui="listing-image-slot-edit-link"
              aria-label={`编辑${slot.label}图片槽位`}
            >
              {slot.imageUrl ? (
                <img src={productImageSrc(slot.imageUrl)} alt={slot.label} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center gap-1 text-[11px] text-[var(--color-muted)]">
                  <ImagePlus className="h-5 w-5" />
                  <span>{slot.required ? '必填图' : '素材位'}</span>
                </div>
              )}
              <span className="absolute bottom-0 left-0 right-0 bg-[var(--color-fg)]/70 px-1 py-1 text-[10px] text-[var(--color-surface)]">{slot.label}</span>
              <span
                className={index === 0 ? 'absolute left-1 top-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-surface)] shadow-[var(--shadow-sm)]' : 'absolute left-1 top-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-fg)] shadow-[var(--shadow-sm)]'}
                data-ui="listing-image-slot-publish-order"
              >
                {index === 0 ? '主图' : `第${index + 1}张`}
              </span>
              <span
                className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] shadow-[var(--shadow-sm)]"
                data-ui="listing-image-slot-drag-handle"
              >
                <GripVertical className="h-3 w-3" />拖拽
              </span>
              <span className="absolute right-1 top-7 hidden rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-primary)] shadow-[var(--shadow-sm)] group-hover:block">编辑图片</span>
            </button>
            <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1">
              <p className="truncate text-[10px] text-[var(--color-muted)]">{slot.role}</p>
              <p
                className={index < recommendedImages ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-muted)]'}
                data-ui="listing-image-slot-publish-state"
              >
                {index === 0 ? '平台主图 / 搜索首图' : index < recommendedImages ? `发布前${recommendedImages}张内` : '素材池保留，不随本次发布'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 border-t border-[var(--color-border)] p-1 text-[10px]">
              <button type="button" onClick={() => onSetMainImage(index)} disabled={index === 0 || !slot.imageUrl} className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-primary)] disabled:opacity-30">设主图</button>
              <button
                type="button"
                onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
                className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-muted)]"
                data-ui="listing-image-slot-edit-link"
                aria-label={`编辑${slot.label}图片槽位`}
              >
                编辑
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddImageSlot}
          className="grid min-h-[132px] place-items-center rounded-xl border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3 text-center text-xs text-[var(--color-primary)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
          data-ui="listing-master-add-image-slot"
        >
          <span>
            <ImagePlus className="mx-auto mb-2 h-6 w-6" />
            添加图片
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">素材可多于 9 张，发布取前 9 张</span>
          </span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]" data-ui="listing-image-operation-toolbar" aria-label="Listing 图片槽位操作规则">
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">素材池 {imageSlots.length} 张，发布取前 {recommendedImages} 张</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">已排入发布 {publishableSlotImageCount}/{recommendedImages}</span>
        <span className={confirmedSlotCount ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 font-semibold text-[var(--color-success)]' : 'rounded-full border border-[var(--color-border)] px-2 py-1'} data-ui="listing-confirmed-image-slot-plan-summary">{confirmedSlotCount ? `已回显图片计划 ${confirmedPublishableCount || confirmedSlotCount} 张发布图${confirmedRetainedCount ? `，素材池 ${confirmedRetainedCount}` : ''}` : '未保存图片计划，使用源图初始化'}</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">至少 {minImages} 张</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">直接拖拽图片排序，首位即平台主图</span>
        <Button size="sm" variant="outline" onClick={() => changeTab('media', { imageSlotIndex: 1 })} disabled={!product}>打开第1张图片工作台</Button>
      </div>
    </EditorSection>
  )
}
