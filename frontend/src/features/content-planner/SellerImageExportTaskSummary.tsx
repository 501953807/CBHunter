import type { ImageEditOptions, MediaSlotPlan } from './SellerImageEditorWorkbench'
import { buildImageProcessingSummary } from './SellerImageEditorUtils'

export function SellerImageExportTaskSummary({ imageSlots, imageOptions, publishImageLimit, saveBlockedReason }: {
  imageSlots: MediaSlotPlan[]
  imageOptions: ImageEditOptions
  publishImageLimit: number
  saveBlockedReason: string
}) {
  const processingSummary = buildImageProcessingSummary(imageOptions)
  const isPublishable = (slot: MediaSlotPlan) => slot.index === 1 || (typeof slot.publishable === 'boolean' ? slot.publishable : slot.index <= publishImageLimit)
  const publishableSlotCount = imageSlots.filter(slot => slot.imageUrl && isPublishable(slot)).length
  const retainedAssetCount = imageSlots.filter(slot => slot.imageUrl && !isPublishable(slot)).length
  const emptySlotCount = imageSlots.filter(slot => !slot.imageUrl).length
  const exportedSlotCount = imageSlots.filter(slot => slot.exportStatus === 'exported_to_content_asset').length
  const exportFailedSlotCount = imageSlots.filter(slot => slot.exportStatus === 'export_failed').length
  const exportTasks = imageSlots.filter(slot => slot.imageUrl).map(slot => ({
    slot,
    scope: isPublishable(slot) ? '发布图' : '素材池',
    format: (slot.editOptions?.output_format || imageOptions.output_format).toUpperCase(),
    size: `${slot.editOptions?.width || imageOptions.width}×${slot.editOptions?.height || imageOptions.height}`,
    quality: slot.editOptions?.quality || imageOptions.quality,
  }))

  return (
    <>
      <div className="image-workbench-control-card mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px]" data-ui="image-workbench-publish-readiness-summary">
        <p className="font-semibold text-[var(--color-fg)]">发布范围校验</p>
        <p className="mt-1 text-[var(--color-muted)]">发布前{publishImageLimit}张：可发布 {publishableSlotCount} 张；素材池保留 {retainedAssetCount} 张；空槽位 {emptySlotCount} 个；已导出 {exportedSlotCount} 张；失败 {exportFailedSlotCount} 张。</p>
        {saveBlockedReason ? (
          <p className="mt-1 font-semibold text-[var(--color-danger)]" data-ui="image-workbench-save-blocked-reason">{saveBlockedReason}</p>
        ) : (
          <p className="mt-1 font-semibold text-[var(--color-success)]" data-ui="image-workbench-save-ready-state">图片计划可保存，保存后仍需回到 Listing 校验平台素材规则。</p>
        )}
      </div>
      <div className="image-workbench-control-card mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-processing-before-save-summary" aria-label="图片保存前处理摘要">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-[var(--color-fg)]">保存前处理摘要</p>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{processingSummary.length} 项</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {processingSummary.map(item => (
            <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-muted)]" data-ui="image-processing-summary-chip">{item}</span>
          ))}
        </div>
      </div>
      <div className="image-workbench-control-card mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-export-task-preview" aria-label="图片导出任务预览">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-[var(--color-fg)]">导出任务预览</p>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{exportTasks.length} 个槽位</span>
        </div>
        <div className="mt-2 grid gap-1.5">
          {exportTasks.slice(0, 4).map(task => (
            <div key={task.slot.index} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[10px]" data-ui="image-export-task-row">
              <span className="font-semibold text-[var(--color-fg)]">{task.slot.index}. {task.slot.label}</span>
              <span className="ml-1 text-[var(--color-muted)]">{task.scope} · {task.size} · {task.format} Q{task.quality} · {exportStatusLabel(task.slot.exportStatus)}</span>
            </div>
          ))}
          {!exportTasks.length && <p className="text-[10px] text-[var(--color-muted)]">暂无可导出图片槽位，请先上传或拖入真实商品图。</p>}
        </div>
      </div>
    </>
  )
}

function exportStatusLabel(status?: string) {
  if (status === 'exported_to_content_asset') return '已导出素材'
  if (status === 'export_failed') return '导出失败'
  return '待执行导出'
}
