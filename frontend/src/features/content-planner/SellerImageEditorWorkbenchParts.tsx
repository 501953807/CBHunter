import type { Dispatch, SetStateAction } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { SELLER_IMAGE_PLATFORM_SIZE_PRESETS, SELLER_IMAGE_TOOL_GROUPS } from './SellerImageEditorUtils'
import type { ImageEditOptions, ImageWatermarkTemplateOption, MediaSlotPlan } from './SellerImageEditorTypes'

export function SellerImageWorkbenchHeader({
  activeSlot,
  slotCount,
  slotPlanDirty,
  restoredSlotPlan,
  exportedSlotCount,
  exportFailedSlotCount,
  imageSlotWithImageCount,
}: {
  activeSlot: MediaSlotPlan
  slotCount: number
  slotPlanDirty: boolean
  restoredSlotPlan: boolean
  exportedSlotCount: number
  exportFailedSlotCount: number
  imageSlotWithImageCount: number
}) {
  return (
    <div className="image-workbench-header flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-2 text-xs">
      <span className="font-semibold text-[var(--color-primary)]">商品图片工作台：拖拽排序、空位补图、当前槽位替换</span>
      <span
        className="rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 font-semibold text-[var(--color-primary)]"
        data-ui="listing-image-active-slot-context"
        aria-label="Listing 图片编辑当前槽位"
      >
        当前槽位：{activeSlot.label} {activeSlot.index}/{slotCount || 1}
      </span>
      <div className="flex items-center gap-2">
        <Badge variant={slotPlanDirty ? 'warning' : 'success'}>{slotPlanDirty ? '槽位待保存' : '槽位已同步'}</Badge>
        {restoredSlotPlan ? (
          <Badge variant="info" data-ui="restored-image-slot-plan-state">已回显保存计划</Badge>
        ) : null}
        <Badge variant={activeSlot.editOptions ? 'info' : 'warning'} data-ui="image-slot-edit-options-state">{activeSlot.editOptions ? '槽位参数已绑定' : '使用当前参数'}</Badge>
        <Badge variant={exportFailedSlotCount ? 'warning' : exportedSlotCount ? 'success' : 'info'} data-ui="image-export-status-summary">
          导出 {exportedSlotCount}/{imageSlotWithImageCount}
        </Badge>
        <Badge variant="success">真实素材绑定</Badge>
      </div>
    </div>
  )
}

export function SellerImageToolRail({ activeTool, onApplyToolPreset }: {
  activeTool: string
  onApplyToolPreset: (tool: string) => void
}) {
  return (
    <aside aria-label="左侧图片工具栏" className="image-workbench-tool-rail border-b border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:border-b-0 2xl:border-r">
      <div className="space-y-4">
        {SELLER_IMAGE_TOOL_GROUPS.map(group => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">{group.title}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-2">
              {group.tools.map(tool => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => onApplyToolPreset(tool)}
                  className={tool === activeTool
                    ? 'image-workbench-tool-button rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-3 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'
                    : 'image-workbench-tool-button rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'}
                >
                  <SlidersHorizontal className="mx-auto mb-1 h-4 w-4 text-[var(--color-muted)]" />
                  {tool}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function SellerImagePresetAndWatermarkPanel({
  setImageOptions,
  watermarkTemplates,
  onApplyWatermarkTemplate,
}: {
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  watermarkTemplates: ImageWatermarkTemplateOption[]
  onApplyWatermarkTemplate?: (template: ImageWatermarkTemplateOption) => void
}) {
  return (
    <>
      <div aria-label="平台图片尺寸预设" data-ui="image-platform-size-presets" className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
        <p className="mb-2 text-[11px] font-semibold text-[var(--color-fg)]">平台尺寸预设</p>
        <div className="grid gap-1.5">
          {SELLER_IMAGE_PLATFORM_SIZE_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setImageOptions(prev => ({ ...prev, width: preset.width, height: preset.height, fit: preset.fit, crop_width: preset.width, crop_height: preset.height }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left text-[11px] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <span className="font-semibold text-[var(--color-fg)]">{preset.label}</span> · {preset.width}×{preset.height} · {preset.fit === 'cover' ? '裁切' : '留白'}
            </button>
          ))}
        </div>
      </div>
      <div
        aria-label="水印模板快速应用"
        data-ui="listing-image-watermark-template-picker"
        className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-semibold text-[var(--color-fg)]">水印模板</p>
          <span className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">模板快速套用</span>
        </div>
        {watermarkTemplates.length > 0 ? (
          <div className="grid gap-1">
            {watermarkTemplates.slice(0, 4).map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => onApplyWatermarkTemplate?.(template)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
              >
                <span className="block truncate font-semibold text-[var(--color-primary)]">应用水印模板：{template.name}</span>
                <span className="block truncate text-[10px] text-[var(--color-muted)]">{template.platform} · {template.scope} · {template.position}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-5 text-[var(--color-muted)]">暂无水印模板；请先在图片/水印模板维护真实模板。</p>
        )}
      </div>
    </>
  )
}
