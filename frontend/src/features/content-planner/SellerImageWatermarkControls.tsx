import type { Dispatch, SetStateAction } from 'react'
import type { ImageEditOptions } from './SellerImageEditorTypes'

export function SellerImageWatermarkControls({ imageOptions, setImageOptions, inputClass, onClearWatermark }: {
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  inputClass: string
  onClearWatermark?: () => void
}) {
  return (
    <div className="image-workbench-control-card mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-watermark-inline-controls" aria-label="图片水印参数控制">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">水印参数</p>
        <button type="button" onClick={onClearWatermark} disabled={!imageOptions.watermark_text} className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40">清除水印</button>
      </div>
      <label className="text-[10px] text-[var(--color-muted)]">水印文字<input className={`${inputClass} mt-1 w-full py-1 text-[11px]`} maxLength={40} value={imageOptions.watermark_text} onChange={event => setImageOptions(prev => ({ ...prev, watermark_text: event.target.value }))} placeholder="如 CocoTrip / 店铺名" /></label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-[10px] text-[var(--color-muted)]">位置<select className={`${inputClass} mt-1 w-full py-1 text-[11px]`} value={imageOptions.watermark_position} onChange={event => setImageOptions(prev => ({ ...prev, watermark_position: event.target.value }))}><option value="bottom_right">右下</option><option value="bottom_left">左下</option><option value="top_right">右上</option><option value="top_left">左上</option><option value="center">居中</option></select></label>
        <label className="text-[10px] text-[var(--color-muted)]">透明度<input className={`${inputClass} mt-1 w-full py-1 text-[11px]`} type="number" min="0.05" max="0.8" step="0.05" value={imageOptions.watermark_opacity} onChange={event => setImageOptions(prev => ({ ...prev, watermark_opacity: Math.min(0.8, Math.max(0.05, Number(event.target.value) || prev.watermark_opacity)) }))} /></label>
        <label className="text-[10px] text-[var(--color-muted)]">颜色<input className={`${inputClass} mt-1 h-[30px] w-full p-1`} type="color" value={imageOptions.watermark_color || '#FFFFFF'} onChange={event => setImageOptions(prev => ({ ...prev, watermark_color: event.target.value }))} /></label>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">水印随当前图片槽位保存，不跨槽位污染；平台发布前仍以最终导出图为准。</p>
    </div>
  )
}
